import { useEffect, useMemo, useState } from 'react'
import type { AnimeSeason, Item } from './types'
import { getCurrentAnimeSeason } from './utils/airing'
import { ANIME_FORMAT_MAP, aniListCover, aniListTitle, formatCountdown, matchAniListMedia, type AniListMedia } from './utils/anilist'

interface Props {
  categoryId: 'anime' | 'donghua'
  items: Item[]
  onAdd: (media: AniListMedia) => Promise<void>
  onClose: () => void
}

const SEASONS: AnimeSeason[] = ['winter', 'spring', 'summer', 'fall']
const SEASON_LABEL: Record<AnimeSeason, string> = { winter: 'Winter', spring: 'Spring', summer: 'Summer', fall: 'Fall' }

function shiftSeason(s: { season: AnimeSeason; year: number }, delta: -1 | 1) {
  const idx = SEASONS.indexOf(s.season) + delta
  if (idx < 0) return { season: SEASONS[3], year: s.year - 1 }
  if (idx > 3) return { season: SEASONS[0], year: s.year + 1 }
  return { season: SEASONS[idx], year: s.year }
}

export default function SeasonBrowser({ categoryId, items, onAdd, onClose }: Props) {
  const [period, setPeriod] = useState(getCurrentAnimeSeason)
  const [media, setMedia] = useState<AniListMedia[] | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState<number | null>(null)
  const [added, setAdded] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    setError('')
    if (page === 1) setMedia(null)
    void (async () => {
      const r = await window.ipcRenderer.invoke('anilist:season', period.season, period.year, page)
      if (cancelled) return
      if (!r?.ok) { setError(r?.error ?? 'Could not load the season'); setMedia((m) => m ?? []); return }
      const list = r.data as AniListMedia[]
      setHasMore(list.length === 50)
      setMedia((prev) => (page === 1 ? list : [...(prev ?? []), ...list]))
    })()
    return () => { cancelled = true }
  }, [period, page])

  const shown = useMemo(() => (media ?? []).filter((m) =>
    categoryId === 'donghua' ? m.countryOfOrigin === 'CN' : m.countryOfOrigin !== 'CN'), [media, categoryId])

  const inLibrary = (m: AniListMedia): boolean => {
    if (added.has(m.id)) return true
    const library = items.filter((i) => i.categoryId === categoryId)
    if (library.some((i) => i.anilistId === m.id)) return true
    return library.some((i) => matchAniListMedia([m], [i.title, ...(i.alternativeTitles ?? [])]))
  }

  const add = async (m: AniListMedia) => {
    setAdding(m.id)
    try {
      await onAdd(m)
      setAdded((s) => new Set(s).add(m.id))
    } finally {
      setAdding(null)
    }
  }

  const go = (delta: -1 | 1) => { setPeriod((p) => shiftSeason(p, delta)); setPage(1) }

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div className="modal-panel fetch-modal season-browser" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{SEASON_LABEL[period.season]} {period.year} on AniList</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="season-browser-nav">
            <button type="button" className="secondary-btn" onClick={() => go(-1)}>← {SEASON_LABEL[shiftSeason(period, -1).season]}</button>
            <span className="hint">Most popular first · {categoryId === 'donghua' ? 'Chinese productions' : 'excluding Chinese productions'}</span>
            <button type="button" className="secondary-btn" onClick={() => go(1)}>{SEASON_LABEL[shiftSeason(period, 1).season]} →</button>
          </div>
          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {media === null ? (
            <p className="hint">Loading the season…</p>
          ) : shown.length === 0 ? (
            <p className="hint">Nothing found for this season.</p>
          ) : (
            <div className="season-browser-grid">
              {shown.map((m) => {
                const owned = inLibrary(m)
                const next = m.nextAiringEpisode
                const meta = [
                  m.format ? (ANIME_FORMAT_MAP[m.format] ?? m.format).toUpperCase() : null,
                  m.episodes ? `${m.episodes} eps` : null,
                  m.studios?.nodes?.[0]?.name,
                ].filter(Boolean).join(' · ')
                return (
                  <div key={m.id} className="season-card">
                    <div className="season-card-cover">
                      {aniListCover(m) && <img src={aniListCover(m)} alt="" loading="lazy" />}
                      {next && <span className="season-card-next">Ep {next.episode} · {formatCountdown(next.airingAt)}</span>}
                    </div>
                    <div className="season-card-title" title={aniListTitle(m)}>{aniListTitle(m)}</div>
                    <div className="season-card-meta">{meta}</div>
                    {owned
                      ? <span className="season-card-owned">In library</span>
                      : <button type="button" className="secondary-btn compact" disabled={adding !== null} onClick={() => void add(m)}>{adding === m.id ? 'Adding…' : '+ Add'}</button>}
                  </div>
                )
              })}
            </div>
          )}
          {hasMore && media && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button type="button" className="secondary-btn" onClick={() => setPage((p) => p + 1)}>Load more</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
