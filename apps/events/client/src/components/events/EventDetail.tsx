import type { EventItem } from './types'
import {
  colorFor,
  durationText,
  eventLinkLabel,
  eventUrl,
  initials,
  urlHost,
  venueLabel,
  whenText,
} from './utils'

interface Props {
  event: EventItem | null
  open: boolean
  onClose: () => void
}

/** Clean the iCal description down to the human-readable blurb (boilerplate removed). */
function aboutText(description: string | null): string {
  if (!description) return ''
  return description
    // Strip any line that is just a Luma pointer ("Get up-to-date…", "Find more…").
    .replace(/^.*https?:\/\/luma\.com\/\S*.*$/gim, '')
    // Strip the trailing "Address:" block and the "Hosted by …" sign-off.
    .replace(/Address:[\s\S]*$/i, '')
    .replace(/Hosted by[\s\S]*$/i, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim()
}

export function EventDetail({ event, open, onClose }: Props) {
  // Keep the element mounted (so the slide transition works) even with no event.
  const e = event
  const host = e?.organizerName || 'Z-Space'
  const about = aboutText(e?.description ?? null)
  const link = e ? eventUrl(e) : null

  return (
    <div
      className={`detail${open ? ' is-open' : ''}`}
      onClick={(ev) => {
        // On desktop the wrapper is the dim backdrop — click outside the card closes.
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div className="detail-card">
        <div className="detail-scroll">
        <div className="hero">
          <div className="hero-actions">
            <button className="hero-btn" onClick={onClose} aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>
          <div className="hero-label">{venueLabel(e?.location ?? null)}</div>
        </div>

        {e && (
          <div className="detail-body">
            <h1 className="d-title">{e.summary}</h1>
            {about && <p className="d-tagline">{firstSentence(about)}</p>}

            <div className="factrow">
              <div className="fact-ic">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                </svg>
              </div>
              <div>
                <div className="fact-main">{whenText(e.startsAt, e.endsAt)}</div>
                <div className="fact-sub">
                  {durationText(e.startsAt, e.endsAt)}
                  {durationText(e.startsAt, e.endsAt) && ' · '}add to calendar
                </div>
              </div>
            </div>

            <div className="factrow">
              <div className="fact-ic">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
                </svg>
              </div>
              <div>
                <div className="fact-main">{venueLabel(e.location)}</div>
                <div className="fact-sub">{locationSub(e.location)}</div>
              </div>
            </div>

            <div className="d-section">
              <h3>Hosted by</h3>
              <div className="d-host">
                <div className="av" style={{ background: colorFor(host) }}>
                  {initials(host)}
                </div>
                <div>
                  <div className="h-name">{host}</div>
                  <div className="h-role">Host</div>
                </div>
              </div>
            </div>

            {about && (
              <div className="d-section">
                <h3>About</h3>
                <p className="d-about">{about}</p>
              </div>
            )}

            {link && (
              <a className="d-luma" href={link} target="_blank" rel="noopener noreferrer">
                {eventLinkLabel(link)}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>

      {e && (
        <div className="actionbar">
          <button
            className="btn btn-primary"
            disabled={!link}
            onClick={() => link && window.open(link, '_blank', 'noopener')}
          >
            <span>RSVP</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

function firstSentence(text: string): string {
  const trimmed = text.trim()
  const idx = trimmed.search(/[.!?]\s/)
  return idx > 0 ? trimmed.slice(0, idx + 1) : trimmed
}

function locationSub(location: string | null): string {
  if (!location) return 'Z-Space · Gastown'
  if (location.startsWith('http')) {
    const host = urlHost(location)
    return host ? `Off-site · ${host}` : 'Check event page for details'
  }
  if (location.includes('505 Hamilton')) return '505 Hamilton St, Vancouver'
  return ''
}
