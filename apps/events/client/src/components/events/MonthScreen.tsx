import { useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { EventItem, EventsOutletContext } from './types'
import { IconChevronLeft, IconChevronRight, sourceBadgeLabel } from './ui'
import {
  MONTH_NAMES,
  MONTH_SHORT,
  meridiemLabel,
  nowParts,
  pad,
  partsOf,
  rangeText,
  timeLabel,
  venueLabel,
} from './utils'

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthScreen() {
  const { events, onOpen } = useOutletContext<EventsOutletContext>()
  const navigate = useNavigate()
  const today = nowParts()
  const [viewY, setViewY] = useState(today.y)
  const [viewM, setViewM] = useState(today.mo - 1) // 0-indexed
  const [selKey, setSelKey] = useState<string | null>(today.key)

  // Map of dayKey -> events, for the viewed month.
  const monthPrefix = `${viewY}-${pad(viewM + 1)}-`
  const dayMap = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const e of events) {
      const k = partsOf(e.startsAt).key
      if (k.startsWith(monthPrefix)) {
        const list = map.get(k) ?? []
        list.push(e)
        map.set(k, list)
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    return map
  }, [events, monthPrefix])

  // Keep the selected day sensible for the viewed month.
  const selInMonth = selKey?.startsWith(monthPrefix)
  let effectiveSel = selKey
  if (!selInMonth) {
    if (today.key.startsWith(monthPrefix)) effectiveSel = today.key
    else {
      const ds = [...dayMap.keys()].sort()
      effectiveSel = ds.length ? ds[0] : null
    }
  }

  const sortedDayKeys = useMemo(() => [...dayMap.keys()].sort(), [dayMap])
  const dayRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const firstDow = new Date(Date.UTC(viewY, viewM, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(viewY, viewM + 1, 0)).getUTCDate()

  function selectDay(key: string) {
    setSelKey(key)
    // The day group is only mounted when the day has events; scroll to it if present.
    // Scroll the .screen container directly (not scrollIntoView, which would also scroll
    // the outer page/window and shift the whole layout).
    const el = dayRefs.current.get(key)
    const container = el?.closest('.screen') as HTMLElement | null
    if (el && container) {
      const top =
        el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
      container.scrollTo({ top: Math.max(0, top - 14), behavior: 'smooth' })
    }
  }

  function changeMonth(delta: number) {
    let m = viewM + delta
    let y = viewY
    if (m < 0) {
      m = 11
      y--
    } else if (m > 11) {
      m = 0
      y++
    }
    setViewM(m)
    setViewY(y)
    setSelKey(null)
  }

  const cells: React.ReactNode[] = []
  for (let i = 0; i < firstDow; i++) cells.push(<div className="cal-cell" key={`pad-${i}`} />)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${viewY}-${pad(viewM + 1)}-${pad(d)}`
    const dayEvents = dayMap.get(key)
    const has = !!dayEvents
    const isToday = key === today.key
    const isSel = key === effectiveSel
    const dotCount = has ? Math.min(dayEvents!.length, 3) : 0
    cells.push(
      <div
        key={key}
        className={`cal-cell in${has ? ' has' : ''}${isToday ? ' today' : ''}${isSel ? ' sel' : ''}`}
        onClick={() => selectDay(key)}
      >
        <div className="c-num">{d}</div>
        <div className="c-dots">
          {Array.from({ length: dotCount }).map((_, i) => (
            <span className="dot" key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="screen-head" style={{ marginBottom: 16 }}>
        <div className="eyebrow">Z-Space · Gastown, Vancouver</div>
      </div>

      <div className="month-nav">
        <button className="month-arrow" onClick={() => changeMonth(-1)} aria-label="Previous month">
          <IconChevronLeft />
        </button>
        <div className="month-name">
          {MONTH_NAMES[viewM]} <span>{viewY}</span>
        </div>
        <button className="month-arrow" onClick={() => changeMonth(1)} aria-label="Next month">
          <IconChevronRight />
        </button>
      </div>

      <div className="cal-dows">
        {DOW_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grid">{cells}</div>

      <div className="month-divider" />

      {dayMap.size === 0 ? (
        <div className="month-empty">
          <p>No events on the calendar this month. Some months are quieter than others — see what's coming up next.</p>
          <button onClick={() => navigate('/')}>View upcoming →</button>
        </div>
      ) : (
        <div className="month-list">
          {sortedDayKeys.map((key) => (
            <MonthDayGroup
              key={key}
              dayKey={key}
              todayKey={today.key}
              selected={key === effectiveSel}
              events={dayMap.get(key)!}
              onOpen={onOpen}
              registerRef={(el) => {
                if (el) dayRefs.current.set(key, el)
                else dayRefs.current.delete(key)
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}

function MonthDayGroup({
  dayKey,
  todayKey,
  selected,
  events,
  onOpen,
  registerRef,
}: {
  dayKey: string
  todayKey: string
  selected: boolean
  events: EventItem[]
  onOpen: (uid: string) => void
  registerRef: (el: HTMLDivElement | null) => void
}) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dowLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ]

  return (
    <div className={`day-group${selected ? ' sel' : ''}`} ref={registerRef}>
      <div className="day-title">
        {dowLong} {d} {MONTH_SHORT[m - 1]}
        {dayKey === todayKey && <span>Today</span>}
      </div>
      {events.map((e) => {
        const sp = partsOf(e.startsAt)
        const badge = sourceBadgeLabel(e.source)
        return (
          <div className="mcard" key={e.uid} onClick={() => onOpen(e.uid)}>
            <div className="m-time">
              <div className="mt-h">{timeLabel(sp)}</div>
              <div className="mt-m">{meridiemLabel(sp)}</div>
            </div>
            <div className="m-body">
              <div className="where-label" style={{ marginBottom: 6 }}>
                {venueLabel(e.location)}
                {badge && <span className="ev-badge" style={{ marginLeft: 8 }}>{badge}</span>}
              </div>
              <div className="card-title" style={{ margin: 0, fontSize: 16 }}>
                {e.summary}
              </div>
              <div className="card-meta" style={{ marginTop: 6 }}>
                <span>{rangeText(e.startsAt, e.endsAt)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
