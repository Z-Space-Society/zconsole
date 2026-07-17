# ZConsole

The ZConsole host and its mini apps, in one pnpm workspace.

```
apps/
  console/      Host worker — landing grid at /, admin console. Owns the operator allowlist.
  events/       Events mini app, served at /events/
  party-pics/   Party photos mini app
templates/
  mini-app-starter/   The starter new apps are generated from. Yours to edit.
scripts/
  new-app.ts    `pnpm new-app <slug>`
```

Each app is a self-contained trio of packages (`client` / `server` / `shared`) with its
own `wrangler.toml` and `alchemy.run.ts`, so **apps still deploy independently** — the
monorepo changes how they're developed, not how they ship.

## Setup

```bash
pnpm install
```

Requires Node >= 22 (`.nvmrc`) and pnpm 10.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev:console` | Run the host console (worker :8787, vite :5173) |
| `pnpm dev:events` | Run the events app (worker :8788, vite :5174) |
| `pnpm dev:party-pics` | Run party-pics (worker :8789, vite :5175) |
| `pnpm build` | Build every app |
| `pnpm typecheck` | Typecheck every app |
| `pnpm new-app <slug>` | Scaffold a new mini app |

Each app has distinct ports, so you can run several at once.

Anything app-specific goes through a filter:

```bash
pnpm --filter @zconsole/events run db:generate-migrations
pnpm --filter @zconsole/events run deploy:cloudflare
```

## Secrets & env vars

Every app follows one convention, sorted by one question — does the value differ
between local dev and prod? Same-everywhere values (secrets and non-secrets) live in
`.env`, read by the wrangler `[secrets]` gate in dev and `alchemy.(secret.)env`
bindings at deploy; environment-differing values are committed literals (dev in
`wrangler.toml [vars]`, prod in `alchemy.run.ts`); infra creds stay in `.env` and are
never bound to the Worker. The canonical doc is
[`templates/mini-app-starter/docs/secrets.md`](templates/mini-app-starter/docs/secrets.md);
each app's `docs/secrets.md` applies it to that app.

## Adding a mini app

```bash
pnpm new-app check-in
```

This copies `templates/mini-app-starter` into `apps/check-in`, rescopes its packages to
`@zconsole/check-in-*`, names its Cloudflare resources `zconsole-check-in-mini-app`,
claims a free port pair, and installs.

It then prints the two things it can't do for you: prefixing the server's routes to
`/check-in/api/*`, and registering the app with the host console (which needs the real
D1 UUID from a first deploy). `apps/events` is the worked example for both;
`apps/console/docs/hosting-a-mini-app.md` is the contract.

## Why packages are scoped

All three apps were forked from the same starter, so they all shipped the *same* internal
package names (`@starter/shared`, `starter-client`, …). A pnpm workspace requires globally
unique names, so each app's packages are scoped to its own slug:

```
@zconsole/events          @zconsole/events-client
@zconsole/events-shared   @zconsole/events-server
```

`templates/mini-app-starter` is deliberately **excluded from the workspace** — it still
carries the generic `@starter/*` names, and installing it would reintroduce the collision.
`new-app` rescopes on copy.

The three `shared` packages are **not** merged into one. They've diverged: the console's
carries the `MANAGED_APPS` registry and app types; the mini apps' carry only JWT/date
helpers. Each app keeps its own.
