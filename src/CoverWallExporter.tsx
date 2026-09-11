// Cover wall exporter — renders every enabled category's covers into
// a single high-res PNG image the user can share ("shelfie"-style).
//
// The image is composed in a hidden <canvas>, drawn tile by tile from
// each item's stored cover, then handed to the user as a Blob URL
// download. All resolution and layout math happens client-side; the
// Rust backend isn't involved.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'

interface Props {
  open: boolean
  items: Item[]
  enabledCategories?: string[]
  onClose: () => void
}

// Layout presets — target roughly-4K exports for the "big" preset and
// something screen-sized for previews. Cover cells are 3:4 to match
// the game/book/anime portrait aspect ratio; music covers overflow
// slightly but crop cleanly at that ratio too.
const PRESETS = [
  { key: 'sm', label: 'Small (1080p)', width: 1920, cols: 12 },
  { key: 'md', label: 'Medium (2K)', width: 2560, cols: 14 },
  { key: 'lg', label: 'Large (4K)', width: 3840, cols: 16 },
] as const

export default function CoverWallExporter({ open, items, enabledCategories, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [preset, setPreset] = useState<typeof PRESETS[number]['key']>('md')
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())
  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [bg, setBg] = useState('#0a0a0a')
  const [showTitle, setShowTitle] = useState(true)
  const [title, setTitle] = useState('My Omnio wall')

  // First render populates the category filter with everything the
  // user has enabled. `open` reset keeps this fresh across sessions.
  useEffect(() => {
    if (!open) return
    const enabled = new Set(enabledCategories ?? CATEGORIES.map((c) => c.id))
    setSelectedCats(enabled)
    setPreviewUrl(null)
    setProgress(null)
  }, [open, enabledCategories])

  const filteredItems = useMemo(
    () => items.filter((i) => selectedCats.has(i.categoryId) && i.cover),
    [items, selectedCats],
  )

  const activePreset = PRESETS.find((p) => p.key === preset)!

  async function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })
  }

  async function render() {
    if (filteredItems.length === 0) return
    setRendering(true)
    setPreviewUrl(null)
    const cols = activePreset.cols
    const targetWidth = activePreset.width
    // Cell aspect 3:4. gutter ~0.6% of width. Title band on top
    // reserves ~4% when enabled.
    const gutter = Math.round(targetWidth * 0.006)
    const cellW = Math.floor((targetWidth - gutter * (cols + 1)) / cols)
    const cellH = Math.round(cellW * (4 / 3))
    const rows = Math.ceil(filteredItems.length / cols)
    const titleBand = showTitle ? Math.round(targetWidth * 0.04) : 0
    const height = titleBand + gutter + rows * (cellH + gutter)
    const canvas = canvasRef.current!
    canvas.width = targetWidth
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, targetWidth, height)
    if (showTitle && title.trim()) {
      const fontSize = Math.round(titleBand * 0.55)
      ctx.fillStyle = '#ffffff'
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText(title.trim(), gutter * 2, titleBand / 2)
      const subFont = Math.round(fontSize * 0.4)
      ctx.font = `400 ${subFont}px system-ui, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.textAlign = 'right'
      ctx.fillText(`${filteredItems.length} items`, targetWidth - gutter * 2, titleBand / 2)
    }
    setProgress({ done: 0, total: filteredItems.length })
    // Draw tile-by-tile. Loading images in parallel would be faster
    // but the memory footprint of 500+ HTMLImageElements at once is
    // rough on 4K exports.
    for (let idx = 0; idx < filteredItems.length; idx++) {
      const it = filteredItems[idx]
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = gutter + col * (cellW + gutter)
      const y = titleBand + gutter + row * (cellH + gutter)
      const src = assetSrc(it.cover)
      const img = src ? await loadImage(src) : null
      if (img) {
        // object-fit: cover
        const ratio = Math.max(cellW / img.width, cellH / img.height)
        const w = img.width * ratio
        const h = img.height * ratio
        const dx = x + (cellW - w) / 2
        const dy = y + (cellH - h) / 2
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, cellW, cellH)
        ctx.clip()
        ctx.drawImage(img, dx, dy, w, h)
        ctx.restore()
      } else {
        // Placeholder for missing / broken cover: dark tile with the
        // first character of the title so the grid stays uniform.
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(x, y, cellW, cellH)
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.font = `600 ${Math.round(cellW * 0.4)}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((it.title || '?').charAt(0).toUpperCase(), x + cellW / 2, y + cellH / 2)
      }
      setProgress({ done: idx + 1, total: filteredItems.length })
      // Yield to the browser every 10 tiles so the UI stays
      // responsive during large exports.
      if (idx % 10 === 0) await new Promise((r) => setTimeout(r, 0))
    }
    // Compose the preview as a Blob URL — cheaper to render + download
    // than a data URL on a 3-4K image.
    canvas.toBlob((blob) => {
      if (blob) setPreviewUrl(URL.createObjectURL(blob))
      setRendering(false)
    }, 'image/png', 0.95)
  }

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `omnio-wall-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel cover-wall-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Cover wall export</h2>
            <p className="modal-subtitle">Compose every cover in your library into a single sharable PNG.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body cover-wall-body">
          <div className="cover-wall-form">
            <div className="cover-wall-row">
              <label className="cover-wall-label">Resolution</label>
              <div className="pills">
                {PRESETS.map((p) => (
                  <button key={p.key} type="button" className={preset === p.key ? 'pill active' : 'pill'} onClick={() => setPreset(p.key)}>{p.label}</button>
                ))}
              </div>
            </div>

            <div className="cover-wall-row">
              <label className="cover-wall-label">Include categories</label>
              <div className="pills">
                {CATEGORIES.map((c) => {
                  const count = items.filter((i) => i.categoryId === c.id && i.cover).length
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={selectedCats.has(c.id) ? 'pill active' : 'pill'}
                      disabled={count === 0}
                      onClick={() => setSelectedCats((s) => {
                        const next = new Set(s)
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                        return next
                      })}
                    >{c.label} <span className="pill-count">{count}</span></button>
                  )
                })}
              </div>
            </div>

            <div className="cover-wall-grid">
              <div className="cover-wall-row">
                <label className="cover-wall-label">Title on the wall</label>
                <div className="cover-wall-title-row">
                  <label className="cover-wall-check">
                    <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} />
                    <span>Show title</span>
                  </label>
                  <input
                    type="text"
                    className="cover-wall-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!showTitle}
                    placeholder="My Omnio wall"
                  />
                </div>
              </div>

              <div className="cover-wall-row">
                <label className="cover-wall-label">Background</label>
                <div className="cover-wall-color-row">
                  <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
                  <span className="cover-wall-color-hex">{bg.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div className="cover-wall-summary">
              <b>{filteredItems.length}</b> covers · target <b>{activePreset.width}px</b> wide · ~<b>{Math.ceil(filteredItems.length / activePreset.cols) || 0}</b> rows
            </div>
          </div>

          {previewUrl && (
            <div className="cover-wall-preview">
              <img src={previewUrl} alt="Preview of the composed cover wall" />
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
        <div className="modal-footer cover-wall-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>Close</button>
          <div className="cover-wall-footer-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={render}
              disabled={rendering || filteredItems.length === 0}
            >
              {rendering
                ? `Rendering… ${progress ? `${progress.done}/${progress.total}` : ''}`
                : (previewUrl ? 'Re-render' : 'Render wall')}
            </button>
            {previewUrl && (
              <button type="button" className="add-btn" onClick={download}>Download PNG</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
