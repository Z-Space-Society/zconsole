# Secrets & environment variables

How this app manages configuration in local dev and production. Today there is one app
secret, `GCAL_ICS_URL` (the Google Calendar iCal feed — the private variant embeds a
`private-<token>` in the URL and must be treated like a password), but the same model
applies to any secret you add. The canonical write-up of the convention lives in
`templates/mini-app-starter/docs/secrets.md`; this file applies it to this app.

## The three buckets

| Bucket | Here | Local dev source | Prod source |
|---|---|---|---|
| **Infra/deploy creds** | `ALCHEMY_STATE_TOKEN`, `ALCHEMY_PASSWORD`, `ALCHEMY_STAGE`, `CLOUDFLARE_ACCOUNT_ID` | n/a (never reach the app runtime) | `.env`, read by `alchemy deploy` |
| **Runtime secrets** | `GCAL_ICS_URL` | `.env`, injected into `c.env` via `[secrets] required` in wrangler.toml | `alchemy.secret.env.GCAL_ICS_URL` binding in alchemy.run.ts (a Worker `secret_text`), seeded from `.env` at deploy |
| **Non-secret vars** | `ALLOWED_ORIGINS` (env-varying) | committed literal in wrangler.toml `[vars]` | committed literal in alchemy.run.ts — **never via `.env`** (alchemy deploy loads `.env`; localhost origins would ship to prod) |

## One env file: `.env`

There is a single, gitignored `.env` (copy `.env.example` → `.env` and fill it in),
read by two tools at two different times:

| Consumer | When | Reads from `.env` |
|----------|------|-------------------|
| `alchemy deploy` (Node) | deploy time | infra creds **and** `GCAL_ICS_URL` (to seed the Worker secret) |
| `wrangler dev` | local runtime | **only** `GCAL_ICS_URL` (via the `[secrets] required` gate) |

The gate keeps deploy creds out of the app runtime. A missing required key logs a
warning (dev stays runnable; the gcal sync just no-ops). **Never create a `.dev.vars`
file** — its presence makes `wrangler dev` ignore `.env` entirely.

Requires wrangler ≥ 4.77 and Node ≥ 22 (both pinned: `package.json` engines + `.nvmrc`).

Two more gate gotchas: with a `[secrets]` block present, wrangler also merges in your
shell environment (shell wins over `.env`), and a shell/`.env` key colliding with a
`[vars]` name (e.g. `ALLOWED_ORIGINS`) overrides the committed dev var.

## Production: a plain Worker secret

**Where do I set `GCAL_ICS_URL` for production? In the same `.env` file.** When you run
`pnpm deploy:cloudflare` (= `pnpm build && alchemy deploy`), Alchemy auto-loads `.env`
and binds the value as a Worker secret (`secret_text`) via
`GCAL_ICS_URL: alchemy.secret.env.GCAL_ICS_URL` in `alchemy.run.ts`. There is no
separate prod secrets file and no `wrangler secret put` step.

- **Fail-loud:** `alchemy.secret.env` throws if the var is unset, so a deploy aborts
  rather than silently shipping without the feed. There is no hardcoded fallback URL.
- **`ALCHEMY_PASSWORD` is required.** Alchemy encrypts the secret with it before
  writing state; a deploy with any secret aborts if it is unset. Keep it **stable
  across deploys** — changing it leaves Alchemy unable to decrypt stored secrets.
- **The same `GCAL_ICS_URL` serves local dev and prod.** To get full event details,
  use the **private** "Secret address in iCal format" (`.../private-<token>/basic.ics`)
  — note local dev then holds the private URL too. The public URL only ever yields
  "Busy"-only events, in dev *and* prod.
- **In CI** there is no `.env`; set the same vars as CI environment variables.
- `CLOUDFLARE_API_TOKEN` is a **legacy** requirement from the old Cloudflare Secrets
  Store setup (its API rejected OAuth creds). Keep it set until the deploy that tears
  the old store down has run; after that it can stay unset.

> **History:** this app previously stored `GCAL_ICS_URL` in the account-level
> Cloudflare Secrets Store (`SecretsStore`/`SecretRef`). It now uses a plain Worker
> secret; removing the store from `alchemy.run.ts` makes Alchemy delete it on the next
> deploy (automatic orphan cleanup). The binding is a plain `string` at runtime in both
> dev and prod — no `.get()` accessor needed.

## Rotating the secret

1. Update `GCAL_ICS_URL` in `.env`.
2. `pnpm deploy:cloudflare` — Alchemy updates the Worker secret.
3. Verify in the Cloudflare dashboard → the events Worker → Settings → Variables and
   Secrets.

## Adding a new secret

1. Add `MY_SECRET=` to `.env` and `.env.example`.
2. Add it to `[secrets] required` in `wrangler.toml` (so local dev loads it).
3. Bind it in `alchemy.run.ts`: `MY_SECRET: alchemy.secret.env.MY_SECRET`.
4. Add `MY_SECRET?: string` to the `Env` interface in `server/src/types.ts`.

## Deploy safety

`.env` sets `ALCHEMY_STAGE=prod`, so a deploy from your machine targets **production**.
`pnpm alchemy run` is a read-only preflight that proves `.env` is complete (every
`alchemy.secret.env.X` throws on a gap) without touching infra.
