/** Small helpers for the darkroom film aesthetic. */

export type Orientation = 'land' | 'port' | 'sqr'

export function orientationOf(width?: number | null, height?: number | null): Orientation {
  if (!width || !height) return 'land'
  const ratio = width / height
  if (ratio > 1.1) return 'land'
  if (ratio < 0.9) return 'port'
  return 'sqr'
}

/** CSS aspect-ratio for a frame — true ratio when known, else a sensible default. */
export function aspectRatio(width?: number | null, height?: number | null): string {
  if (width && height) return `${width} / ${height}`
  return '3 / 2'
}

/** Date-stamp like the mockup: '26·6·27 (2-digit year · month · zero-padded day). */
export function dateStamp(input: string | number | Date): string {
  const d = new Date(input)
  const yy = String(d.getFullYear()).slice(-2)
  const m = d.getMonth() + 1
  const dd = String(d.getDate()).padStart(2, '0')
  return `'${yy}·${m}·${dd}`
}

const AVATAR_COLORS = [
  '#C76A2A', '#74A892', '#D86CA6', '#E0A93B',
  '#6FA0C0', '#C7553A', '#8FAE6B', '#B98AD0',
]

/** Stable color for a name/did, for initials-only film avatars. */
export function avatarColor(seed: string | null | undefined): string {
  const s = seed || ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function initials(name: string | null | undefined): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts[1]?.[0] ?? ''
  return (first + second).toUpperCase() || '·'
}
