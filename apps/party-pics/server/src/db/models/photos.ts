/**
 * Photo model - frame metadata for an event (bytes live in R2)
 */

import { eq, asc } from 'drizzle-orm'
import type { Database } from '../client.js'
import { photos, users, type Photo, type PhotoInsert } from '../schema.js'

// Re-export types
export type { Photo }

export interface PhotoWithUploader extends Photo {
  uploaderName: string | null
  uploaderAvatar: string | null
}

/**
 * Insert a batch of photo rows
 */
export async function addPhotos(db: Database, rows: PhotoInsert[]): Promise<Photo[]> {
  if (rows.length === 0) return []
  return await db.insert(photos).values(rows).returning()
}

/**
 * Get all photos for an event in capture order (oldest first = frame 01..N),
 * joined with the uploader's name + avatar.
 */
export async function getPhotosByEvent(db: Database, eventId: string): Promise<PhotoWithUploader[]> {
  const rows = await db
    .select({
      id: photos.id,
      eventId: photos.eventId,
      uploaderDid: photos.uploaderDid,
      r2Key: photos.r2Key,
      contentType: photos.contentType,
      width: photos.width,
      height: photos.height,
      createdAt: photos.createdAt,
      uploaderName: users.name,
      uploaderAvatar: users.avatar,
    })
    .from(photos)
    .leftJoin(users, eq(users.did, photos.uploaderDid))
    .where(eq(photos.eventId, eventId))
    .orderBy(asc(photos.createdAt))
    .limit(1000)

  return rows as PhotoWithUploader[]
}
