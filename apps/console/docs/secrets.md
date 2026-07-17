# Secrets & environment variables

How the host manages configuration in local dev and production. The canonical write-up
of the convention lives in `templates/mini-app-starter/docs/secrets.md`; this file
applies it to this app.

The host currently has **no runtime secrets** — just two buckets:

| Bucket | Here | Local dev source | Prod source |
|---|---|---|---|
| **Infra/deploy creds** | `ALCHEMY_STATE_TOKEN`, `ALCHEMY_STAGE`, `CLOUDFLARE_ACCOUNT_ID` | n/a (never reach the app runtime) | `.env`, read by `alchemy deploy` |
| **Non-secret vars** | `ALLOWED_ORIGINS` (env-varying) | committed literal in wrangler.toml `[vars]` | committed literal in alchemy.run.ts — **never via `.env`** (alchemy deploy loads `.env`; localhost origins would ship to prod) |

Copy `.env.example` → `.env` and fill it in. `.env` sets `ALCHEMY_STAGE=prod`, so
`pnpm deploy:cloudflare` from your machine targets **production**. `pnpm alchemy run`
is a read-only preflight that executes `alchemy.run.ts` without touching infra.

## Adding a secret later

Follow the four-step pattern in the canonical doc: add it to `.env` + `.env.example`,
list it under a new `[secrets] required` block in `wrangler.toml` (local dev), bind it
as `alchemy.secret.env.MY_SECRET` in `alchemy.run.ts` (prod; fails loud if unset), and
type it as `MY_SECRET?: string` in `server/src/types.ts`. The first secret also needs
`ALCHEMY_PASSWORD` in `.env` and `password: process.env.ALCHEMY_PASSWORD` on the
`alchemy()` init — keep the password stable across deploys. Never create a `.dev.vars`
file: its presence makes `wrangler dev` ignore `.env`.
