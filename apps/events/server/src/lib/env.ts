/**
 * Helpers for reading values off the Cloudflare Worker env bindings.
 *
 * The GCAL_ICS_URL binding has two runtime shapes (see server/src/types.ts and
 * docs/secrets.md): a Cloudflare Secrets Store secret (`.get()`) in production,
 * or a plain string from `.env` in local dev. `getGcalIcsUrl` normalizes both so
 * route handlers never branch on the shape.
 */

import type { Env } from '../types'

/** Resolve the Google Calendar iCal URL from either runtime binding shape. */
export async function getGcalIcsUrl(env: Env): Promise<string | undefined> {
  const binding = env.GCAL_ICS_URL
  if (!binding) return undefined
  return typeof binding === 'string' ? binding : binding.get()
}
