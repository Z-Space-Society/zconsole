/**
 * A Cloudflare Secrets Store secret binding, resolved via an async `.get()`.
 * This is the runtime shape of a `secrets_store_secret` binding in production.
 */
export type SecretsStoreSecret = { get(): Promise<string> }

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // D1 Database binding
  DB: D1Database

  // Durable Object namespace for real-time WebSocket broadcasting
  DURABLE_OBJECT: DurableObjectNamespace

  // Static assets binding (client build); used to serve the SPA shell
  ASSETS: Fetcher

  // Google Calendar iCal (.ics) URL for syncing private events (source='gcal').
  // Two runtime shapes (resolve via getGcalIcsUrl in lib/env.ts):
  //  - Production: a Cloudflare Secrets Store binding (async `.get()`).
  //  - Local dev:  a plain string loaded from `.env` (gated by secrets.required
  //    in wrangler.toml). See docs/secrets.md. Optional — sync no-ops when unset.
  GCAL_ICS_URL?: string | SecretsStoreSecret
}
