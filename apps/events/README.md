# ZConsole Events Mini App

A real-time events mini app for [Z-Space](https://z-space.ca) (Gastown, Vancouver). It syncs the community event feed automatically and lets admins add private Luma events that aren't in the feed.

## What it does

- **Upcoming view** — events from today forward, grouped by date, with a live "now" indicator and a **Private** badge on manually-added events.
- **This-month view** — a calendar grid with per-day event dots and a detail list for the selected day.
- **Event detail** — a slide-out panel with host, time and duration, location, a cleaned-up description, and an **RSVP** link to the Luma event page.
- **Auto-sync** — pulls from the Z-Space events feed (`https://zeevents.z-space.workers.dev/events`) on demand, throttled to once per 5 minutes and only writing when the feed content actually changes.
- **Admin tools** — add a private Luma event by pasting its URL, remove manually-added events, and reset non-admin users.
- **TouchDesigner endpoint** — `GET /api/events/touchdesigner` returns flattened JSON with pre-formatted date/time labels for installations and displays.
- **Real-time updates** — clients receive live updates over WebSocket as events sync and users join/leave.

Feed-synced events are read-only; only manually-added (`source: 'manual'`) events can be removed.

## Screens

| Screen | Route | Notes |
|--------|-------|-------|
| Upcoming | `/` | Events from today forward, grouped by date |
| This month | `/month` | Calendar grid with day detail list |
| Event detail | — | Slide-out panel, opened from either screen |
| Admin panel | — | Slide-out, visible only to admins |

## Running locally

This project uses pnpm. If you don't have it: `brew install pnpm`.

```bash
pnpm install
pnpm db:run-migrations    # initialize / run migrations on the local D1 database
pnpm dev                  # start the dev server
pnpm dev:simulator        # or start with a simulated test user (no QR scan needed)
```

## Admin setup

Admins are users with `isAdmin = true` in the database. To promote yourself, complete the onboarding flow at `/new-user` to get your DID (with a copy button), then set the flag for that DID. See [docs/admin-setup.md](./docs/admin-setup.md) for full instructions.

## Deploying

Deployment uses [Alchemy](https://alchemy.run) to deploy to Cloudflare Workers.

```bash
pnpm alchemy configure          # configure a Cloudflare API token (see Alchemy CLI docs)
```

Copy `.env.example` to `.env` and set `ALCHEMY_STATE_TOKEN` (used to store deployment state in a remote state store). Then:

```bash
pnpm run deploy:cloudflare
```

Database migrations are applied automatically by `alchemy.run.ts` on deploy.

## API reference

All endpoints are served under `/api`.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/events` | List events (syncs from the feed if stale) | Public |
| `GET` | `/api/events/touchdesigner` | Flattened event JSON for TouchDesigner | Public |
| `POST` | `/api/events/add` | Add a private Luma event by URL | Admin |
| `DELETE` | `/api/events/:uid` | Remove a manually-added event | Admin |
| `POST` | `/api/reset` | Clear non-admin users + broadcast a message | Admin |
| `POST` | `/api/add-user` | Add or update a user profile | JWT |
| `POST` | `/api/add-avatar` | Add or update a user avatar | JWT |
| `DELETE` | `/api/remove-user` | Remove the current user | JWT |
| `GET` | `/api/users` | List all users | Public |
| `GET` | `/api/ws` | WebSocket connection for real-time updates | Public |
| `GET` | `/api` | Health check | Public |

## Built on the mini-app starter

This app is built on a mini-app starter template that bundles authentication and a full-stack setup so you can focus on the app itself:

- **Signup/login built-in** via [Local First Auth](./docs/local-first-auth-spec.md) — no passwords, email, or auth code to write.
- **Full-stack out of the box** — REST API, SQLite (Cloudflare D1) database, and real-time updates over WebSocket (Cloudflare Durable Objects).
- **Free hosting** — Cloudflare's free tier comfortably covers multiple mini apps.

### Project structure

This is a pnpm workspace monorepo with three packages:

- `client/` — React frontend
- `server/` — Cloudflare Workers, D1 (SQLite), Durable Objects
- `shared/` — Shared utilities (JWT verification)

### Documentation

- [CLAUDE.md](./CLAUDE.md) — development guide (architecture, commands, database, deployment)
- [Local First Auth Specification](./docs/local-first-auth-spec.md) — auth spec used for signup/login
- [Admin setup](./docs/admin-setup.md) — how to grant admin access
- [Mini App Examples](./docs/mini-app-examples.md) — reference examples of other mini apps
