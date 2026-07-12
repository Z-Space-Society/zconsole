# Photos

Photos for your events

## What it is

Photos is a mobile-first app for capturing and sharing photos from your in-person events. Each event is a single "roll of film": create an event, then everyone there snaps photos that drop straight onto a shared, live-updating contact strip with a film/darkroom aesthetic — numbered frames, sprocket rails, grain and all. Tap any frame for a full-size polaroid view you can download.

It's built on the [Mini App Starter](#built-on-the-mini-app-starter) template, so signup, auth, the database, real-time updates, and free Cloudflare hosting are all wired up for you.

### Features

- **Passwordless sign-in** — no email, no passwords. Onboarding is handled by [Local First Auth](./docs/local-first-auth-spec.md).
- **Events as film rolls** — create a named event; anyone can add photos to it.
- **Direct-to-storage uploads** — photos upload straight from the browser to Cloudflare R2 via presigned URLs (the Worker never proxies the bytes).
- **Live gallery** — new photos and users appear in real time over WebSocket.
- **Film aesthetic** — 35mm contact strip, numbered frames, date stamps, polaroid detail view.
- **Free hosting** — deploys to Cloudflare Workers, D1, Durable Objects, and R2.

### Screens

| Route | Screen | What it does |
|-------|--------|--------------|
| `/` | Home | Lists current events (last 2 weeks) and past events; "New event" button |
| `/create-event` | Create Event | Name and create a new event ("roll") |
| `/events/:eventId` | Gallery | Contact strip of all photos in the event; upload more via the shutter button |
| `/events/:eventId/:photoId` | Detail | Full-size polaroid view of one photo, with a download button |

### How it works

1. The React client requests a batch of presigned R2 upload URLs from the Worker (`POST /api/events/:eventId/photos/presign`).
2. The browser **PUTs the photo bytes directly to R2** using those URLs — no Worker bottleneck.
3. The client confirms the uploads (`POST /api/events/:eventId/photos/confirm`); the Worker writes photo **metadata** (uploader, dimensions, R2 key) to D1. Image bytes live in R2; D1 holds only metadata.
4. A single Durable Object (`Broadcaster`) broadcasts updates to every connected client over WebSocket so galleries stay live.

---

## Running it locally

### 1. Clone and install

This project uses [pnpm](https://pnpm.io). If you don't have it: `brew install pnpm`.

```bash
git clone https://github.com/your-username/zconsole-party-pics-mini-app.git
cd zconsole-party-pics-mini-app
pnpm install
```

### 2. Configure photo storage (Cloudflare R2)

Photos are stored in an R2 bucket and accessed over the S3 API with presigned URLs. Create a bucket in the Cloudflare dashboard, then provide its details:

- In `wrangler.toml`, under `[vars]`, set `R2_ACCOUNT_ID` and `R2_BUCKET_NAME` (the dev default is `party-pics-dev`).
- In a `.dev.vars` file (gitignored), add your R2 S3 credentials:

```bash
# .dev.vars
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
```

See the comments in `wrangler.toml` for the source of truth on which values go where.

### 3. Run database migrations

```bash
pnpm db:run-migrations    # Initialize / run migrations on the local D1 database
```

### 4. Start the dev server

```bash
pnpm dev                  # Start the development server
pnpm dev:simulator        # ...or start with a simulated test user (skips QR onboarding)
```

---

## Deploy to Cloudflare

This project uses [Alchemy](https://alchemy.run) to deploy to Cloudflare. If you don't have it installed: `brew install alchemy`.

Configure a Cloudflare API token for Alchemy (see the [Alchemy CLI docs](https://alchemy.run/docs/cli/configuration)):

```bash
pnpm alchemy configure
```

Copy `.env.example` to `.env` and set `ALCHEMY_STATE_TOKEN` (used to store deployment state remotely). Make sure your **production** R2 bucket and credentials are configured the same way as in development (bucket name in the Alchemy/Worker config, credentials as Worker secrets).

Then deploy:

```bash
pnpm run deploy:cloudflare
```

Migrations are applied automatically during deploy — no manual step needed.

---

## Built on the Mini App Starter

Photos is built on the **Mini App Starter** template — a starter for self-hosting small mini apps for your in-person events, social clubs, and game nights, with signup/auth, a SQLite (D1) database, REST API, and real-time WebSocket updates already wired up.

Want to fork this into a different app? Use `pnpm setup-project {app-name}` to rename the template (see [docs/project-setup.md](./docs/project-setup.md)), browse [docs/mini-app-examples.md](./docs/mini-app-examples.md) for reference apps, and follow [CLAUDE.md](./CLAUDE.md) for the full development guide.

## Project Structure

This is a pnpm workspace monorepo with three packages:

- `client/` — React frontend (routes, film-aesthetic components, QR panel)
- `server/` — Cloudflare Workers, D1 (SQLite), Durable Objects (WebSocket), and R2 photo storage (`server/src/r2.ts`)
- `shared/` — Shared utilities (JWT verification)

## Documentation

- [CLAUDE.md](./CLAUDE.md) — Development guide for Claude Code
- [Local First Auth Specification](./docs/local-first-auth-spec.md) — Auth spec used for signup and login
- [Mini App Examples](./docs/mini-app-examples.md) — Reference mini apps you can learn from
- [Admin Setup](./docs/admin-setup.md) — How to set up an admin user
