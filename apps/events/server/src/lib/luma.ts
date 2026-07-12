/**
 * Luma helper - resolve a Luma event URL (or slug) into our Event shape.
 *
 * Private Luma events never appear in the upstream feed, so admins paste the
 * event URL and we fetch the details from Luma's public API server-side.
 *
 * Two URL forms are supported:
 *   - short link / calendar slug:  https://luma.com/6gdx4v9f
 *   - calendar modal w/ event id:  https://luma.com/zspace?e=evt-W0vUkOLF74yDT6G
 */

/** Normalized event ready to upsert into the `events` table (sans hashes/dates-as-dates). */
export interface ParsedLumaEvent {
  uid: string
  summary: string
  description: string | null
  startsAt: Date
  endsAt: Date | null
  location: string | null
  geo: string | null
  organizerName: string | null
  lumaUrl: string | null
  status: string | null
}

type LumaInput = { kind: 'apiId'; value: string } | { kind: 'slug'; value: string }

/**
 * Parse admin input (full URL or bare slug) into a Luma lookup.
 * Throws on anything that isn't a Luma link.
 */
export function parseLumaInput(input: string): LumaInput {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('No URL provided')

  // Bare event api id, e.g. "evt-W0vUkOLF74yDT6G"
  if (/^evt-[A-Za-z0-9]+$/.test(trimmed)) {
    return { kind: 'apiId', value: trimmed }
  }

  // Bare slug with no scheme/host/path, e.g. "6gdx4v9f" — treat as a Luma slug.
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { kind: 'slug', value: trimmed }
  }

  // Try to interpret as a URL; if it has no scheme, prepend one so URL() works.
  let url: URL
  try {
    url = new URL(/^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    throw new Error('Invalid URL')
  }

  const host = url.hostname.toLowerCase()
  const isLuma = host === 'luma.com' || host === 'lu.ma' || host.endsWith('.luma.com') || host.endsWith('.lu.ma')
  if (!isLuma) {
    throw new Error('Only Luma event URLs are supported')
  }

  // Prefer the explicit event id from the `?e=evt-...` modal form.
  const e = url.searchParams.get('e')
  if (e && /^evt-[A-Za-z0-9]+$/.test(e)) {
    return { kind: 'apiId', value: e }
  }

  // Otherwise use the first path segment as the slug, e.g. /6gdx4v9f or /zspace.
  const slug = url.pathname.split('/').filter(Boolean)[0]
  if (!slug) throw new Error('Could not find an event slug in the URL')
  return { kind: 'slug', value: slug }
}

/** Flatten Luma's ProseMirror `description_mirror` doc into plain text. */
function flattenProseMirror(node: any): string {
  if (!node || typeof node !== 'object') return ''
  if (typeof node.text === 'string') return node.text
  const children = Array.isArray(node.content) ? node.content : []
  const text = children.map(flattenProseMirror).join('')
  // Add a newline after block-level nodes so paragraphs stay separated.
  const isBlock = node.type === 'paragraph' || node.type === 'heading' || node.type === 'bulletList' || node.type === 'listItem'
  return isBlock ? `${text}\n` : text
}

function toDate(iso?: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Fetch and normalize a Luma event. Throws with a user-facing message on failure.
 */
export async function fetchLumaEvent(parsed: LumaInput): Promise<ParsedLumaEvent> {
  const endpoint =
    parsed.kind === 'apiId'
      ? `https://api.lu.ma/event/get?event_api_id=${encodeURIComponent(parsed.value)}`
      : `https://api.lu.ma/url?url=${encodeURIComponent(parsed.value)}`

  let json: any
  try {
    const res = await fetch(endpoint, { headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`Luma responded ${res.status}`)
    json = await res.json()
  } catch (err) {
    throw new Error(`Could not load the event from Luma: ${(err as Error).message}`)
  }

  // `/url` wraps the payload in `data`; `/event/get` returns it at the top level.
  const container = json?.data ?? json
  const event = container?.event
  if (!event?.api_id || !event?.name || !event?.start_at) {
    throw new Error('Luma did not return a recognizable event for that URL')
  }

  const startsAt = toDate(event.start_at)
  if (!startsAt) throw new Error('Event is missing a start time')

  // Organizer: the event creator if we can match them, else the calendar name.
  const guests: any[] = Array.isArray(container.featured_guests) ? container.featured_guests : []
  const creator = guests.find((g) => g?.api_id === event.user_api_id)
  const organizerName: string | null = creator?.name ?? container.calendar?.name ?? null

  const description = container.description_mirror
    ? flattenProseMirror(container.description_mirror).trim() || null
    : null

  const slug: string = event.url || (parsed.kind === 'slug' ? parsed.value : event.api_id)
  const location: string | null =
    event.geo_address_info?.full_address ?? event.geo_address_info?.address ?? null

  const coord = event.coordinate
  const geo: string | null =
    coord && typeof coord.latitude === 'number' && typeof coord.longitude === 'number'
      ? `${coord.latitude};${coord.longitude}`
      : null

  return {
    uid: event.api_id,
    summary: event.name,
    description,
    startsAt,
    endsAt: toDate(event.end_at),
    location,
    geo,
    organizerName,
    lumaUrl: `https://luma.com/${slug}`,
    status: event.visibility ?? null,
  }
}
