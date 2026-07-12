import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEvent, type Photo } from '../lib/api'
import { aspectRatio, dateStamp, orientationOf } from '../lib/film'
import { FilmAvatar } from '../components/FilmAvatar'

export function Detail() {
  const { eventId, photoId } = useParams<{ eventId: string; photoId: string }>()
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!eventId || !photoId) return
    getEvent(eventId)
      .then((d) => {
        const found = d.photos.find((p) => p.id === photoId)
        if (found) setPhoto(found)
        else setError('Frame not found')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load frame'))
  }, [eventId, photoId])

  const savePrint = async () => {
    if (!photo || saving) return
    setSaving(true)
    try {
      const res = await fetch(photo.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `frame-${String(photo.no).padStart(2, '0')}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Save print failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const orientation = photo ? orientationOf(photo.width, photo.height) : 'land'

  return (
    <section className="screen">
      <div className="dt-top">
        <Link className="iconbtn" to={`/events/${eventId}`} aria-label="Back to the roll">✕ Close</Link>
        <span className="dt-no">{photo ? `FRAME ${String(photo.no).padStart(2, '0')}` : ''}</span>
      </div>

      <div className="dt-stage">
        {error ? (
          <div className="sec-empty">{error}</div>
        ) : photo ? (
          <div className={`polaroid ${orientation}`}>
            <div className="shot" style={{ aspectRatio: aspectRatio(photo.width, photo.height) }}>
              <img src={photo.url} alt={`Frame ${photo.no}`} />
              <div className="vig" />
              <div className="cast" />
            </div>
            <div className="pl-foot">
              <div className="who">
                <FilmAvatar name={photo.uploaderName} avatar={photo.uploaderAvatar} seed={photo.uploaderDid} />
                <span className="nm">{photo.uploaderName ?? 'Someone'}</span>
              </div>
              <span className="stamp dstamp">{dateStamp(photo.createdAt)}</span>
            </div>
          </div>
        ) : (
          <div className="eyebrow">Developing…</div>
        )}
      </div>

      <div className="dt-save">
        <button className="save-btn" onClick={savePrint} disabled={!photo || saving}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          {saving ? 'Saving…' : 'Save print'}
        </button>
      </div>
    </section>
  )
}
