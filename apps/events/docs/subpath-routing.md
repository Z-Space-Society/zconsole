# Serving a Mini App Under a Subpath (e.g. `/chat`)

A portable guide for converting a Local-First-Auth mini app from being served at the
root (`/`) to being served under a **subpath** like `domain.com/chat/*`, with deep links
that survive a hard refresh.

## What this does / when you need it

By default the starter serves the app at `/` and all API/WebSocket calls hit `/api/*`.
That breaks when your Cloudflare Worker is mounted at a route like
`domain.com/<base>/*` (multiple mini apps living behind one domain). In that setup:

- The client must be **built and served under `/<base>/`** (HTML, JS, CSS, asset URLs).
- Every API/WS call must target `/<base>/api/...`, not `/api/...`.
- Deep links (e.g. `/<base>/settings`) must load the right SPA shell on a **hard refresh**,
  not Cloudflare's root `index.html`.

> **Convention:** Replace `<base>` everywhere below with your subpath (no slashes),
> e.g. `chat`. Use the **same** value in every file — a mismatch silently breaks routing.

The work splits into two parts:

| Group | What | Portable? |
|-------|------|-----------|
| **1 — Subpath deployment** | base path, API/WS URLs, Hono mount, SPA fallback, build config | ✅ Mechanical / app-agnostic — do all of it |
| **2 — Router refactor** | turn in-memory tab state into real nested routes | ⚠️ App-specific — adapt to how your app structures screens |

If your app already uses React Router with real URLs per screen, you may only need
Group 1 plus the `basename` change in 2a.

---

## Group 1 — Subpath deployment (do all of this)

### 1a. `client/vite.config.ts`

Add `base`, a nested `build.outDir`, and update the dev proxy to the subpath.

```ts
export default defineConfig({
  base: '/<base>/',                       // ← add
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/<base>',                // ← add: assets served at /<base>/assets/...
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/<base>/api': {                    // ← was '/api'
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,                         // WebSocket proxying for /<base>/api/ws
      },
    },
  },
})
```

### 1b. `client/src/lib/api.ts` — NEW file (copy verbatim)

Single source of truth for the base path. `import.meta.env.BASE_URL` is `/<base>/`,
so `BASE` becomes `/<base>`. This keeps every URL in sync with Vite's `base`.

```ts
// Centralizes the deployment base path so API and WebSocket URLs stay in sync
// with the Vite `base` (the app is served under /<base>).
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export const apiUrl = (path: string) => `${BASE}${path}`

export const wsUrl = (path: string) => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${BASE}${path}`
}
```

### 1c. Route every fetch / WebSocket call through the helpers

Grep the client for `fetch('/api` and `new WebSocket(` and convert **all** of them.

```ts
// before
const res = await fetch('/api/add-user', { ... })

// after
import { apiUrl } from '../lib/api'        // adjust relative depth
const res = await fetch(apiUrl('/api/add-user'), { ... })
```

```ts
// before
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`)

// after
import { wsUrl } from '../lib/api'
const ws = new WebSocket(wsUrl('/api/ws'))
```

In the reference (events) app these files were touched: `hooks/useLocalFirstAuth.tsx`,
`hooks/useWebSockets.ts`, `components/AdminSection.tsx`, and the feature hook that fetches
data. **Your file list will differ — let grep be the source of truth.**

### 1d. `client/index.html`

Prefix root-absolute static asset links with `%BASE_URL%` (Vite substitutes it at build):

```html
<!-- before -->
<link rel="icon" type="image/svg+xml" href="/icon.webp" />
<link rel="local-first-auth-manifest" href="/local-first-auth-manifest.json" />

<!-- after -->
<link rel="icon" type="image/svg+xml" href="%BASE_URL%icon.webp" />
<link rel="local-first-auth-manifest" href="%BASE_URL%local-first-auth-manifest.json" />
```

### 1e. `server/src/index.ts`

Mount the entire Hono app under the subpath, and add a **SPA fallback** as the **last**
route (after every API route, before exporting the Durable Object).

```ts
// mount everything under /<base>
const app = new Hono<{ Bindings: Env }>().basePath('/<base>')

// ... all your API routes ...

// SPA fallback: serve the client shell for any non-API navigation so deep links
// like /<base>/settings load correctly on hard refresh. Without this, Cloudflare's
// asset not_found_handling serves the wrong root index.html.
app.get('*', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/<base>/index.html'
  return c.env.ASSETS.fetch(new Request(url))
})

