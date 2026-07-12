#!/usr/bin/env tsx
/**
 * Scaffold a new mini app into the monorepo.
 *
 *   pnpm new-app <slug>
 *
 * Copies `templates/mini-app-starter` to `apps/<slug>` and does the mechanical
 * monorepo wiring the template can't do for itself:
 *
 *   - rescopes the four package names to `@zconsole/<slug>[-client|-server|-shared]`
 *     (a plain copy would collide with every other app, since they all descend
 *     from the same starter and share its generic `@starter/*` names)
 *   - rewrites `@starter/shared` imports/deps to the app-scoped shared package
 *   - names the Cloudflare resources `zconsole-<slug>-mini-app*`, matching the
 *     convention the existing deployed apps already use
 *   - claims a free worker + vite port pair so apps can run side by side
 *
 * What it deliberately does NOT do: register the app with the host console.
 * That needs a real deployed D1 UUID and a decision about server-side subpath
 * routing, so it's printed as a checklist instead of guessed at.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE_DIR = path.join(REPO_ROOT, 'templates', 'mini-app-starter')
const APPS_DIR = path.join(REPO_ROOT, 'apps')

/** Never copied out of the template — the monorepo root owns these. */
const SKIP = new Set([
  '.git',
  'node_modules',
  'dist',
  '.wrangler',
  '.alchemy',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'UPSTREAM.md',
  'LICENSE',
])

/** Files we rewrite text inside of. */
const TEXT_EXT = new Set(['.ts', '.tsx', '.json', '.toml', '.md', '.html', '.css'])

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

// ── args ────────────────────────────────────────────────────────────────────
const slug = process.argv[2]?.trim()

if (!slug) {
  die('Usage: pnpm new-app <slug>\n  e.g. pnpm new-app check-in')
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  die(`Invalid slug "${slug}". Use lowercase kebab-case, e.g. "check-in".`)
}
const destDir = path.join(APPS_DIR, slug)
if (fs.existsSync(destDir)) {
  die(`apps/${slug} already exists.`)
}
if (!fs.existsSync(TEMPLATE_DIR)) {
  die(`Template not found at templates/mini-app-starter.`)
}

// ── derived names ───────────────────────────────────────────────────────────
const pkgScope = `@zconsole/${slug}` //            @zconsole/check-in
const sharedPkg = `${pkgScope}-shared` //          @zconsole/check-in-shared
const clientPkg = `${pkgScope}-client`
const serverPkg = `${pkgScope}-server`
const cfName = `zconsole-${slug}-mini-app` //      matches existing deployed apps

// ── claim a free port pair ──────────────────────────────────────────────────
function usedPorts(): { worker: number[]; vite: number[] } {
  const worker: number[] = []
  const vite: number[] = []
  if (!fs.existsSync(APPS_DIR)) return { worker, vite }

  for (const app of fs.readdirSync(APPS_DIR)) {
    const wrangler = path.join(APPS_DIR, app, 'wrangler.toml')
    if (fs.existsSync(wrangler)) {
      const m = fs.readFileSync(wrangler, 'utf8').match(/^port\s*=\s*(\d+)/m)
      if (m) worker.push(Number(m[1]))
    }
    const viteCfg = path.join(APPS_DIR, app, 'client', 'vite.config.ts')
    if (fs.existsSync(viteCfg)) {
      const m = fs.readFileSync(viteCfg, 'utf8').match(/port:\s*(\d+)/)
      if (m) vite.push(Number(m[1]))
    }
  }
  return { worker, vite }
}

const used = usedPorts()
const workerPort = Math.max(8786, ...used.worker) + 1
const vitePort = Math.max(5172, ...used.vite) + 1

// ── copy template ───────────────────────────────────────────────────────────
function copyTree(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyTree(from, to)
    else fs.copyFileSync(from, to)
  }
}

