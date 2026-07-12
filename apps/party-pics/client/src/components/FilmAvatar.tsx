import { avatarColor, initials } from '../lib/film'

interface FilmAvatarProps {
  name: string | null | undefined
  avatar?: string | null
  /** Stable seed for the fallback color (defaults to name). */
  seed?: string | null
}

/** Small darkroom-style avatar: real photo when available, else initials on a tinted disc. */
export function FilmAvatar({ name, avatar, seed }: FilmAvatarProps) {
  if (avatar) {
    return (
      <div className="film-avatar">
        <img src={avatar} alt={name || ''} />
      </div>
    )
  }
  return (
    <div className="film-avatar" style={{ background: avatarColor(seed ?? name) }}>
      {initials(name)}
    </div>
  )
}
