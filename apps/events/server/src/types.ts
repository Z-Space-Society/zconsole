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
  // Dev: plain string from `.env` (gated by [secrets] required in wrangler.toml).
  // Prod: Worker secret bound via alchemy.secret.env in alchemy.run.ts.
  // See docs/secrets.md. Optional — sync no-ops when unset in local dev.
  GCAL_ICS_URL?: string

  // Comma-separated origins this Worker accepts Local First Auth JWTs for.
  // local-first-auth v3 signs with a per-origin key, so a JWT minted at another
  // origin carries a different DID — reject it (see shared/src/jwt.ts).
  ALLOWED_ORIGINS?: string
}
