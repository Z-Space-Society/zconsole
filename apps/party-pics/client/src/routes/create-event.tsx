import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLocalFirstAuth } from '../hooks/useLocalFirstAuth'
import { createEvent } from '../lib/api'

export function CreateEvent() {
  const { getProfileJwt, setIsOnboardingModalOpen } = useLocalFirstAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (creating) return
    const trimmed = name.trim()
    if (!trimmed) return

    setError(null)
    setCreating(true)
    try {
      const profileJwt = await getProfileJwt()
      if (!profileJwt) {
        setIsOnboardingModalOpen(true)
        return
      }
      const event = await createEvent(profileJwt, trimmed)
      navigate(`/events/${event.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="screen">
      <div className="nr-wrap">
        <div className="nr-top">
          <Link className="iconbtn" to="/">◂ Cancel</Link>
        </div>
        <h2 className="nr-h">Create a<br /><em>new event</em></h2>

        <div className="field">
          <label htmlFor="eventName">Event name</label>
          <input
            id="eventName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Rooftop Summer Social"
            autoFocus
          />
        </div>

        {error && <div className="sec-empty" style={{ color: 'var(--stamp)' }}>{error}</div>}

        <button className="load" onClick={handleCreate} disabled={creating || !name.trim()}>
          {creating ? 'Creating…' : 'Create event ▸'}
        </button>
      </div>
    </section>
  )
}
