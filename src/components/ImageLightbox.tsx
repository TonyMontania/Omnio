// Full-screen image viewer. Click any image thumbnail to open — screenshots
// gallery (Games) and volume-covers gallery (Manga family) both use it so
// the small thumb view isn't the only way to see them. Esc / click-outside
// / ← → arrows to navigate when passed a list.

import { useEffect, useCallback } from 'react'
import { assetSrc } from '../types'

type Props = {
  images: { src: string; caption?: string; label?: string }[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

export default function ImageLightbox({ images, index, onIndex, onClose }: Props) {
  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex])
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  const cur = images[index]
  if (!cur) return null
  const resolved = assetSrc(cur.src) ?? cur.src

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      {images.length > 1 && (
        <button type="button" className="lightbox-nav prev" onClick={(e) => { e.stopPropagation(); prev() }} title="Previous (←)">‹</button>
      )}
      <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <img src={resolved} alt={cur.caption ?? cur.label ?? ''} />
        {(cur.caption || cur.label) && (
          <figcaption className="lightbox-caption">
            {cur.label && <span className="lightbox-label">{cur.label}</span>}
            {cur.caption && <span>{cur.caption}</span>}
            {images.length > 1 && <span className="lightbox-index">{index + 1} / {images.length}</span>}
          </figcaption>
        )}
      </figure>
      {images.length > 1 && (
        <button type="button" className="lightbox-nav next" onClick={(e) => { e.stopPropagation(); next() }} title="Next (→)">›</button>
      )}
      <button type="button" className="lightbox-close" onClick={onClose} title="Close (Esc)">✕</button>
    </div>
  )
}
