// Shared shell for every metadata fetcher (AniList, IGDB, TMDb, Jikan, Kitsu,
// MangaDex, ComicVine, MusicBrainz, VGMdb, SGDB later). The eight fetcher files
// used to repeat the same modal skeleton — query/results/loading/error state,
// Escape close handler, auto-search on mount, search-row layout and the
// .anilist-results list markup. All of that lives here now; the callers only
// wire up "how do you search" and "how do you apply a hit".

import { useEffect, useState, type ReactNode } from 'react'

export interface FetcherHit {
  key: string | number
  title: string
  sub?: string
  thumbUrl?: string
  desc?: string
}

export interface FetcherResult<T> {
  ok: boolean
  data?: T[]
  error?: string
}

interface Props<T> {
  title: string
  hint?: ReactNode                   // one-line explainer above the search box
  placeholder?: string
  initialQuery: string
  disabled?: boolean                 // e.g. no API key set yet
  disabledMessage?: ReactNode
  autoSearch?: boolean               // default: true when initialQuery is set
  onSearch: (query: string) => Promise<FetcherResult<T>>
  onApply: (hit: T) => Promise<void> // caller closes the modal itself
  renderHit: (hit: T) => FetcherHit
  onClose: () => void
}

export function FetcherModal<T>({
  title, hint, placeholder, initialQuery, disabled, disabledMessage,
  autoSearch = true, onSearch, onApply, renderHit, onClose,
}: Props<T>) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applyingKey, setApplyingKey] = useState<string | number | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const doSearch = async () => {
    if (disabled || !query.trim()) return
    setLoading(true); setError(null)
    const r = await onSearch(query.trim())
    setLoading(false)
    if (r.ok) setResults(r.data ?? [])
    else setError(r.error ?? 'Search failed')
  }

  useEffect(() => {
    if (autoSearch && !disabled && (initialQuery ?? '').trim()) doSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApply = async (hit: T) => {
    const meta = renderHit(hit)
    setApplyingKey(meta.key)
    try { await onApply(hit) } finally { setApplyingKey(null) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel fetch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {disabled && disabledMessage && (
            <p className="hint" style={{ color: 'var(--danger)' }}>{disabledMessage}</p>
          )}
          {hint && <p className="hint" style={{ marginTop: 0 }}>{hint}</p>}
          <div className="fetch-search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
              placeholder={placeholder ?? 'Search…'}
              disabled={disabled}
              autoFocus
            />
            <button type="button" className="secondary-btn" onClick={doSearch} disabled={disabled || loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p>}
          {!loading && !error && results.length === 0 && query && !disabled && (
            <p className="hint">No matches. Try a different spelling.</p>
          )}
          {results.length > 0 && (
            <ul className="anilist-results">
              {results.map((hit) => {
                const m = renderHit(hit)
                return (
                  <li key={m.key}>
                    <button type="button" className="anilist-hit" onClick={() => handleApply(hit)} disabled={applyingKey !== null}>
                      <div className="anilist-thumb">
                        {m.thumbUrl ? <img src={m.thumbUrl} alt="" loading="lazy" /> : <span>{m.title.charAt(0)}</span>}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{m.title}</div>
                        {m.sub && <div className="anilist-sub">{m.sub}</div>}
                        {m.desc && <div className="anilist-desc">{m.desc.slice(0, 180)}…</div>}
                      </div>
                      {applyingKey === m.key && <span className="anilist-applying">Applying…</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
