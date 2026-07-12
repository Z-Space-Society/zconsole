import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalFirstAuth } from '../hooks/useLocalFirstAuth'
import { listEvents, type EventItem } from '../lib/api'

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

function EventRow({ event, past, onOpen }: { event: EventItem; past: boolean; onOpen: () => void }) {
  return (
    <button
      className={`event-row${past ? ' past' : ''}`}
      onClick={onOpen}
      aria-label={`Open ${event.name}`}
    >
      <span className="rr-title">{event.name}</span>
      <span className="rr-go">▸</span>
    </button>
  )
}

export function Home() {
  const { user, setIsOnboardingModalOpen } = useLocalFirstAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    listEvents()
      .then(setEvents)
      .catch((err) => console.error('Failed to load events:', err))
      .finally(() => setLoaded(true))
  }, [])

  const newEvent = () => {
    if (!user) {
      setIsOnboardingModalOpen(true)
      return
    }
    navigate('/create-event')
  }

  const cutoff = Date.now() - TWO_WEEKS_MS
  const current = events.filter((e) => new Date(e.createdAt).getTime() >= cutoff)
  const past = events.filter((e) => new Date(e.createdAt).getTime() < cutoff)

  return (
    <section className="screen">
      <header className="ar-head">
        <div className="ar-bar">
          <div className="brand">
            {/* <span className="logo">Photos</span> */}
          </div>
          {/* <button className="pill" onClick={newEvent}>＋ New event</button> */}
        </div>
      </header>

      <div className="ar-list">
        <div className="sec-head">
          <span>Current events</span>
        </div>
        {current.length ? (
          current.map((e) => (
            <EventRow key={e.id} event={e} past={false} onOpen={() => navigate(`/events/${e.id}`)} />
          ))
        ) : (
          <div className="sec-empty">
            {loaded ? 'No active events right now.' : 'Loading…'}
          </div>
        )}

        {past.length > 0 && (
          <>
            <div className="sec-head past">
              <span>Past events</span>
              <span className="sec-n">{past.length}</span>
            </div>
            {past.map((e) => (
              <EventRow key={e.id} event={e} past onOpen={() => navigate(`/events/${e.id}`)} />
            ))}
          </>
        )}
      </div>
    </section>
  )
}
