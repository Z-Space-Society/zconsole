/**
 * Date / time helpers. Events arrive as UTC ISO strings; the venue is in
 * Vancouver, so everything is rendered in America/Vancouver civic time.
 */

const TZ = 'America/Vancouver'

const numFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const shortFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short' })
const longFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long', month: 'long' })

export interface DateParts {
  y: number
  mo: number // 1-12
  d: number
  hour: number // 0-23
  minute: number
  minutes: number // minutes since midnight
  key: string // YYYY-MM-DD (Vancouver civic date)
  dowShort: string // Mon
  dowLong: string // Monday
  monShort: string // May
  monLong: string // May -> "May" (full month name)
}

export function partsOf(input: Date | string): DateParts {
  const date = typeof input === 'string' ? new Date(input) : input
  const p = numFmt.formatToParts(date)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '0'
  const y = Number(get('year'))
  const mo = Number(get('month'))
  const d = Number(get('day'))
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))
  const sp = shortFmt.formatToParts(date)
  const lp = longFmt.formatToParts(date)
  const sget = (t: string, parts: Intl.DateTimeFormatPart[]) =>
    parts.find((x) => x.type === t)?.value ?? ''
  return {
    y,
    mo,
    d,
    hour,
    minute,
    minutes: hour * 60 + minute,
    key: `${y}-${pad(mo)}-${pad(d)}`,
    dowShort: sget('weekday', sp),
    dowLong: sget('weekday', lp),
    monShort: sget('month', sp),
    monLong: sget('month', lp),
  }
}

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function meridiem(minutes: number): 'am' | 'pm' {
  return minutes >= 720 ? 'pm' : 'am'
}

/** "6:30" style label (12-hour, no leading zero on hour, ":mm" only when non-zero). */
export function timeLabel(p: DateParts): string {
  let h = p.hour % 12
  if (h === 0) h = 12
  return p.minute ? `${h}:${pad(p.minute)}` : `${h}`
}

export function meridiemLabel(p: DateParts): 'am' | 'pm' {
  return meridiem(p.minutes)
}

/** "6:30–9:30pm" — start meridiem only shown when it differs from end's. */
export function rangeText(startsAt: string, endsAt: string | null): string {
  const s = partsOf(startsAt)
  const sLabel = timeLabel(s)
  const sm = meridiem(s.minutes)
  if (!endsAt) return `${sLabel}${sm}`
  const e = partsOf(endsAt)
  const eLabel = timeLabel(e)
  const em = meridiem(e.minutes)
  return `${sLabel}${sm === em ? '' : sm}–${eLabel}${em}`
}

export function durationText(startsAt: string, endsAt: string | null): string {
  if (!endsAt) return ''
  const m = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)
  if (m <= 0) return ''
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const r = m % 60
    return r ? `${h} hr ${r} min` : `${h} hr`
  }
  return `${m} min`
}

/** "Thu 29 May · 6:30–9:30pm" */
export function whenText(startsAt: string, endsAt: string | null): string {
  const s = partsOf(startsAt)
  return `${s.dowShort} ${s.d} ${s.monShort} · ${rangeText(startsAt, endsAt)}`
}

export function nowParts(): DateParts {
  return partsOf(new Date())
}

/** Compare two YYYY-MM-DD keys. */
export function keyCmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Deterministic muted color for an organizer/host name (initials avatar). */
const HOST_COLORS = [
  '#7c8466', '#6b7c93', '#a86f6f', '#5f7e6b', '#a87c5f',
  '#7e7194', '#6f8c8a', '#8a7c5f', '#9c6f7e', '#6f8c7a',
]
export function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return HOST_COLORS[h % HOST_COLORS.length]
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Friendly venue label. The feed's `location` is sometimes a street address and
 * sometimes a bare Luma URL; collapse the known Z-Space address to "Z-Space".
 */
export function venueLabel(location: string | null): string {
  if (!location) return 'Z-Space'
  if (location.startsWith('http')) return 'Z-Space'
  if (location.includes('505 Hamilton')) return 'Z-Space · Gastown'
  return location
}

/**
 * The outbound event / RSVP link. The feed's `location` is often a *direct*
 * registration URL (Eventbrite, Meetup, a specific Luma event, etc.) — prefer it;
 * otherwise fall back to the Luma link parsed from the description.
 */
export function eventUrl(e: { location: string | null; lumaUrl: string | null }): string | null {
  if (e.location && /^https?:\/\//i.test(e.location)) return e.location
  return e.lumaUrl
}

/** Host-aware label so the link isn't mislabeled "Luma" for an Eventbrite/Meetup event. */
export function eventLinkLabel(url: string | null): string {
  if (!url) return 'View event page'
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'View event page'
  }
  if (host.endsWith('luma.com')) return 'View on Luma'
  if (host.includes('eventbrite')) return 'View on Eventbrite'
  if (host.endsWith('meetup.com')) return 'View on Meetup'
  return 'View event page'
}

/** Bare hostname for display (e.g. "eventbrite.ca"). */
export function urlHost(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
