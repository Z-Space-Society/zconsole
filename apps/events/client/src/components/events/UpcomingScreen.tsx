import { Fragment } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { EventItem, EventsOutletContext } from './types'
import { sourceBadgeLabel } from './ui'
import {
  durationText,
  meridiemLabel,
  nowParts,
  partsOf,
  rangeText,
  timeLabel,
  venueLabel,
} from './utils'

export function UpcomingScreen() {
  const { events, onOpen } = useOutletContext<EventsOutletContext>()
  const now = nowParts()
  const todayKey = now.key

  const upcoming = events
    .filter((e) => partsOf(e.startsAt).key >= todayKey)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  // Group by Vancouver-local day (empty days naturally skipped).
  const dayKeys: string[] = []
  const byDay = new Map<string, EventItem[]>()
  for (const e of upcoming) {
    const k = partsOf(e.startsAt).key
    if (!byDay.has(k)) {
      byDay.set(k, [])
      dayKeys.push(k)
    }
    byDay.get(k)!.push(e)
  }

  const sub =
    upcoming.length === 0
      ? 'Nothing scheduled just yet'
      : `${upcoming.length} ${upcoming.length === 1 ? 'event' : 'events'} coming up at the space`

  return (
    <>
      <div className="screen-head">
        <div className="eyebrow">Z-Space · Gastown, Vancouver</div>
        <h1 className="screen-title">Upcoming</h1>
        <div className="screen-sub">{sub}</div>
      </div>

      {upcoming.length === 0 ? (
        <div className="empty">
          <div className="e-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 3v3M16 3v3" />
            </svg>
          </div>
          <p>No upcoming events right now. Browse the calendar to see what's happened at the space.</p>
        </div>
      ) : (
        dayKeys.map((key) => {
          const items = byDay.get(key)!
          const head = partsOf(items[0].startsAt)
          const isToday = key === todayKey

          // Decide where the now-line goes within today's events.
          let nowInserted = false
          const rows: React.ReactNode[] = []
          items.forEach((e) => {
            const sp = partsOf(e.startsAt)
            if (isToday && !nowInserted && sp.minutes > now.minutes) {
              rows.push(<NowLine key={`now-${key}`} now={now} />)
              nowInserted = true
            }
            rows.push(<Row key={e.uid} event={e} isToday={isToday} nowMinutes={now.minutes} onOpen={onOpen} />)
          })
          if (isToday && !nowInserted) rows.push(<NowLine key={`now-${key}`} now={now} />)

          return (
            <div className="day" key={key}>
              <div className="day-head">
                <span className="day-num">{head.d}</span>
                <span className="day-dow">
                  {head.dowShort} · {head.monShort}
                </span>
                {isToday && <span className="day-today">Today</span>}
              </div>
              {rows}
            </div>
          )
        })
      )}
    </>
  )
}

function NowLine({ now }: { now: ReturnType<typeof nowParts> }) {
  return (
    <div className="nowline">
      <span className="nl-dot" />
      <span className="nl-rule" />
      <span className="nl-label">now · {timeLabel(now)}</span>
    </div>
  )
}

function Row({
  event,
  isToday,
  nowMinutes,
  onOpen,
}: {
  event: EventItem
  isToday: boolean
  nowMinutes: number
  onOpen: (uid: string) => void
}) {
  const sp = partsOf(event.startsAt)
  const endMinutes = event.endsAt ? partsOf(event.endsAt).minutes : sp.minutes
  const past = isToday && endMinutes <= nowMinutes
  const badge = sourceBadgeLabel(event.source)

  return (
    <div className={`row${past ? ' past' : ''}`}>
      <div className="timecol">
        <div className="t-start">{timeLabel(sp)}</div>
        <div className="t-mer">{meridiemLabel(sp)}</div>
      </div>
      <div className="card" onClick={() => onOpen(event.uid)}>
        <div className="card-top">
          <span className="where-label">{venueLabel(event.location)}</span>
          {badge && <span className="ev-badge">{badge}</span>}
        </div>
        <div className="card-title">{event.summary}</div>
        <div className="card-meta">
          <span>{rangeText(event.startsAt, event.endsAt)}</span>
          {durationText(event.startsAt, event.endsAt) && (
            <Fragment>
              <span className="meta-sep" />
              <span>{durationText(event.startsAt, event.endsAt)}</span>
            </Fragment>
          )}
        </div>
      </div>
    </div>
  )
}
