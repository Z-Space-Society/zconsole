/**
 * Google Calendar helper - parse an iCal (.ics) feed into our Event shape.
 *
 * A dedicated Google Calendar (z.space.vancouver@gmail.com) holds private
 * events that never appear in the upstream Luma feed. Google exposes each
 * calendar as an iCal URL, so we fetch it server-side and normalize every
 * VEVENT into the same shape the Luma/feed paths produce.
 *
 * Recurrence: a recurring event is a single VEVENT with an RRULE plus optional
 * RECURRENCE-ID overrides, so we expand it into concrete occurrences within a
 * bounded window. Because the `events` table is keyed on `uid`, expanded
 * instances get a compound uid (`${uid}::${occurrenceISO}`) to avoid PK
 * collisions between instances of the same series.
 */

import IcalExpander from 'ical-expander'

/** Normalized event ready to upsert into the `events` table (sans hashes). */
export interface ParsedIcsEvent {
  uid: string
  summary: string
  description: string | null
  startsAt: Date
  endsAt: Date | null
  location: string | null
  geo: string | null
  organizerName: string | null
  status: string | null
}

/** Only expand/keep occurrences within [now - 1 day, now + this many months]. */
const EXPAND_MONTHS = 6
const DAY_MS = 24 * 60 * 60 * 1000

function icalTimeToDate(t: any): Date | null {
  if (!t) return null
  try {
    const d = t.toJSDate()
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/** ICAL text values may be empty strings; normalize to a trimmed string or null. */
function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function statusOf(event: any): string | null {
  try {
    const s = event.component?.getFirstPropertyValue?.('status')
    return s ? String(s).toLowerCase() : null
  } catch {
    return null
  }
}

/** GEO in iCal is `latitude;longitude`; ical.js surfaces it as `[lat, lon]`. */
function geoOf(event: any): string | null {
  try {
    const g = event.component?.getFirstPropertyValue?.('geo')
    if (Array.isArray(g) && g.length === 2) return `${g[0]};${g[1]}`
    return cleanText(g)
  } catch {
    return null
  }
}

/** Prefer the ORGANIZER's display name (CN param) over its mailto value. */
function organizerNameOf(event: any): string | null {
  try {
    const prop = event.component?.getFirstProperty?.('organizer')
    const cn = prop?.getParameter?.('cn')
    if (cn) return cleanText(cn)
  } catch {
    /* ignore */
  }
  return null
}

/** Turn an ical.js Event (single or expanded occurrence) into our shape. */
function normalize(item: any, uid: string, startsAt: Date, endsAt: Date | null): ParsedIcsEvent | null {
  const status = statusOf(item)
  if (status === 'cancelled') return null

  const summary = cleanText(item.summary)
  if (!summary) return null

  return {
    uid,
    summary,
    description: cleanText(item.description),
    startsAt,
    endsAt,
    location: cleanText(item.location),
    geo: geoOf(item),
    organizerName: organizerNameOf(item),
    status,
  }
}

/**
 * Parse a raw ICS payload into normalized events within the expansion window.
 * Pure and deterministic given `now`, so it can be unit-tested against a fixture.
 */
export function parseIcsEvents(ics: string, now: Date = new Date()): ParsedIcsEvent[] {
  const after = new Date(now.getTime() - DAY_MS)
  const before = new Date(now.getTime())
  before.setMonth(before.getMonth() + EXPAND_MONTHS)

  const expander = new IcalExpander({ ics, maxIterations: 1000 })
  const { events, occurrences } = expander.between(after, before)

  const out: ParsedIcsEvent[] = []
  const seen = new Set<string>()

  // Non-recurring events: keyed on the plain VEVENT uid.
  for (const event of events) {
    const uid = cleanText(event.uid)
    const startsAt = icalTimeToDate(event.startDate)
    if (!uid || !startsAt || seen.has(uid)) continue
    const normalized = normalize(event, uid, startsAt, icalTimeToDate(event.endDate))
    if (normalized) {
      out.push(normalized)
      seen.add(uid)
    }
  }

  // Recurring occurrences: compound uid so each instance is its own row.
  for (const occ of occurrences) {
    const item = occ.item
    const baseUid = cleanText(item?.uid)
    const startsAt = icalTimeToDate(occ.startDate)
    if (!baseUid || !startsAt) continue
    const recurAt = icalTimeToDate(occ.recurrenceId) ?? startsAt
    const uid = `${baseUid}::${recurAt.toISOString()}`
    if (seen.has(uid)) continue
    const normalized = normalize(item, uid, startsAt, icalTimeToDate(occ.endDate))
    if (normalized) {
      out.push(normalized)
      seen.add(uid)
    }
  }

  return out
}
