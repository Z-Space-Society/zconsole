/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // D1 Database binding
  DB: D1Database

  // Durable Object namespace for real-time WebSocket broadcasting
  DURABLE_OBJECT: DurableObjectNamespace

  // R2 photo storage (accessed via the S3 API with presigned URLs, not a binding).
  // All four come from `.env` — dev via [secrets] required in wrangler.toml, prod via
  // alchemy.(secret.)env bindings in alchemy.run.ts. One bucket serves dev and prod.
  R2_ACCOUNT_ID: string
  R2_BUCKET_NAME: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string

  // Comma-separated origins this Worker accepts Local First Auth JWTs for.
  // local-first-auth v3 signs with a per-origin key, so a JWT minted at another
  // origin carries a different DID — reject it (see shared/src/jwt.ts).
  ALLOWED_ORIGINS?: string
}
