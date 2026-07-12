/**
 * Event model - one event = one "roll" of photos
 */

import { eq, desc, sql } from 'drizzle-orm'
import type { Database } from '../client.js'
import { events, photos, type Event } from '../schema.js'

// Re-export types
export type { Event }

export interface EventWithCount extends Event {
  photoCount: number
}

/**
 * Create a new event
 */
export async function createEvent(
  db: Database,
  values: { id: string; name: string; createdByDid: string }
): Promise<Event> {
  const [event] = await db.insert(events).values(values).returning()
  return event
}

/**
 * Get all events (most recent first) with their photo counts
 */
export async function getAllEvents(db: Database): Promise<EventWithCount[]> {
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      createdByDid: events.createdByDid,
      createdAt: events.createdAt,
      photoCount: sql<number>`count(${photos.id})`,
    })
    .from(events)
    .leftJoin(photos, eq(photos.eventId, events.id))
    .groupBy(events.id)
    .orderBy(desc(events.createdAt))
    .limit(1000)

  return rows as EventWithCount[]
}

/**
 * Get a single event by id
 */
export async function getEventById(db: Database, id: string): Promise<Event | undefined> {
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1)
  return event
}
