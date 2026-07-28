// End-of-year retrospective — a Spotify-Wrapped-style summary computed
// live from what you finished this year. Nothing extra to fill in; it
// leans on finishedAt, rewatches, ratings, playTime, episodesWatched
// and chaptersRead that the existing editors already write.

import { useMemo, useState } from 'react'
import type { Item } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'

interface Props {
  items: Item[]
  onClose: () => void
}

// Shape passed to the canvas exporter — a snapshot of everything the DOM
// version renders, without the DOM. Keeps the export function pure so we
// can reason about it (and unit-test it later) without React around.
interface WrappedSnapshot {
  year: string
  totalFinished: number
  avgRating: string | null
  busiestMonth: string | null
  busiestMonthCount: number
  categoryLines: { label: string; count: number; sub?: string }[]
  topRated: { title: string; rating: number; category: string; coverSrc?: string }[]
  highlights: { label: string; entries: [string, number][] }[]
}

// Loads a URL into an Image element and resolves once decoded. Rejects
// on error so drawWrapped can skip a missing cover instead of hanging.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Wraps `text` to `maxWidth` in pixels for the current canvas context,
// returning the lines. Split on spaces only — no hyphenation. Caller
// decides how many lines to actually paint.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line); line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

// Paints a Wrapped snapshot onto a canvas and returns a PNG data URL.
// 1080×1920 (portrait, shareable-story dimensions). Amber-on-near-black
// matches Omnio's default theme. Cover images are optional per row —
// missing ones fall back to a placeholder tile with the first letter.
async function drawWrapped(snap: WrappedSnapshot): Promise<string> {
  const W = 1080, H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background — vertical gradient near-black to charcoal.
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0f0e0c')
  bg.addColorStop(1, '#1a1815')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const ACCENT = '#c9a227'
  const TEXT = '#f5efe0'
  const DIM = '#8b8578'
  const DISPLAY = '"Fraunces", "Times New Roman", serif'
  const BODY = '"Inter", "Segoe UI", sans-serif'
  const MONO = '"IBM Plex Mono", "Courier New", monospace'

  // Header
  ctx.fillStyle = ACCENT
  ctx.font = `500 42px ${MONO}`
  ctx.textBaseline = 'top'
  ctx.fillText('OMNIO', 60, 60)

  ctx.fillStyle = TEXT
  ctx.font = `600 140px ${DISPLAY}`
  ctx.fillText(`Wrapped ${snap.year}`, 60, 130)

  // Hero row — up to 3 tiles.
  let y = 340
  const heroBoxes: { top: string; bottom: string }[] = []
  heroBoxes.push({ top: String(snap.totalFinished), bottom: 'items finished' })
  if (snap.avgRating) heroBoxes.push({ top: `★ ${snap.avgRating}`, bottom: 'average rating' })
  if (snap.busiestMonth) heroBoxes.push({ top: snap.busiestMonth, bottom: `busiest · ${snap.busiestMonthCount} finished` })
  const boxW = (W - 60 * 2 - 20 * (heroBoxes.length - 1)) / heroBoxes.length
  const boxH = 220
  heroBoxes.forEach((b, i) => {
    const x = 60 + i * (boxW + 20)
    ctx.fillStyle = '#211f1b'
    ctx.strokeStyle = '#2f2c25'
    ctx.lineWidth = 2
    roundRect(ctx, x, y, boxW, boxH, 16)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = ACCENT
    ctx.font = `700 ${b.top.length > 8 ? 56 : 76}px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.fillText(b.top, x + boxW / 2, y + 60)
    ctx.fillStyle = DIM
    ctx.font = `500 22px ${MONO}`
    ctx.fillText(b.bottom.toUpperCase(), x + boxW / 2, y + 165)
    ctx.textAlign = 'left'
  })
  y += boxH + 60

  // Category counts row.
  if (snap.categoryLines.length > 0) {
    ctx.fillStyle = TEXT
    ctx.font = `600 42px ${DISPLAY}`
    ctx.fillText('By library', 60, y)
    y += 70
    for (const c of snap.categoryLines) {
      ctx.fillStyle = ACCENT
      ctx.font = `700 44px ${DISPLAY}`
      const nText = String(c.count)
      ctx.fillText(nText, 60, y)
      const nW = ctx.measureText(nText).width
      ctx.fillStyle = TEXT
      ctx.font = `500 28px ${BODY}`
      ctx.fillText(c.label, 60 + nW + 16, y + 8)
      if (c.sub) {
        ctx.fillStyle = DIM
        ctx.font = `400 22px ${BODY}`
        ctx.textAlign = 'right'
        ctx.fillText(c.sub, W - 60, y + 12)
        ctx.textAlign = 'left'
      }
      y += 60
    }
    y += 30
  }

  // Top rated with cover thumbnails.
  if (snap.topRated.length > 0) {
    ctx.fillStyle = TEXT
    ctx.font = `600 42px ${DISPLAY}`
    ctx.fillText('Top rated', 60, y)
    y += 70
    const covers = await Promise.all(snap.topRated.map((t) =>
      t.coverSrc ? loadImage(t.coverSrc).catch(() => null) : Promise.resolve(null),
    ))
    for (let i = 0; i < snap.topRated.length; i++) {
      const t = snap.topRated[i]
      const cov = covers[i]
      const thumbW = 80, thumbH = 110
      ctx.fillStyle = '#2a2721'
      roundRect(ctx, 60, y, thumbW, thumbH, 6)
      ctx.fill()
      if (cov) {
        ctx.save()
        roundRect(ctx, 60, y, thumbW, thumbH, 6)
        ctx.clip()
        // Cover fitted to thumb rect, preserving aspect ratio via object-fit: cover.
        const scale = Math.max(thumbW / cov.width, thumbH / cov.height)
        const dw = cov.width * scale, dh = cov.height * scale
        ctx.drawImage(cov, 60 + (thumbW - dw) / 2, y + (thumbH - dh) / 2, dw, dh)
        ctx.restore()
      } else {
        ctx.fillStyle = DIM
        ctx.font = `700 44px ${DISPLAY}`
        ctx.textAlign = 'center'
        ctx.fillText((t.title.charAt(0) || '?').toUpperCase(), 60 + thumbW / 2, y + 35)
        ctx.textAlign = 'left'
      }
      ctx.fillStyle = TEXT
      ctx.font = `600 32px ${BODY}`
      const titleLines = wrapLines(ctx, t.title, W - 60 - 100 - 60)
      ctx.fillText(titleLines[0] ?? '', 60 + thumbW + 20, y + 20)
      ctx.fillStyle = DIM
      ctx.font = `500 22px ${MONO}`
      ctx.fillText(`★ ${t.rating.toFixed(1)} · ${t.category.toUpperCase()}`, 60 + thumbW + 20, y + 70)
      y += thumbH + 20
    }
    y += 30
  }

  // Highlights (top devs / studios / genres) — 3-column row.
  if (snap.highlights.length > 0) {
    ctx.fillStyle = TEXT
    ctx.font = `600 42px ${DISPLAY}`
    ctx.fillText('Highlights', 60, y)
    y += 70
    const cols = snap.highlights.length
    const colW = (W - 60 * 2 - 20 * (cols - 1)) / cols
    for (let i = 0; i < cols; i++) {
      const h = snap.highlights[i]
      const x = 60 + i * (colW + 20)
      ctx.fillStyle = ACCENT
      ctx.font = `500 22px ${MONO}`
      ctx.fillText(h.label.toUpperCase(), x, y)
      let ly = y + 40
      for (const [name, n] of h.entries.slice(0, 5)) {
        ctx.fillStyle = TEXT
        ctx.font = `500 22px ${BODY}`
        const nameLines = wrapLines(ctx, name, colW - 50)
        ctx.fillText(nameLines[0] ?? '', x, ly)
        ctx.fillStyle = DIM
        ctx.font = `500 22px ${MONO}`
        ctx.textAlign = 'right'
        ctx.fillText(String(n), x + colW, ly)
        ctx.textAlign = 'left'
        ly += 40
      }
    }
  }

  // Footer.
  ctx.fillStyle = DIM
  ctx.font = `500 20px ${MONO}`
  ctx.textAlign = 'center'
  ctx.fillText('OMNIO · LOCAL HOBBY TRACKER', W / 2, H - 60)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

// Rounded-rect path (Canvas 2D still doesn't have this natively across
// all engines Electron might ship with).
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function itemYear(i: Item): string | null {
  const m = /^(\d{4})/.exec(i.finishedAt ?? '')
  return m ? m[1] : null
}

function num(s?: string): number {
  const n = parseFloat(s ?? '')
  return isNaN(n) ? 0 : n
}

export default function YearlyWrapped({ items, onClose }: Props) {
  const availableYears = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) {
      const y = itemYear(it)
      if (y) s.add(y)
    }
    if (s.size === 0) s.add(String(new Date().getFullYear()))
    return Array.from(s).sort((a, b) => b.localeCompare(a))
  }, [items])

  const [year, setYear] = useState<string>(availableYears[0])

  const finishedInYear = useMemo(
    () => items.filter((i) => itemYear(i) === year),
    [items, year],
  )

  const perCategory = useMemo(() => {
    const m: Record<string, Item[]> = {}
    for (const it of finishedInYear) {
      if (!m[it.categoryId]) m[it.categoryId] = []
      m[it.categoryId].push(it)
    }
    return m
  }, [finishedInYear])

  const games = perCategory['videojuegos'] ?? []
  const movies = perCategory['peliculas'] ?? []
  const series = perCategory['series'] ?? []
  const anime = [...(perCategory['anime'] ?? []), ...(perCategory['donghua'] ?? [])]
  const manga = [
    ...(perCategory['manga'] ?? []),
    ...(perCategory['manhwa'] ?? []),
    ...(perCategory['manhua'] ?? []),
    ...(perCategory['comics_west'] ?? []),
  ]
  const music = perCategory['musica'] ?? []

  const totalPlayHours = games.reduce((s, g) => s + num(g.playTime), 0)
  const totalEpisodes = [...series, ...anime].reduce((s, g) => s + num(g.episodesWatched), 0)
  const totalChapters = manga.reduce((s, g) => s + num(g.chaptersRead), 0)

  const ratedInYear = finishedInYear.filter((i) => i.rating)
  const avgRating = ratedInYear.length
    ? (ratedInYear.reduce((s, i) => s + (i.rating ?? 0), 0) / ratedInYear.length).toFixed(2)
    : null

  const topRated = [...ratedInYear].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5)

  // Bucket by ISO month to find your busiest.
  const monthCounts: Record<string, number> = {}
  for (const it of finishedInYear) {
    const m = /^\d{4}-(\d{2})/.exec(it.finishedAt ?? '')
    if (m) monthCounts[m[1]] = (monthCounts[m[1]] ?? 0) + 1
  }
  const bestMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]
  const monthName = (mm: string) => new Date(Date.UTC(2000, parseInt(mm, 10) - 1, 1)).toLocaleString('en', { month: 'long' })

  // Top talent — mix categories that have the field.
  const tally = (getter: (i: Item) => string[] | undefined) => {
    const m: Record<string, number> = {}
    for (const it of finishedInYear) for (const v of getter(it) ?? []) m[v] = (m[v] ?? 0) + 1
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }
  const topDevs = tally((i) => i.devs)
  const topStudios = tally((i) => i.studios)
  const topGenres = tally((i) => i.genres)

  const [exporting, setExporting] = useState(false)

  const handleExportPng = async () => {
    if (finishedInYear.length === 0) return
    setExporting(true)
    try {
      const categoryLines: WrappedSnapshot['categoryLines'] = []
      if (games.length > 0)  categoryLines.push({ label: 'Games',           count: games.length,  sub: totalPlayHours ? `${totalPlayHours.toFixed(1)}h played` : undefined })
      if (movies.length > 0) categoryLines.push({ label: 'Movies',          count: movies.length })
      if (series.length > 0) categoryLines.push({ label: 'Series',          count: series.length, sub: totalEpisodes ? `${totalEpisodes} episodes` : undefined })
      if (anime.length > 0)  categoryLines.push({ label: 'Anime + Donghua', count: anime.length,  sub: totalEpisodes ? `${totalEpisodes} episodes` : undefined })
      if (manga.length > 0)  categoryLines.push({ label: 'Comics + Manga',  count: manga.length,  sub: totalChapters ? `${totalChapters} chapters` : undefined })
      if (music.length > 0)  categoryLines.push({ label: 'Music',           count: music.length })
      const snap: WrappedSnapshot = {
        year,
        totalFinished: finishedInYear.length,
        avgRating,
        busiestMonth: bestMonth ? monthName(bestMonth[0]) : null,
        busiestMonthCount: bestMonth ? bestMonth[1] : 0,
        categoryLines,
        topRated: topRated.map((it) => ({
          title: it.title,
          rating: it.rating ?? 0,
          category: CATEGORIES.find((c) => c.id === it.categoryId)?.label ?? '',
          coverSrc: assetSrc(it.cover),
        })),
        highlights: [
          topDevs.length ? { label: 'Developers', entries: topDevs } : null,
          topStudios.length ? { label: 'Studios',    entries: topStudios } : null,
          topGenres.length ? { label: 'Genres',     entries: topGenres } : null,
        ].filter((x): x is { label: string; entries: [string, number][] } => x !== null),
      }
      const dataUrl = await drawWrapped(snap)
      triggerDownload(dataUrl, `Omnio Wrapped ${year}.png`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel wrapped-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <span className="wrapped-year">Wrapped {year}</span>
          </h2>
          <div className="wrapped-year-picker">
            {availableYears.map((y) => (
              <button key={y} type="button" className={y === year ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>
            ))}
          </div>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleExportPng}
            disabled={exporting || finishedInYear.length === 0}
            style={{ marginRight: 8 }}
          >{exporting ? 'Rendering…' : '⬇ Export as image'}</button>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {finishedInYear.length === 0 ? (
            <p className="hint">
              You didn't mark anything as finished in {year}. Fill in the <em>Completion date</em>
              or <em>Listened on</em> field on your items and come back.
            </p>
          ) : (
            <>
              <div className="wrapped-hero">
                <div className="wrapped-big">
                  <div className="n">{finishedInYear.length}</div>
                  <div className="l">items finished</div>
                </div>
                {avgRating && (
                  <div className="wrapped-big">
                    <div className="n"><span className="accent">★</span> {avgRating}</div>
                    <div className="l">average rating</div>
                  </div>
                )}
                {bestMonth && (
                  <div className="wrapped-big">
                    <div className="n">{monthName(bestMonth[0])}</div>
                    <div className="l">busiest month · {bestMonth[1]} finished</div>
                  </div>
                )}
              </div>

              <div className="wrapped-cats">
                {games.length > 0 && (
                  <CatBlock label="Games" count={games.length}
                    subline={totalPlayHours ? `${totalPlayHours.toFixed(1)}h played` : undefined} />
                )}
                {movies.length > 0 && <CatBlock label="Movies" count={movies.length} />}
                {series.length > 0 && (
                  <CatBlock label="Series" count={series.length}
                    subline={totalEpisodes ? `${totalEpisodes} episodes` : undefined} />
                )}
                {anime.length > 0 && (
                  <CatBlock label="Anime + Donghua" count={anime.length}
                    subline={totalEpisodes ? `${totalEpisodes} episodes` : undefined} />
                )}
                {manga.length > 0 && (
                  <CatBlock label="Comics + Manga" count={manga.length}
                    subline={totalChapters ? `${totalChapters} chapters` : undefined} />
                )}
                {music.length > 0 && <CatBlock label="Music" count={music.length} />}
              </div>

              {topRated.length > 0 && (
                <div className="wrapped-section">
                  <h3>Top rated</h3>
                  <div className="wrapped-cover-strip">
                    {topRated.map((it) => (
                      <div key={it.id} className="wrapped-cover">
                        <div className="wrapped-mini">
                          {assetSrc(it.cover) ? <img src={assetSrc(it.cover)} alt={it.title} /> : <span>{it.title.charAt(0)}</span>}
                        </div>
                        <div className="wrapped-title">{it.title}</div>
                        <div className="wrapped-sub">★ {it.rating?.toFixed(1)} · {CATEGORIES.find((c) => c.id === it.categoryId)?.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(topDevs.length > 0 || topStudios.length > 0 || topGenres.length > 0) && (
                <div className="wrapped-section">
                  <h3>Highlights</h3>
                  <div className="wrapped-highlights">
                    {topDevs.length > 0 && <TopList label="Developers" data={topDevs} />}
                    {topStudios.length > 0 && <TopList label="Studios" data={topStudios} />}
                    {topGenres.length > 0 && <TopList label="Genres" data={topGenres} />}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CatBlock({ label, count, subline }: { label: string; count: number; subline?: string }) {
  return (
    <div className="wrapped-cat">
      <div className="n">{count}</div>
      <div className="l">{label}</div>
      {subline && <div className="s">{subline}</div>}
    </div>
  )
}

function TopList({ label, data }: { label: string; data: [string, number][] }) {
  return (
    <div className="wrapped-top">
      <div className="wrapped-top-label">{label}</div>
      <ol>
        {data.map(([name, n]) => (
          <li key={name}><span>{name}</span><em>{n}</em></li>
        ))}
      </ol>
    </div>
  )
}