console.log(`\n📦 Scaffolding apps/${slug} from templates/mini-app-starter\n`)
copyTree(TEMPLATE_DIR, destDir)

// ── rewrite file contents ───────────────────────────────────────────────────
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return SKIP.has(e.name) ? [] : walk(p)
    return TEXT_EXT.has(path.extname(e.name)) ? [p] : []
  })
}

/** Ordered so the generic `@starter/shared` swap can't clobber a name field. */
const REWRITES: Array<[RegExp, string]> = [
  // workspace package identity
  [/@starter\/shared/g, sharedPkg],
  [/"name":\s*"mini-app-starter"/g, `"name": "${pkgScope}"`],
  [/"name":\s*"starter-client"/g, `"name": "${clientPkg}"`],
  [/"name":\s*"starter-server"/g, `"name": "${serverPkg}"`],
  // path filters are CWD-relative and fragile in a monorepo — use real names
  [/--filter=\.\/client/g, `--filter=${clientPkg}`],
  [/--filter=\.\/server/g, `--filter=${serverPkg}`],
  // Cloudflare resource names (wrangler.toml + alchemy.run.ts)
  [/mini-app-starter-dev/g, `${cfName}-dev`],
  [/alchemy\('mini-app-starter'/g, `alchemy('${cfName}'`],
]

for (const file of walk(destDir)) {
  const before = fs.readFileSync(file, 'utf8')
  let after = before
  for (const [pattern, replacement] of REWRITES) after = after.replace(pattern, replacement)
  if (after !== before) fs.writeFileSync(file, after)
}

// ── ports + subpath base ────────────────────────────────────────────────────
const wranglerPath = path.join(destDir, 'wrangler.toml')
fs.writeFileSync(
  wranglerPath,
  fs.readFileSync(wranglerPath, 'utf8').replace(/^port\s*=\s*\d+/m, `port = ${workerPort}`),
)

const vitePath = path.join(destDir, 'client', 'vite.config.ts')
let vite = fs.readFileSync(vitePath, 'utf8')
vite = vite
  .replace(/port:\s*\d+/, `port: ${vitePort}`)
  .replace(/target:\s*'http:\/\/localhost:\d+'/g, `target: 'http://localhost:${workerPort}'`)
// Child mini apps are served under <domain>/<slug>/ by the host console.
if (!/^\s*base:/m.test(vite)) {
  vite = vite.replace(/defineConfig\(\{\n/, `defineConfig({\n  base: '/${slug}/',\n`)
}
fs.writeFileSync(vitePath, vite)

// ── install ─────────────────────────────────────────────────────────────────
console.log('   Installing workspace dependencies…\n')
try {
  execFileSync('pnpm', ['install'], { cwd: REPO_ROOT, stdio: 'inherit' })
} catch {
  console.warn('\n⚠ `pnpm install` failed — run it yourself once you\'ve looked at the app.\n')
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(`
✅ apps/${slug} created

   packages     ${pkgScope}, ${clientPkg}, ${serverPkg}, ${sharedPkg}
   cloudflare   ${cfName}  (worker, D1: ${cfName}-<stage>-db)
   dev          worker :${workerPort}   vite :${vitePort}
   run it       pnpm --filter ${pkgScope} run dev

   Still to do by hand — these need real decisions, not guesses:

   1. Serve it under /${slug}/
      Vite's \`base\` is set, but the server still mounts routes at /api/*.
      Prefix them to /${slug}/api/* — see apps/console/docs/hosting-a-mini-app.md
      (apps/events is the worked example).

   2. Deploy it, then register it with the host console:
      pnpm --filter ${pkgScope} run deploy:cloudflare

      • apps/console/shared/src/apps.ts   → add to MANAGED_APPS
                                            (needs the real D1 UUID from the deploy)
      • apps/console/client/src/apps.ts   → add the landing-grid card
      • apps/console/wrangler.toml        → add the DB_${slug.toUpperCase().replace(/-/g, '_')} dev binding
`)
