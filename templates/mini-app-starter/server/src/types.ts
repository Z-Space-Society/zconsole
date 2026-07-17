/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // D1 Database binding
  DB: D1Database

  // Durable Object namespace for real-time WebSocket broadcasting
  DURABLE_OBJECT: DurableObjectNamespace

  // Comma-separated origins this Worker accepts Local First Auth JWTs for.
  // local-first-auth v3 signs with a per-origin key, so a JWT minted at another
  // origin carries a different DID — reject it (see shared/src/jwt.ts).
  ALLOWED_ORIGINS?: string

  // Example runtime secret (see docs/secrets.md for the full add-a-secret pattern).
  // Dev: plain string from `.env` via [secrets] required in wrangler.toml.
  // Prod: Worker secret bound via alchemy.secret.env in alchemy.run.ts.
  // MY_SECRET?: string
}
