/**
 * Cloudflare Worker with WebSocket for real-time user updates
 *
 * This is the main API entry point for the Local First Auth starter.
 * Endpoints handle user profile management via JWT-verified requests.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Context } from 'hono'
import type { Env } from './types'
import { Broadcaster } from './durable-object'
import { createDb } from './db/client'
import * as UserModel from './db/models/users'
import * as EventModel from './db/models/events'
import * as PhotoModel from './db/models/photos'
import type { PhotoWithUploader } from './db/models/photos'
import { presignPut, presignGet } from './r2'
import { decodeAndVerifyJWT } from '@zconsole/party-pics-shared'

const MAX_BATCH = 25

const app = new Hono<{ Bindings: Env }>()

// Enable CORS for all requests
app.use('/*', cors({
  origin: '*',
  credentials: true,
}))

/**
 * POST /api/add-user - Add or update user profile (without avatar)
 * Preserves existing avatar if user already exists
 */
app.post('/api/add-user', async (c) => {
  try {
    const body = await c.req.json()
    const { profileJwt } = body

    if (!profileJwt) {
      return c.json({ error: 'Missing profileJwt' }, 400)
    }

    // Verify and decode the profile JWT
    const profilePayload = await decodeAndVerifyJWT(profileJwt)

    // Extract profile data
    const { did, name, socials } = profilePayload.data as {
      did: string
      name: string
      socials?: Array<{ platform: string; handle: string }>
    }

    // Create database instance and upsert user
    const db = createDb(c.env.DB)
    const user = await UserModel.addOrUpdateUser(
      db,
      did,
      name,
      socials ?? []
    )

    // Broadcast to all WebSocket clients via Durable Object
    await notifyDO(c, 'user-joined', user)

    return c.json(user)
  } catch (error) {
    console.error('Add user error:', error)
    return c.json(
      { error: 'Failed to add user', message: (error as Error).message },
      500
    )
  }
})

/**
 * POST /api/add-avatar - Add or update user avatar
 * Creates user with avatar only if doesn't exist yet
 */
app.post('/api/add-avatar', async (c) => {
  try {
    const body = await c.req.json()
    const { avatarJwt } = body

    if (!avatarJwt) {
      return c.json({ error: 'Missing avatarJwt' }, 400)
    }

    // Verify and decode the avatar JWT
    const avatarPayload = await decodeAndVerifyJWT(avatarJwt)

    // Extract DID from issuer and avatar from data
    const did = avatarPayload.iss
    const { avatar } = avatarPayload.data as { avatar: string }

    if (!avatar) {
      return c.json({ error: 'No avatar data in JWT' }, 400)
    }

    // Create database instance and upsert avatar
    const db = createDb(c.env.DB)
    const user = await UserModel.addOrUpdateUserAvatar(db, did, avatar)

    // Broadcast to all WebSocket clients via Durable Object
    await notifyDO(c, 'user-joined', user)

    return c.json(user)
  } catch (error) {
    console.error('Add avatar error:', error)
    return c.json(
      { error: 'Failed to add avatar', message: (error as Error).message },
      500
    )
  }
})

/**
 * DELETE /api/remove-user - Remove user
 * Requires JWT verification to ensure user is removing themselves
 */
app.delete('/api/remove-user', async (c) => {
  try {
    const body = await c.req.json()
    const { profileJwt } = body

    if (!profileJwt) {
      return c.json({ error: 'Missing profileJwt' }, 400)
    }

    // Verify and decode the JWT to get the user's DID
    const payload = await decodeAndVerifyJWT(profileJwt)
    const did = payload.iss

    // Create database instance and delete user
    const db = createDb(c.env.DB)
    await UserModel.deleteUserByDID(db, did)

    // Broadcast to all WebSocket clients via Durable Object
    await notifyDO(c, 'user-left', { did })

    return c.json({ success: true, did })
  } catch (error) {
    console.error('Remove user error:', error)
    return c.json(
      { error: 'Failed to remove user', message: (error as Error).message },
      500
    )
  }
})

