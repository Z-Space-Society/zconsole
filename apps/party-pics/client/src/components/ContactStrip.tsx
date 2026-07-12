import type { Photo } from '../lib/api'
import { Frame } from './Frame'

interface ContactStripProps {
  photos: Photo[]
  onOpen: (photo: Photo) => void
}

/** The 35mm contact strip: sprocket rails framing the numbered frames. */
export function ContactStrip({ photos, onOpen }: ContactStripProps) {
  return (
    <div className="strip">
      <div className="rail" />
      <div className="frames">
        {photos.length === 0 ? (
          <div className="gl-empty">
            <div className="en2">
              No photos yet.
              <br />
              Be the first to add a photo.
            </div>
          </div>
        ) : (
          photos.map((p) => <Frame key={p.id} photo={p} onOpen={() => onOpen(p)} />)
        )}
      </div>
      <div className="rail" />
    </div>
  )
}
