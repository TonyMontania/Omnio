// Shared shell for every metadata fetcher. Callers only wire up how to
// search and how to apply a hit; state, loading UI, Escape handling,
// auto-search on mount and the results list live here.

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
  hint?: ReactNode
  placeholder?: string
  initialQuery: string
  disabled?: boolean
  disabledMessage?: ReactNode
  autoSearch?: boolean
  onSearch: (query: string) => Promise<FetcherResult<T>>
  onApply: (hit: T) => Promise<void>
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

  // No overlay-click dismiss on purpose — a stray outside click while
  // typing a search would lose the query. Esc and the ✕ still close.
  return (
    <div className="modal-overlay">
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
                        <span>{m.title.charAt(0)}</span>
                        {m.thumbUrl && (
                          <img
                            src={m.thumbUrl}
                            alt=""
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                      </div>
                      <div className="anilist-text">
                        <div className="anilist-title">{m.title}</div>
                        {m.sub && <div className="anilist-sub">{m.sub}</div>}
                        {m.desc && <div className="anilist-desc">{m.desc.length > 180 ? `${m.desc.slice(0, 180)}…` : m.desc}</div>}
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