/**
 * GET /api/users - Get all users
 */
app.get('/api/users', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const users = await UserModel.getAllUsers(db)
    return c.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return c.json(
      { error: 'Failed to fetch users', message: (error as Error).message },
      500
    )
  }
})

/**
 * POST /api/reset - Reset event (admin only)
 * Broadcasts reset message and clears all non-admin users
 */
app.post('/api/reset', async (c) => {
  try {
    const body = await c.req.json()
    const { profileJwt, message } = body

    if (!profileJwt) {
      return c.json({ error: 'Missing profileJwt' }, 400)
    }

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Missing or invalid message' }, 400)
    }

    // Verify and decode the JWT to get the user's DID
    const payload = await decodeAndVerifyJWT(profileJwt)
    const did = payload.iss

    // Check if user is admin
    const db = createDb(c.env.DB)
    const isAdmin = await UserModel.isUserAdmin(db, did)

    if (!isAdmin) {
      return c.json({ error: 'Unauthorized: Admin access required' }, 403)
    }

    // Broadcast reset message to all connected clients
    await notifyDO(c, 'reset', { message })

    // Clear all non-admin users from database
    await UserModel.deleteNonAdminUsers(db)

    return c.json({ success: true })
  } catch (error) {
    console.error('Reset error:', error)
    return c.json(
      { error: 'Failed to reset', message: (error as Error).message },
      500
    )
  }
})

/**
 * POST /api/events - Create a new event (one event = one roll of photos)
 */
app.post('/api/events', async (c) => {
  try {
    const { profileJwt, name } = await c.req.json()

    if (!profileJwt) {
      return c.json({ error: 'Missing profileJwt' }, 400)
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ error: 'Missing event name' }, 400)
    }

    const payload = await decodeAndVerifyJWT(profileJwt)
    const did = payload.iss

    const db = createDb(c.env.DB)
    const event = await EventModel.createEvent(db, {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdByDid: did,
    })

    return c.json(event)
  } catch (error) {
    console.error('Create event error:', error)
    return c.json(
      { error: 'Failed to create event', message: (error as Error).message },
      500
    )
  }
})

/**
 * GET /api/events - List all events with photo counts (most recent first)
 */
app.get('/api/events', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const events = await EventModel.getAllEvents(db)
    return c.json({ events })
  } catch (error) {
    console.error('Error fetching events:', error)
    return c.json(
      { error: 'Failed to fetch events', message: (error as Error).message },
      500
    )
  }
})

/**
 * Serialize a photo row into the API shape, adding a presigned GET url and frame number
 */
async function serializePhoto(c: Context<{ Bindings: Env }>, photo: PhotoWithUploader, no: number) {
  return {
    id: photo.id,
    no,
    url: await presignGet(c.env, photo.r2Key),
    width: photo.width,
    height: photo.height,
    uploaderDid: photo.uploaderDid,
    uploaderName: photo.uploaderName,
    uploaderAvatar: photo.uploaderAvatar,
    createdAt: photo.createdAt,
  }
}

/**
 * GET /api/events/:eventId - Event details + photos (each with a presigned GET url)
 */
app.get('/api/events/:eventId', async (c) => {
  try {
    const eventId = c.req.param('eventId')
    const db = createDb(c.env.DB)

    const event = await EventModel.getEventById(db, eventId)
    if (!event) {
      return c.json({ error: 'Event not found' }, 404)
    }

    const rows = await PhotoModel.getPhotosByEvent(db, eventId)
    const photos = await Promise.all(rows.map((p, i) => serializePhoto(c, p, i + 1)))

    return c.json({ event, photos })
  } catch (error) {
    console.error('Error fetching event:', error)
    return c.json(
      { error: 'Failed to fetch event', message: (error as Error).message },
      500
    )
  }
})

/**
 * POST /api/events/:eventId/photos/presign - Pre-generate a batch of presigned PUT urls.
 * Called on gallery load so uploads fire instantly once images are picked.
 */
