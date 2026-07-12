import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLocalFirstAuth } from '../hooks/useLocalFirstAuth'
import { ContactStrip } from '../components/ContactStrip'
import { Shutter } from '../components/Shutter'
import { Toast } from '../components/Toast'
import {
  confirmPhotos,
  getEvent,
  presignBatch,
  type EventDetail,
  type Photo,
  type PresignSlot,
} from '../lib/api'
import { mapWithConcurrency, putToR2, readImageDims } from '../lib/upload'

const MAX_BATCH = 25
const SLOTS_TTL_MS = 50 * 60 * 1000 // refresh presign batch before the 1h server expiry
const PUT_CONCURRENCY = 5

export function Gallery() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { user, getProfileJwt, setIsOnboardingModalOpen } = useLocalFirstAuth()

  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState({ message: '', show: false })

  // Prefetched presign slots (see prefetch effect). Held in a ref so handlers see the latest.
  const slotsRef = useRef<{ slots: PresignSlot[]; fetchedAt: number }>({ slots: [], fetchedAt: 0 })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!eventId) return
    try {
      setDetail(await getEvent(eventId))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load event')
    }
  }, [eventId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const showToast = useCallback((message: string) => {
    setToast({ message, show: true })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 1900)
  }, [])

  // Fetch a fresh batch of presigned slots (returns the slots and updates the ref).
  const fetchSlots = useCallback(async (profileJwt: string): Promise<PresignSlot[]> => {
    if (!eventId) return []
    const slots = await presignBatch(eventId, profileJwt, MAX_BATCH)
    slotsRef.current = { slots, fetchedAt: Date.now() }
    return slots
  }, [eventId])

  // Prefetch on load so uploads are instant once images are picked (only when signed in).
  useEffect(() => {
    if (!user || !eventId) return
    let cancelled = false
    getProfileJwt()
      .then((jwt) => {
        if (jwt && !cancelled) return fetchSlots(jwt)
      })
      .catch((err) => console.error('Presign prefetch failed:', err))
    return () => {
      cancelled = true
    }
  }, [user, eventId, getProfileJwt, fetchSlots])

  const handleFiles = useCallback(async (files: File[]) => {
    if (!eventId || uploading) return

    let images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    if (images.length > MAX_BATCH) {
      images = images.slice(0, MAX_BATCH)
      showToast(`Up to ${MAX_BATCH} at a time — taking the first ${MAX_BATCH}`)
    }

    setUploading(true)
    try {
      const profileJwt = await getProfileJwt()
      if (!profileJwt) {
        setIsOnboardingModalOpen(true)
        return
      }

      // Ensure enough fresh slots (re-presign if stale or short).
      const { slots, fetchedAt } = slotsRef.current
      let available = slots
      if (available.length < images.length || Date.now() - fetchedAt > SLOTS_TTL_MS) {
        available = await fetchSlots(profileJwt)
      }
      const used = available.slice(0, images.length)

      // Read dimensions, then PUT each file directly to R2 (concurrency-capped).
      const dims = await Promise.all(images.map(readImageDims))
      await mapWithConcurrency(images, PUT_CONCURRENCY, (file, i) => putToR2(used[i].uploadUrl, file))

      // Record the uploaded photos.
      await confirmPhotos(
        eventId,
        profileJwt,
        images.map((file, i) => ({
          key: used[i].key,
          contentType: file.type,
          width: dims[i].width || undefined,
          height: dims[i].height || undefined,
        }))
      )

      // Consume used slots; top the batch back up for next time.
      slotsRef.current = {
        slots: available.slice(images.length),
        fetchedAt: slotsRef.current.fetchedAt,
      }
      if (slotsRef.current.slots.length < MAX_BATCH / 2) {
        fetchSlots(profileJwt).catch(() => {})
      }

      await refresh()
      showToast(images.length === 1 ? 'Frame added — developing…' : `${images.length} frames added — developing…`)
    } catch (err) {
      console.error('Upload failed:', err)
      showToast(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [eventId, uploading, getProfileJwt, setIsOnboardingModalOpen, fetchSlots, refresh, showToast])

  const openPhoto = (photo: Photo) => navigate(`/events/${eventId}/${photo.id}`)

  return (
    <section className="screen">
      <header className="gl-head">
        <div className="gl-bar">
          <Link className="iconbtn" to="/">◂ All events</Link>
        </div>
        <h1 className="gl-title">{detail?.event.name ?? (loadError ? 'Not found' : 'Loading…')}</h1>
      </header>

      {loadError ? (
        <div className="sec-empty">{loadError}</div>
      ) : (
        <ContactStrip photos={detail?.photos ?? []} onOpen={openPhoto} />
      )}

      <Shutter onFiles={handleFiles} disabled={uploading} label={uploading ? 'Developing…' : 'Add photos'} />
      <Toast message={toast.message} show={toast.show} />
    </section>
  )
}
