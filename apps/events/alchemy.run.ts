/**
 * Alchemy Configuration for Local First Auth Starter
 *
 * Deploys the starter mini-app to Cloudflare:
 * - D1 Database for user storage
 * - Durable Object for real-time WebSocket broadcasting
 * - Worker for API and static asset serving
 */

import alchemy from 'alchemy'
import { Assets, D1Database, DurableObjectNamespace, Worker } from 'alchemy/cloudflare'
import { CloudflareStateStore } from 'alchemy/state'
import type { Broadcaster } from './server/src/durable-object'

// Initialize Alchemy app with remote state store
const app = await alchemy('zconsole-events-mini-app', {
  // Encryption key Alchemy uses to encrypt secrets (GCAL_ICS_URL) before
  // persisting them to the state store. Must stay stable across deploys.
  password: process.env.ALCHEMY_PASSWORD,
  stateStore: (scope) => new CloudflareStateStore(scope),
})

/**
 * D1 Database
 * Stores user information
 */
const database = await D1Database(`${app.name}-${app.stage}-db`, {
  name: `${app.name}-${app.stage}-db`,
  migrationsDir: './server/src/db/migrations',
  adopt: true,
})

/**
 * Static Assets
 * Client build directory containing the React app
 */
const staticAssets = await Assets({
  path: './client/dist',
})

/**
 * Durable Object Namespace
 * Manages real-time WebSocket connections for broadcasting user updates
 */
const durableObject = DurableObjectNamespace<Broadcaster>(`${app.name}-${app.stage}-durable-object`, {
  className: 'Broadcaster',
  sqlite: true,
})

/**
 * Cloudflare Worker
 * Handles API routes, WebSocket upgrades, and serves static client assets
 */
export const worker = await Worker('worker', {
  name: `${app.name}-${app.stage}`,
  entrypoint: './server/src/index.ts',
  bindings: {
    DB: database,
    DURABLE_OBJECT: durableObject,
    ASSETS: staticAssets,
    // Google Calendar iCal (.ics) feed for syncing private events (source='gcal').
    // The private URL variant embeds a token, so it's a runtime secret — bound as a
    // Worker secret (secret_text). alchemy.secret.env throws at deploy time if the
    // var is missing from .env, so a deploy fails loud instead of shipping without it.
    GCAL_ICS_URL: alchemy.secret.env.GCAL_ICS_URL,
    // Origins we accept Local First Auth JWTs for. All apps are path-routed on one
    // origin, so the per-origin DID is identical across console/events/party-pics.
    // Committed literal on purpose — never read this from .env (alchemy deploy loads
    // .env, so a local deploy would push localhost origins to prod). See docs/secrets.md.
    ALLOWED_ORIGINS: 'https://console.z-space.ca',
  },
  assets: {
    html_handling: 'auto-trailing-slash',
    // API/WebSocket paths must reach the Worker first. Other asset misses
    // (e.g. deep links like /events/month) fall through to the Worker, which
    // serves the correct /events/index.html shell (see server/src/index.ts).
    run_worker_first: ['/events/api/*'],
  },
  url: true,
})

// Finalize deployment
await app.finalize()

console.log('✅ Alchemy deployment complete')
console.log(`📦 App: ${app.name}`)
console.log(`🌍 Stage: ${app.stage}`)
console.log(`🗄️  D1 Database: ${database.name}`)
console.log(`🔄 Durable Object: ${durableObject.className}`)
console.log(`⚡ Worker: ${worker.name}`)
console.log(`🌐 URL: ${worker.url}`)
