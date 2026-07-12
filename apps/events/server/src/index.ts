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
import { parseLumaInput, fetchLumaEvent } from './lib/luma'
import { getGcalIcsUrl } from './lib/env'
import {
  decodeAndVerifyJWT,
  partsOf,
  whenText,
  rangeText,
  durationText,
  venueLabel,
  eventUrl,
  eventLinkLabel,
  urlHost,
} from '@zconsole/events-shared'

// Served under the /events subpath (Cloudflare route: console.z-space.ca/events/*),
// so every route is mounted under /events.
const app = new Hono<{ Bindings: Env }>().basePath('/events')

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
 * POST /api/events/add - Add a private/manual Luma event (admin only).
 * Accepts { profileJwt, url }, fetches details from Luma, and upserts the event.
 */
app.post('/api/events/add', async (c) => {
  try {
    const body = await c.req.json()
    const { profileJwt, url } = body

    if (!profileJwt) {
      return c.json({ error: 'Missing profileJwt' }, 400)
    }
    if (!url || typeof url !== 'string') {
      return c.json({ error: 'Missing or invalid url' }, 400)
    }

    // Verify JWT and confirm the user is an admin.
    const payload = await decodeAndVerifyJWT(profileJwt)
    const did = payload.iss
    const db = createDb(c.env.DB)
    if (!(await UserModel.isUserAdmin(db, did))) {
      return c.json({ error: 'Unauthorized: Admin access required' }, 403)
    }

    // Parse + fetch from Luma (user-facing errors → 400).
    let parsedInput
    try {
      parsedInput = parseLumaInput(url)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400)
    }

    let lumaEvent
    try {
      lumaEvent = await fetchLumaEvent(parsedInput)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400)
    }

    const event = await EventModel.addManualEvent(db, lumaEvent)
    await notifyDO(c, 'events-synced', {})

    return c.json({ event })
  } catch (error) {
    console.error('Add event error:', error)
    return c.json(
      { error: 'Failed to add event', message: (error as Error).message },
      500
    )
  }
})

/**
 * DELETE /api/events/:uid - Remove a manually-added event (admin only).
 * Only manual events can be removed; feed-synced events are protected.
 */
app.delete('/api/events/:uid', async (c) => {
  try {
    const uid = c.req.param('uid')
    const body = await c.req.json().catch(() => ({}))
    const { profileJwt } = body as { profileJwt?: string }

    if (!profileJwt) {
      return c.json({ error: 'Missing profileJwt' }, 400)
    }

    const payload = await decodeAndVerifyJWT(profileJwt)
    const did = payload.iss
    const db = createDb(c.env.DB)
    if (!(await UserModel.isUserAdmin(db, did))) {
      return c.json({ error: 'Unauthorized: Admin access required' }, 403)
    }

    const removed = await EventModel.deleteManualEvent(db, uid)
    if (!removed) {
      return c.json({ error: 'No manually-added event found with that id' }, 404)
    }

    await notifyDO(c, 'events-synced', {})
    return c.json({ success: true, uid })
  } catch (error) {
    console.error('Remove event error:', error)
    return c.json(
      { error: 'Failed to remove event', message: (error as Error).message },
      500
    )
  }
})

/**
 * GET /api/events - List all events (public).
 *
 * Lazily syncs from the external feed (throttled by TTL + content hash), then
 * returns every event ordered by start time.
 */
app.get('/api/events', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const gcalIcsUrl = await getGcalIcsUrl(c.env)

    const [feedChanged, gcalChanged] = await Promise.all([
      EventModel.syncEventsIfStale(db),
      EventModel.syncGcalIfStale(db, gcalIcsUrl),
    ])
    if (feedChanged || gcalChanged) {
      await notifyDO(c, 'events-synced', {})
    }

    const events = await EventModel.getEvents(db)
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
 * Flatten a DB event row into a TouchDesigner-friendly record: all primitive
 * fields with pre-formatted, civic-timezone date/time labels so a TD client can
 * map it straight into a Table DAT without re-implementing the formatting logic.
 */
function toTouchDesignerEvent(e: EventModel.Event) {
  const startISO = e.startsAt.toISOString()
  const endISO = e.endsAt ? e.endsAt.toISOString() : null
  const p = partsOf(startISO)
  const url = eventUrl(e)
  return {
    uid: e.uid,
    title: e.summary,
    status: e.status,
    description: e.description,
    startISO,
    endISO,
    startUnix: Math.floor(e.startsAt.getTime() / 1000),
    endUnix: e.endsAt ? Math.floor(e.endsAt.getTime() / 1000) : null,
    date: p.key,
    year: p.y,
    month: p.monLong,
    monthShort: p.monShort,
    dayOfMonth: p.d,
    dayOfWeek: p.dowLong,
    dayOfWeekShort: p.dowShort,
    startMinutes: p.minutes,
    when: whenText(startISO, endISO),
    timeRange: rangeText(startISO, endISO),
    duration: durationText(startISO, endISO),
    venue: venueLabel(e.location),
    organizer: e.organizerName,
    url,
    urlLabel: eventLinkLabel(url),
    urlHost: urlHost(url),
  }
}

/**
 * GET /api/events/touchdesigner - List all events (public) as a flat array of
 * pre-formatted records for easy consumption in TouchDesigner.
 *
 * Same lazy-sync behaviour as /api/events, but returns a bare JSON array rather
 * than the `{ events }` envelope.
 */
app.get('/api/events/touchdesigner', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const gcalIcsUrl = await getGcalIcsUrl(c.env)

    const [feedChanged, gcalChanged] = await Promise.all([
      EventModel.syncEventsIfStale(db),
      EventModel.syncGcalIfStale(db, gcalIcsUrl),
    ])
    if (feedChanged || gcalChanged) {
      await notifyDO(c, 'events-synced', {})
    }

    const events = await EventModel.getEvents(db)
    return c.json(events.map(toTouchDesignerEvent))
  } catch (error) {
    console.error('Error fetching touchdesigner events:', error)
    return c.json(
      { error: 'Failed to fetch events', message: (error as Error).message },
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

/**
 * SPA fallback: serve the client shell for any non-API navigation request so
 * deep links like /events/month load correctly. Cloudflare's asset
 * `not_found_handling` would otherwise serve the wrong root index.html.
 */
app.get('*', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/events/index.html'
  return c.env.ASSETS.fetch(new Request(url))
})

// Export Durable Object
export { Broadcaster }

// Export Worker fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx)
  },
}
