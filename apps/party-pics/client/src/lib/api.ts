/** REST client for the Social Pics event/photo API. */

export interface EventItem {
  id: string
  name: string
  createdByDid: string
  createdAt: string
  photoCount: number
}

export interface Photo {
  id: string
  no: number
  url: string
  width: number | null
  height: number | null
  uploaderDid: string
  uploaderName: string | null
  uploaderAvatar: string | null
  createdAt: string
}

export interface EventDetail {
  event: { id: string; name: string; createdByDid: string; createdAt: string }
  photos: Photo[]
}

export interface PresignSlot {
  key: string
  uploadUrl: string
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function listEvents(): Promise<EventItem[]> {
  const data = await json<{ events: EventItem[] }>(await fetch('/api/events'))
  return data.events
}

export async function getEvent(eventId: string): Promise<EventDetail> {
  return json<EventDetail>(await fetch(`/api/events/${eventId}`))
}

export async function createEvent(profileJwt: string, name: string): Promise<EventItem> {
  return json<EventItem>(
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileJwt, name }),
    })
  )
}

export async function presignBatch(eventId: string, profileJwt: string, count: number): Promise<PresignSlot[]> {
  const data = await json<{ uploads: PresignSlot[] }>(
    await fetch(`/api/events/${eventId}/photos/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileJwt, count }),
    })
  )
  return data.uploads
}

export interface ConfirmPhoto {
  key: string
  contentType?: string
  width?: number
  height?: number
}

export async function confirmPhotos(eventId: string, profileJwt: string, photos: ConfirmPhoto[]): Promise<Photo[]> {
  const data = await json<{ photos: Photo[] }>(
    await fetch(`/api/events/${eventId}/photos/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileJwt, photos }),
    })
  )
  return data.photos
}
