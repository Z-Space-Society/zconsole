# Secrets & environment variables

How this app manages configuration in local dev and production. The canonical write-up
of the convention lives in `templates/mini-app-starter/docs/secrets.md`; this file
applies it to this app.

## The three buckets

| Bucket | Here | Local dev source | Prod source |
|---|---|---|---|
| **Infra/deploy creds** | `ALCHEMY_STATE_TOKEN`, `ALCHEMY_PASSWORD`, `ALCHEMY_STAGE`, `CLOUDFLARE_ACCOUNT_ID` | n/a (never reach the app runtime) | `.env`, read by `alchemy deploy` |
| **Env-invariant runtime values** | secrets: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` · non-secrets: `R2_ACCOUNT_ID`, `R2_BUCKET_NAME` (one remote bucket serves dev and prod) | `.env`, injected into `c.env` via `[secrets] required` in wrangler.toml | bindings in alchemy.run.ts seeded from `.env` at deploy: `alchemy.secret.env.*` (secrets → Worker `secret_text`) / `alchemy.env.*` (non-secrets → plain vars) |
| **Env-varying non-secrets** | `ALLOWED_ORIGINS` | committed literal in wrangler.toml `[vars]` | committed literal in alchemy.run.ts — **never via `.env`** |

## One env file: `.env`

Copy `.env.example` → `.env` and fill it in. Two tools read it:

| Consumer | When | Reads from `.env` |
|----------|------|-------------------|
| `alchemy deploy` (Node) | deploy time | infra creds **and** the four R2 values (to seed the Worker bindings) |
| `wrangler dev` | local runtime | **only** the four R2 values (via the `[secrets] required` gate) |

**Never create a `.dev.vars` file** — its presence makes `wrangler dev` ignore `.env`
entirely. (This app used to keep the R2 keys in `.dev.vars`; they live in `.env` now.)

One remote R2 bucket serves both local dev and prod (photos never transit the Worker;
the browser talks to the bucket via presigned URLs). The R2 S3-API token (dashboard:
R2 → Manage API tokens) just needs access to that bucket.

## Production deploy

`pnpm deploy:cloudflare` binds all four R2 values from `.env` via `alchemy.secret.env.*`
(keys) and `alchemy.env.*` (account id, bucket name) in `alchemy.run.ts` — each
**throws if missing from `.env`**, so a deploy fails loud instead of shipping broken
presigning. `ALCHEMY_PASSWORD` is also required (Alchemy encrypts the secrets in its
state store); keep it stable across deploys.

`.env` sets `ALCHEMY_STAGE=prod`, so a deploy from your machine targets **production**.
`pnpm alchemy run` is a read-only preflight that proves `.env` is complete without
touching infra. Verify secrets in the Cloudflare dashboard → the party-pics Worker →
Settings → Variables and Secrets.

## Adding a new secret

1. Add `MY_SECRET=` to `.env` and `.env.example`.
2. Add it to `[secrets] required` in `wrangler.toml` (so local dev loads it).
3. Bind it in `alchemy.run.ts`: `MY_SECRET: alchemy.secret.env.MY_SECRET`.
4. Add `MY_SECRET?: string` to the `Env` interface in `server/src/types.ts`.
