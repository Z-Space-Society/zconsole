import { sql } from 'drizzle-orm'
import { text, index, sqliteTable, integer, primaryKey } from 'drizzle-orm/sqlite-core'

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

/**
 * Events synced from the external Z-Space events feed.
 * Keyed on the upstream iCal `uid`.
 */
export const events = sqliteTable('events', {
  uid: text('uid').notNull().primaryKey(),
  summary: text('summary').notNull(),
  description: text('description'),
  startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
  endsAt: integer('ends_at', { mode: 'timestamp' }),
  location: text('location'),
  geo: text('geo'),
  organizerName: text('organizer_name'),
  organizerEmail: text('organizer_email'),
  lumaUrl: text('luma_url'), // parsed from description
  status: text('status'),
  source: text('source').notNull().default('feed'), // 'feed' (synced) or 'manual' (admin-added)
  contentHash: text('content_hash'), // per-event hash to skip no-op updates
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_events_starts_at').on(table.startsAt),
])

/**
 * Per-user saved events (personal bookmark list).
 */
export const eventSaves = sqliteTable('event_saves', {
  eventUid: text('event_uid').notNull(),
  userDid: text('user_did').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  primaryKey({ columns: [table.eventUid, table.userDid] }),
  index('idx_event_saves_user').on(table.userDid),
])

/**
 * Simple key/value store for sync bookkeeping (last upstream hash + last-synced epoch).
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').notNull().primaryKey(),
  value: text('value'),
})

// Type inference for TypeScript
export type User = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert
export type Event = typeof events.$inferSelect
export type EventInsert = typeof events.$inferInsert
