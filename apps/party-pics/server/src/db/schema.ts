import { sql } from 'drizzle-orm'
import { text, index, sqliteTable, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  did: text('did').notNull().primaryKey(),
  name: text('name'),
  avatar: text('avatar'),
  socials: text('socials'), // JSON array of strings: ["platform:handle", "platform:handle"]
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt : integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_users_created_at').on(table.createdAt),
])

// Type inference for TypeScript
export type User = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert

/**
 * Events - one event = one "roll" of photos
 */
export const events = sqliteTable('events', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  createdByDid: text('created_by_did').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_events_created_at').on(table.createdAt),
])

export type Event = typeof events.$inferSelect
export type EventInsert = typeof events.$inferInsert

/**
 * Photos - a single frame uploaded to an event. Bytes live in R2; this is metadata only.
 */
export const photos = sqliteTable('photos', {
  id: text('id').notNull().primaryKey(),
  eventId: text('event_id').notNull(),
  uploaderDid: text('uploader_did').notNull(),
  r2Key: text('r2_key').notNull(),
  contentType: text('content_type'),
  width: integer('width'),
  height: integer('height'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_photos_event_id').on(table.eventId),
  index('idx_photos_created_at').on(table.createdAt),
])

export type Photo = typeof photos.$inferSelect
export type PhotoInsert = typeof photos.$inferInsert
