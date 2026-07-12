import { useState } from 'react'
import { apiUrl } from '../../lib/api'
import type { EventItem } from './types'
import { partsOf, rangeText, venueLabel } from './utils'

interface Props {
  open: boolean
  onClose: () => void
  events: EventItem[]
  getProfileJwt: () => Promise<string | undefined>
  refetch: () => Promise<void>
}

/**
 * Admin-only panel: add private Luma events (that never appear in the feed) by
 * URL, and remove events that were added manually.
 */
export function AdminPanel({ open, onClose, events, getProfileJwt, refetch }: Props) {
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [removingUid, setRemovingUid] = useState<string | null>(null)

  const manualEvents = events
    .filter((e) => e.source === 'manual')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const handleAdd = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setError(null)
    setNotice(null)
    setAdding(true)
    try {
      const profileJwt = await getProfileJwt()
      if (!profileJwt) {
        setError('You need to be signed in as an admin.')
        return
      }
      const res = await fetch(apiUrl('/api/events/add'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileJwt, url: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to add event')
      setUrl('')
      setNotice(`Added "${data.event?.summary ?? 'event'}"`)
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add event')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (uid: string) => {
    setError(null)
    setNotice(null)
    setRemovingUid(uid)
    try {
      const profileJwt = await getProfileJwt()
      if (!profileJwt) {
        setError('You need to be signed in as an admin.')
        return
      }
      const res = await fetch(apiUrl(`/api/events/${encodeURIComponent(uid)}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileJwt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to remove event')
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove event')
    } finally {
      setRemovingUid(null)
    }
  }

  return (
    <div
      className={`admin${open ? ' is-open' : ''}`}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div className="admin-card">
        <div className="admin-head">
          <h2>Admin</h2>
          <button className="hero-btn" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="admin-scroll">
          <section className="admin-sec">
            <h3>Add a private Luma event</h3>
            <p className="admin-hint">
              Paste a Luma event link. Private events that aren't in the feed get added manually.
            </p>
            <input
              className="admin-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://luma.com/…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
              }}
            />
            <button
              className="btn btn-primary admin-add"
              onClick={handleAdd}
              disabled={adding || !url.trim()}
            >
              {adding ? 'Adding…' : 'Add event'}
            </button>
            {error && <div className="admin-error">{error}</div>}
            {notice && <div className="admin-notice">{notice}</div>}
          </section>

          <section className="admin-sec">
            <h3>Manually added · {manualEvents.length}</h3>
            {manualEvents.length === 0 ? (
              <p className="admin-hint">No manually-added events yet.</p>
            ) : (
              <ul className="admin-list">
                {manualEvents.map((e) => {
                  const p = partsOf(e.startsAt)
                  return (
                    <li key={e.uid} className="admin-item">
                      <div className="admin-item-main">
                        <div className="admin-item-title">{e.summary}</div>
                        <div className="admin-item-sub">
                          {p.dowShort} {p.d} {p.monShort} · {rangeText(e.startsAt, e.endsAt)} · {venueLabel(e.location)}
                        </div>
                      </div>
                      <button
                        className="admin-remove"
                        onClick={() => handleRemove(e.uid)}
                        disabled={removingUid === e.uid}
                      >
                        {removingUid === e.uid ? '…' : 'Remove'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
