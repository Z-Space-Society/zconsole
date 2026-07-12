# Upstream

This folder is a vendored copy of the mini-app starter. It is **your** template —
edit it freely; `pnpm new-app <slug>` scaffolds new apps from whatever is here.

It is deliberately **excluded from the pnpm workspace** (see `pnpm-workspace.yaml`):
it still carries the generic `@starter/*` package names, and installing it would
reintroduce the name collision the monorepo exists to fix. The generator rescopes
those names to `@zconsole/<slug>-*` as it copies.

| | |
|---|---|
| Source | https://github.com/antler-browser/mini-app-starter |
| Vendored at commit | `9bc226d716aaf4bb289dfa2beeae30a5f238f710` |
| Vendored on | 2026-07-12 |

## Pulling upstream changes

Fork `antler-browser/mini-app-starter` if you want somewhere to push your own
template changes back to. To fold upstream improvements into this copy:

```bash
git clone --depth 1 https://github.com/antler-browser/mini-app-starter /tmp/starter
diff -ru templates/mini-app-starter /tmp/starter --exclude=.git --exclude=node_modules \
     --exclude=pnpm-lock.yaml --exclude=UPSTREAM.md
```

Apply what you want by hand, then bump the commit hash above.

Note: existing apps under `apps/` are **not** retroactively updated — they diverge
from the template the moment they're generated, by design.
