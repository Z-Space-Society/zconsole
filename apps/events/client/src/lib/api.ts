// Centralizes the deployment base path so API and WebSocket URLs stay in sync
// with the Vite `base` (the app is served under /events). `import.meta.env.BASE_URL`
// is '/events/', so BASE becomes '/events'.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export const apiUrl = (path: string) => `${BASE}${path}`

export const wsUrl = (path: string) => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${BASE}${path}`
}
