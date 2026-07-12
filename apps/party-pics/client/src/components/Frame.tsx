import type { Photo } from '../lib/api'
import { aspectRatio, dateStamp } from '../lib/film'
import { FilmAvatar } from './FilmAvatar'

interface FrameProps {
  photo: Photo
  onOpen: () => void
}

/** One numbered frame on the contact strip. */
export function Frame({ photo, onOpen }: FrameProps) {
  return (
    <div className="frame">
      <div className="frame-tab">
        <span className="no">
          <span className="arrow">▸</span>
          {String(photo.no).padStart(2, '0')}
        </span>
        <span className="dt">{dateStamp(photo.createdAt)}</span>
      </div>
      <button
        className="shot"
        style={{ aspectRatio: aspectRatio(photo.width, photo.height) }}
        onClick={onOpen}
        aria-label={`Open frame ${photo.no}${photo.uploaderName ? ` by ${photo.uploaderName}` : ''}`}
      >
        <img src={photo.url} alt={`Frame ${photo.no}`} loading="lazy" />
        <div className="vig" />
        <div className="cast" />
        <div className="tag">
          <FilmAvatar name={photo.uploaderName} avatar={photo.uploaderAvatar} seed={photo.uploaderDid} />
        </div>
      </button>
    </div>
  )
}