export { Broadcaster }   // your Durable Object export
```

### 1f. `server/src/types.ts`

Add the static-assets binding used by the fallback:

```ts
export interface Env {
  DB: D1Database
  DURABLE_OBJECT: DurableObjectNamespace
  ASSETS: Fetcher        // ← add: client build, used to serve the SPA shell
}
```

### 1g. `alchemy.run.ts`

Bind the assets to the Worker and make the Worker handle API + deep-link misses.

```ts
const staticAssets = await Assets({
  path: './client/dist',          // stays ./client/dist — the /<base> subfolder
})                                 // comes from Vite's build.outDir (1a)

export const worker = await Worker('worker', {
  // ...
  bindings: {
    DB: database,
    DURABLE_OBJECT: durableObject,
    ASSETS: staticAssets,         // ← add
  },
  assets: {
    html_handling: 'auto-trailing-slash',
    // API/WS must hit the Worker first; other asset misses fall through to the
    // Worker's app.get('*') fallback (1e), which serves /<base>/index.html.
    run_worker_first: ['/<base>/api/*'],   // ← add
    // ← REMOVE: not_found_handling: 'single-page-application'
    //   (the Worker fallback replaces it; leaving it serves the wrong root index.html)
  },
  url: true,
})
```

---

## Group 2 — Router refactor (app-specific: deep-linkable screens)

Only needed if your app currently switches screens with in-memory state
(`const [screen, setScreen] = useState(...)`). Goal: each screen gets a real URL under
`/<base>` so it's deep-linkable and refresh-safe. Adapt names to your app.

### 2a. `client/src/routes/index.tsx` — tell the router about the subpath

Pass `basename` and nest screen routes under your layout via an `Outlet`.

```ts
export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        {
          element: <Layout />,                    // your shell with the nav bar
          children: [
            { index: true, element: <ScreenA /> },
            { path: 'screen-b', element: <ScreenB /> },
            { path: 'screen-c', element: <ScreenC /> },
          ],
        },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: '/<base>' }                          // ← critical
)
```

> If you only had a single root screen, the minimal change is just adding
> `{ basename: '/<base>' }` — you don't have to nest anything.

### 2b. Layout component — render `<Outlet>` instead of conditional screens

Pass shared data/callbacks down through the Outlet `context`, and swap tab buttons for
`<NavLink>`.

```tsx
import { NavLink, Outlet } from 'react-router-dom'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `navbtn${isActive ? ' is-on' : ''}`

// inside the screen container:
<Outlet context={{ data, onOpen, onToggle } satisfies LayoutOutletContext} />

// nav: was <button onClick={() => setScreen('screen-b')}>
<NavLink to="/" end className={navClass}>Screen A</NavLink>
<NavLink to="/screen-b" className={navClass}>Screen B</NavLink>
<NavLink to="/screen-c" className={navClass}>Screen C</NavLink>
```

### 2c. Each screen component — read context, navigate via hooks

```tsx
import { useNavigate, useOutletContext } from 'react-router-dom'

export function ScreenB() {
  const { data, onOpen, onToggle } = useOutletContext<LayoutOutletContext>()
  const navigate = useNavigate()
  // was: onGoSomewhere()  →  navigate('/')
}
```

### 2d. Shared context type

```ts
export interface LayoutOutletContext {
  data: Item[]
  onOpen: (id: string) => void
  onToggle: (id: string) => void
}
```

---

## Verification

1. **Dev:** `pnpm run dev` (or `dev:simulator`). App loads at
   `http://localhost:5173/<base>/`. In the Network tab, API calls go to `/<base>/api/...`
   and the WS connects to `/<base>/api/ws`.
2. **Routing:** click each nav item — the URL becomes `/<base>/`, `/<base>/screen-b`, etc.
   Hard-refresh on a non-root screen and confirm it still loads.
3. **Build:** `pnpm run build`; output lands in `client/dist/<base>/` with `index.html`
   and `assets/` referencing `/<base>/assets/...`.
4. **Deploy:** `pnpm run deploy:cloudflare`; visit `https://<domain>/<base>/`, deep-link
   to `/<base>/<screen>`, and hard-refresh — the Worker `app.get('*')` fallback should
   serve the shell (not a 404 or the wrong app).

## Gotchas

- **One value for `<base>` everywhere.** A mismatch between Vite `base`, Hono `basePath`,
  router `basename`, the proxy key, and `run_worker_first` breaks silently.
- **Order matters in `index.ts`:** the `app.get('*')` fallback must come **after** all API
  routes, or it will swallow them.
- **Don't keep `not_found_handling: 'single-page-application'`** alongside the Worker
  fallback — it serves the wrong root `index.html` for deep links.
- `Assets({ path: './client/dist' })` stays at `./client/dist`; the `/<base>` subfolder is
  produced by Vite's `build.outDir`, so the served path becomes `/<base>/...` automatically.