app.post('/api/events/:eventId/photos/presign', async (c) => {
  try {
    const eventId = c.req.param('eventId')
    const { profileJwt, count } = await c.req.json()

    if (!profileJwt) {
      return c.json({ error: 'Missing profileJwt' }, 400)
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
      return c.json({ error: `count must be an integer between 1 and ${MAX_BATCH}` }, 400)
    }

    // Verify the requester is signed in (DID not otherwise needed for signing)
    await decodeAndVerifyJWT(profileJwt)

    const uploads = await Promise.all(
      Array.from({ length: count }, async () => {
        const key = `events/${eventId}/${crypto.randomUUID()}`
        return { key, uploadUrl: await presignPut(c.env, key) }
      })
    )

    return c.json({ uploads })
  } catch (error) {
    console.error('Presign error:', error)
    return c.json(
      { error: 'Failed to presign uploads', message: (error as Error).message },
      500
    )
  }
})

/**
 * POST /api/events/:eventId/photos/confirm - Record uploaded photos after the
 * browser has PUT them to R2. Inserts metadata rows and returns them with urls.
 */
app.post('/api/events/:eventId/photos/confirm', async (c) => {
  try {
    const eventId = c.req.param('eventId')
    const { profileJwt, photos } = await c.req.json()

    if (!profileJwt) {
      return c.json({ error: 'Missing profileJwt' }, 400)
    }
    if (!Array.isArray(photos) || photos.length === 0 || photos.length > MAX_BATCH) {
      return c.json({ error: `photos must be an array of 1 to ${MAX_BATCH} items` }, 400)
    }

    const payload = await decodeAndVerifyJWT(profileJwt)
    const did = payload.iss

    const db = createDb(c.env.DB)

    // Only accept keys scoped to this event (prevents writing rows for other events' keys)
    const rows = photos
      .filter((p: { key?: string }) => typeof p.key === 'string' && p.key.startsWith(`events/${eventId}/`))
      .map((p: { key: string; contentType?: string; width?: number; height?: number }) => ({
        id: crypto.randomUUID(),
        eventId,
        uploaderDid: did,
        r2Key: p.key,
        contentType: p.contentType ?? null,
        width: typeof p.width === 'number' ? p.width : null,
        height: typeof p.height === 'number' ? p.height : null,
      }))

    if (rows.length === 0) {
      return c.json({ error: 'No valid photo keys for this event' }, 400)
    }

    const inserted = await PhotoModel.addPhotos(db, rows)
    const result = await Promise.all(
      inserted.map((p, i) => serializePhoto(c, { ...p, uploaderName: null, uploaderAvatar: null }, i + 1))
    )

    return c.json({ photos: result })
  } catch (error) {
    console.error('Confirm photos error:', error)
    return c.json(
      { error: 'Failed to confirm photos', message: (error as Error).message },
      500
    )
  }
})

/**
 * Helper function to notify Durable Object about user changes
 */
async function notifyDO(c: Context<{ Bindings: Env }>, event: string, data: any): Promise<void> {
  try {
    const id = c.env.DURABLE_OBJECT.idFromName('default')
    const stub = c.env.DURABLE_OBJECT.get(id)
    await stub.fetch(new Request('http://do/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    }))
  } catch (err) {
    console.error('Error notifying Durable Object:', err)
  }
}

/**
 * GET /api/ws - WebSocket endpoint for real-time updates
 * Forwards to Durable Object for connection management
 */
app.get('/api/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade')

  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426)
  }

  // Forward WebSocket upgrade to Durable Object
  const id = c.env.DURABLE_OBJECT.idFromName('default')
  const stub = c.env.DURABLE_OBJECT.get(id)

  return stub.fetch(new Request('http://do/ws', {
    headers: c.req.raw.headers,
  }))
})
/**
 * GET /api - Root api endpoint - Used for health check
 */
app.get('/api', (c) => {
  return c.text('😁')
})

// Export Durable Object
export { Broadcaster }

// Export Worker fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx)
  },
}
