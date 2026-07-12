import { useCallback, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useEvents } from './useEvents'
import { EventDetail } from './EventDetail'
import { AdminPanel } from './AdminPanel'
import { IconCalendar, IconList } from './ui'
import { Footer } from '../Footer'
import { useLocalFirstAuth } from '../../hooks/useLocalFirstAuth'
import type { EventsOutletContext } from './types'

export function EventsApp() {
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const { events, loading, refetch } = useEvents()
  const { user, getProfileJwt } = useLocalFirstAuth()

  const openEvent = events.find((e) => e.uid === openUid) ?? null

  const openDetail = useCallback((uid: string) => {
    setOpenUid(uid)
    setDetailOpen(true)
  }, [])
  const closeDetail = useCallback(() => setDetailOpen(false), [])

  const navClass = ({ isActive }: { isActive: boolean }) => `navbtn${isActive ? ' is-on' : ''}`

  return (
    <div className="ev-root">
      <div className="device">
        <div className="app">
          <div className="topbar">
            <div className="brand">
              {/* <div className="brand-mark" /> */}
              <div className="brand-name">
                z-space <span>· events</span>
              </div>
            </div>

            {user?.isAdmin && (
              <button
                className="admin-btn"
                onClick={() => setAdminOpen(true)}
                aria-label="Admin controls"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}

            <nav className="nav">
              <NavLink to="/" end className={navClass}>
                <IconList />
                Upcoming
              </NavLink>
              <NavLink to="/month" className={navClass}>
                <IconCalendar />
                This month
              </NavLink>
            </nav>
          </div>

          <div className="screens">
            <section className="screen is-active">
              {loading ? (
                <div className="ev-loading">Loading events…</div>
              ) : (
                <Outlet
                  context={{ events, onOpen: openDetail } satisfies EventsOutletContext}
                />
              )}
              <Footer />
            </section>
          </div>

          <EventDetail
            event={openEvent}
            open={detailOpen}
            onClose={closeDetail}
          />

          {user?.isAdmin && (
            <AdminPanel
              open={adminOpen}
              onClose={() => setAdminOpen(false)}
              events={events}
              getProfileJwt={getProfileJwt}
              refetch={refetch}
            />
          )}
        </div>
      </div>
    </div>
  )
}
