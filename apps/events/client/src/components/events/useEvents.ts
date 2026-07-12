import { useCallback, useEffect, useRef, useState } from 'react'
import { apiUrl, wsUrl } from '../../lib/api'
import type { EventItem } from './types'

/**
 * Loads events from the API and refetches when the feed re-syncs upstream.
 */
export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/events'))
      if (!res.ok) throw new Error(`events ${res.status}`)
      const data = (await res.json()) as { events: EventItem[] }
      setEvents(data.events)
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Refetch when the feed re-syncs upstream.
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch
  useEffect(() => {
    const ws = new WebSocket(wsUrl('/api/ws'))
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'events-synced') {
          refetchRef.current()
        }
      } catch {
        /* ignore malformed frames */
      }
    }
    ws.onerror = () => {}
    return () => ws.close()
  }, [])

  return { events, loading, refetch }
}
