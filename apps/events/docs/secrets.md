# Secrets

How this app manages secrets locally and in production. Today there is one app secret,
`GCAL_ICS_URL` (the Google Calendar iCal feed — the private variant embeds a
`private-<token>` in the URL and must be treated like a password), but the same model
applies to any secret you add.

## One env file: `.env`

There is a single, gitignored `.env` file at the repo root. It is read by **two different
tools at two different times**:

| Consumer | When | Reads from `.env` |
|----------|------|-------------------|
| `alchemy deploy` (Node) | deploy time | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `ALCHEMY_STATE_TOKEN`, `ALCHEMY_STAGE`, `ALCHEMY_PASSWORD` (infra creds) **and** `GCAL_ICS_URL` (to seed the Secrets Store) |
| `wrangler dev` | local runtime | **only** `GCAL_ICS_URL` (see the gate below) |

Copy `.env.example` → `.env` and fill it in. There is intentionally **no `.dev.vars`** file —
if one exists, `wrangler dev` ignores `.env` for local vars, which would break this model.

### The `secrets.required` gate

`wrangler.toml` declares:

```toml
[secrets]
required = ["GCAL_ICS_URL"]
```

In local dev, `wrangler dev` loads **only** the keys listed here from `.env` into the Worker
env (`c.env`). This keeps the deploy/infra credentials (`ALCHEMY_STATE_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `ALCHEMY_STAGE`) **out** of the app runtime. A missing required key
logs a warning (dev stays runnable; the gcal sync just no-ops).

Requires wrangler ≥ 4.77 and Node ≥ 22 (both pinned: `package.json` engines + `.nvmrc`).

## Production: Cloudflare Secrets Store

### Where do I set `GCAL_ICS_URL` for production?

**In the root `.env` file** — the same file used for local dev. When you run
`pnpm deploy:cloudflare` (`= pnpm build && alchemy deploy`), Alchemy auto-loads `.env`,
reads `GCAL_ICS_URL` from it, and seeds it into the Cloudflare Secrets Store. Your `.env`
already has `ALCHEMY_STAGE=prod`, so a deploy from your machine targets **production**.

There is **no separate prod secrets file** and no `wrangler secret put` step — `.env` is the
single place you set the value, and `alchemy deploy` pushes it.

**`ALCHEMY_PASSWORD` is required.** Alchemy encrypts `GCAL_ICS_URL` with this password before
writing it to its state store, so a deploy with any secret **aborts** if it is unset (`Cannot
serialize secret without password`). Set it in `.env` locally (and as a CI env var — see
below) and keep it **stable across deploys**: changing it later leaves Alchemy unable to
decrypt previously-stored secrets.

**Deploys require a Cloudflare API token, not `wrangler login`.** Alchemy's Secrets Store
API rejects OAuth tokens (`secrets_store list requires API token authentication`), so set
`CLOUDFLARE_API_TOKEN` in `.env`. Create a custom token at
<https://dash.cloudflare.com/profile/api-tokens> with these account-scoped permissions:
**Workers Scripts: Edit**, **D1: Edit**, **Secrets Store: Edit**, **Account Settings: Read**
(add **Workers R2 Storage: Edit** if the token is otherwise rejected). CI must set this too —
it has no `wrangler login` session at all.

Two things to know:

- **The same `GCAL_ICS_URL` value serves both local dev and production.** To get full event
  details in prod, put the **private** "Secret address in iCal format"
  (`.../private-<token>/basic.ics`) in `.env` — note this means local dev will use the
  private URL too. The public URL only ever yields "Busy"-only events, in dev *and* prod.
- **In CI**, there is no checked-in `.env`; set `GCAL_ICS_URL` (and the Alchemy/CF creds) as
  CI environment variables instead — `alchemy.secret.env` reads from `process.env` either way.

### How it works

Production does **not** use a per-Worker `secret_text`. Instead the secret lives in
Cloudflare's account-level **Secrets Store**, managed through Alchemy (`alchemy.run.ts`):

```ts
// Create/adopt the store and seed the value from the deploy env.
// alchemy.secret.env.GCAL_ICS_URL THROWS if the var is unset -> deploy fails loud.
const secretsStore = await SecretsStore(`${app.name}-secrets`, {
  name: `${app.name}-${app.stage}-secrets`,
  adopt: true,
  secrets: { GCAL_ICS_URL: alchemy.secret.env.GCAL_ICS_URL },
})

// Bind an individual secret to the Worker (secrets_store_secret binding).
const gcalIcsUrlRef = await SecretRef({ name: 'GCAL_ICS_URL', store: secretsStore })
// ...
bindings: { /* ... */ GCAL_ICS_URL: gcalIcsUrlRef }
```

Flow: `.env` → `alchemy deploy` → `SecretsStore` (CF Secrets Store, encrypted at the edge) →
`SecretRef` binding → runtime `await env.GCAL_ICS_URL.get()`.

### Fail-loud

Deploying with `GCAL_ICS_URL` unset **aborts** the deploy (`alchemy.secret.env` throws) rather
than silently shipping the public "Busy"-only feed. There is no hardcoded fallback URL.

## Runtime: two shapes, one accessor

The binding has two runtime shapes — a plain string in local dev, a `secrets_store_secret`
object (`.get()`) in production. `server/src/lib/env.ts` normalizes both so route handlers
never branch:

```ts
export async function getGcalIcsUrl(env: Env): Promise<string | undefined> {
  const binding = env.GCAL_ICS_URL
  if (!binding) return undefined
  return typeof binding === 'string' ? binding : binding.get()
}
```

## Rotating the secret

1. Update `GCAL_ICS_URL` in `.env`.
2. `pnpm deploy:cloudflare` — Alchemy updates the value in the Secrets Store.
3. Verify: `pnpm wrangler secrets-store store list`, then
   `pnpm wrangler secrets-store secret list <store-id>`.

## Adding a new secret

1. Add `MY_SECRET=` to `.env` and `.env.example`.
2. Add it to `[secrets] required` in `wrangler.toml` (so local dev loads it).
3. Seed + bind it in `alchemy.run.ts` (add to the `SecretsStore` `secrets` map and add a
   `SecretRef` binding), and add it to the `Env` interface in `server/src/types.ts`.

## Need Cloudflare API token?

1. Go to <https://dash.cloudflare.com/profile/api-tokens>
2. Create a new token
3. Give it the following permissions:
   - **Workers Scripts: Edit**
   - **D1: Edit**
   - **Secrets Store: Edit**
   - **Account Settings: Read**
   - **Workers R2 Storage: Edit**
4. Copy the token and paste it into your `.env` file as `CLOUDFLARE_API_TOKEN`