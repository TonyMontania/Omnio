// SQLite FTS5 search PoC — opened with Ctrl+Shift+F.
//
// Purpose: side-by-side comparison against the existing Ctrl+K palette
// so we can decide whether migrating the JSON store to SQLite is worth
// it. Reads live from an in-memory FTS5 index built at open time from
// the current items array. Does NOT persist anything.
//
// Nothing here is wired to the app data-flow — clicking a hit still
// calls the same navigateToItem the palette uses.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnyItem } from './types/entities'
import { buildIndex, query as ftsQuery, getIndexStats } from './fts/ftsIndex'
import type { FtsHit } from './fts/ftsIndex'
import { CATEGORIES } from './categories'

interface Props {
  open: boolean
  items: AnyItem[]
  onClose: () => void
  onOpenItem: (item: AnyItem) => void
}

interface UiState {
  building: boolean
  buildMs: number
  rows: number
  results: FtsHit[]
  queryMs: number
  error?: string
}

export default function FtsSearchModal({ open, items, onClose, onOpenItem }: Props) {
  const [text, setText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [state, setState] = useState<UiState>({
    building: false, buildMs: 0, rows: 0, results: [], queryMs: 0,
  })
  const inputRef = useRef<HTMLInputElement>(null)

  const itemsById = useMemo(() => {
    const map = new Map<string, AnyItem>()
    for (const it of items) map.set(it.id, it)
    return map
  }, [items])

  // (Re)build whenever the panel opens with a different items ref or
  // when it's opened for the first time. buildIndex coalesces
  // concurrent calls so StrictMode's double-invoke doesn't race on the
  // module-level DB handle.
  useEffect(() => {
    if (!open) return
    const stats = getIndexStats()
    if (stats.built && stats.sourceRef === items) {
      setState((s) => ({ ...s, building: false, buildMs: stats.buildMs, rows: stats.rows }))
      return
    }
    setState((s) => ({ ...s, building: true, error: undefined, results: [] }))
    let cancelled = false
    void (async () => {
      try {
        const r = await buildIndex(items)
        if (cancelled) return
        setState((s) => ({ ...s, building: false, buildMs: r.ms, rows: r.rows, error: undefined }))
      } catch (e) {
        if (cancelled) return
        setState((s) => ({ ...s, building: false, error: (e as Error).message }))
      }
    })()
    return () => { cancelled = true }
  }, [open, items])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  // Debounced query. Waits 80ms after the last keystroke so fast typing
  // doesn't re-run FTS5 five times a second.
  useEffect(() => {
    if (!open) return
    if (state.building) return
    if (!text.trim()) {
      setState((s) => ({ ...s, results: [], queryMs: 0 }))
      return
    }
    const t = setTimeout(async () => {
      const start = performance.now()
      try {
        const results = await ftsQuery(text, {
          limit: 50,
          categoryFilter: categoryFilter || undefined,
        })
        const ms = performance.now() - start
        setState((s) => ({ ...s, results, queryMs: ms, error: undefined }))
      } catch (e) {
        setState((s) => ({ ...s, error: (e as Error).message }))
      }
    }, 80)
    return () => clearTimeout(t)
  }, [text, categoryFilter, open, state.building])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const total = state.results.length
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 780, width: '92vw', maxHeight: '82vh' }}
      >
        <div className="modal-header">
          <h2>SQLite FTS5 search <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>PoC</span></h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={inputRef}
              className="search-input"
              placeholder="Search across every long text field (title, description, notes, review…)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="sort-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ maxWidth: 180 }}
              title="Restrict to one library"
            >
              <option value="">All libraries</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {state.building
              ? <span>Building index…</span>
              : <span>Indexed <b>{state.rows}</b> rows in <b>{state.buildMs.toFixed(0)}ms</b></span>}
            {!state.building && text.trim() && (
              <>
                <span>Query: <b>{state.queryMs.toFixed(1)}ms</b></span>
                <span><b>{total}</b> hit{total === 1 ? '' : 's'}</span>
              </>
            )}
            {state.error && <span style={{ color: 'var(--danger)' }}>Error: {state.error}</span>}
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {state.results.length === 0 && !state.building && text.trim() && (
              <div className="empty-state small">
                <p>No matches. Try fewer / shorter words, or a different tense.</p>
              </div>
            )}
            {state.results.map((hit) => (
              <FtsHitRow
                key={hit.itemId}
                hit={hit}
                onOpen={() => {
                  const it = itemsById.get(hit.itemId)
                  if (it) { onOpenItem(it); onClose() }
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.5, paddingTop: 4, borderTop: '1px solid var(--border-soft)' }}>
            <b>How this differs from Ctrl+K:</b> matches inside descriptions, notes, and reviews too — not just titles/tags. Ranking is BM25 (SQLite's FTS5 built-in): more matches + rarer terms = higher score. Word prefixes match (typing <code>alta</code> finds <code>Altair</code>). Try queries like <code>credo asesinos</code>, <code>protagonist trauma</code>, or a phrase from a note.
          </div>
        </div>
      </div>
    </div>
  )
}

function FtsHitRow({ hit, onOpen }: { hit: FtsHit; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        textAlign: 'left',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
        color: 'var(--text)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hit.title}</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{hit.categoryLabel}</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>score {hit.score.toFixed(2)}</span>
      </div>
      {hit.snippet && (
        <div
          style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.45 }}
          dangerouslySetInnerHTML={{ __html: sanitizeSnippet(hit.snippet) }}
        />
      )}
      {hit.matchedFields.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {hit.matchedFields.map((f) => (
            <span key={f} style={{ fontSize: 9.5, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '1px 5px', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', borderRadius: 3 }}>{f}</span>
          ))}
        </div>
      )}
    </button>
  )
}

// Snippets come back with <mark></mark> only (safe). Guard against
// anything else the JSON might have thrown in there.
function sanitizeSnippet(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>')
}
