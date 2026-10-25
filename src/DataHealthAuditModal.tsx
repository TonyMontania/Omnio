// Data health audit. Walks every item in the library and reports what
// "important" fields are missing per category. Non-destructive — just a
// diagnostic list. Click a row to jump into the editor and fix it.
//
// Field criteria are opinionated but conservative: they cover the fields
// most users would consider "core" for that library type (a Game without
// a status or platforms is incomplete; an Anime without a watchStatus or
// studios is incomplete). Anything more subjective (reviews, franchise,
// per-track ratings) is left out — this is about completeness of the
// metadata skeleton, not about how much a user has annotated.

import { useMemo, useState } from 'react'
import type { Item } from './types'
import { assetSrc } from './types'
import { CATEGORIES } from './categories'
import { t } from './i18n'

const categoryLabelOf = (id: string): string => CATEGORIES.find((c) => c.id === id)?.label ?? id

type Props = {
  items: Item[]
  onOpenItem: (item: Item) => void
  onClose: () => void
}

type Miss = { key: string; label: string }
type Row = { item: Item; misses: Miss[] }

const isEmptyString = (v: unknown): boolean => typeof v !== 'string' || v.trim() === ''
const isEmptyArr = (v: unknown): boolean => !Array.isArray(v) || v.length === 0

// Rules per category. Each entry: field key (for the chip label), user-
// facing label, and a predicate that returns true when the field is
// considered missing on that item. Kept as arrays (not maps) so the UI
// shows them in a consistent order.
type Rule = { key: string; label: string; missing: (i: Item) => boolean }
const RULES_PER_CATEGORY: Record<string, Rule[]> = {
  videojuegos: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'gameStatus', label: t('Status'), missing: (i) => isEmptyString(i.gameStatus) },
    { key: 'platforms', label: t('Platforms'), missing: (i) => isEmptyArr(i.platforms) },
    { key: 'releaseDate', label: t('Release date'), missing: (i) => isEmptyString(i.releaseDate) && isEmptyString(i.releaseYear) },
    { key: 'devs', label: t('Developers'), missing: (i) => isEmptyArr(i.devs) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  musica: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'artist', label: t('Artist'), missing: (i) => isEmptyString(i.artist) },
    { key: 'musicType', label: t('Type'), missing: (i) => isEmptyString(i.musicType) },
    { key: 'releaseYear', label: t('Release year'), missing: (i) => isEmptyString(i.releaseYear) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  peliculas: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'releaseYear', label: t('Release year'), missing: (i) => isEmptyString(i.releaseYear) && isEmptyString(i.releaseDate) },
    { key: 'duration', label: t('Duration'), missing: (i) => isEmptyString(i.duration) },
    { key: 'directors', label: t('Directors'), missing: (i) => isEmptyArr(i.directors) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  series: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'seriesStatus', label: t('Status'), missing: (i) => isEmptyString(i.seriesStatus) },
    { key: 'releaseYear', label: t('Release year'), missing: (i) => isEmptyString(i.releaseYear) },
    { key: 'totalEpisodes', label: t('Total episodes'), missing: (i) => isEmptyString(i.totalEpisodes) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  anime: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'watchStatus', label: t('Watch status'), missing: (i) => isEmptyString(i.watchStatus) },
    { key: 'animeFormat', label: t('Format'), missing: (i) => isEmptyString(i.animeFormat) },
    { key: 'totalEpisodes', label: t('Total episodes'), missing: (i) => isEmptyString(i.totalEpisodes) },
    { key: 'studios', label: t('Studios'), missing: (i) => isEmptyArr(i.studios) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  donghua: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'watchStatus', label: t('Watch status'), missing: (i) => isEmptyString(i.watchStatus) },
    { key: 'animeFormat', label: t('Format'), missing: (i) => isEmptyString(i.animeFormat) },
    { key: 'totalEpisodes', label: t('Total episodes'), missing: (i) => isEmptyString(i.totalEpisodes) },
    { key: 'studios', label: t('Studios'), missing: (i) => isEmptyArr(i.studios) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  manga: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'mangaStatus', label: t('Reading status'), missing: (i) => isEmptyString(i.mangaStatus) },
    { key: 'pubStatus', label: t('Publication status'), missing: (i) => isEmptyString(i.pubStatus) },
    { key: 'authors', label: t('Authors'), missing: (i) => isEmptyArr(i.authors) },
    { key: 'totalChapters', label: t('Total chapters'), missing: (i) => isEmptyString(i.totalChapters) && isEmptyString(i.totalVolumes) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  manhwa: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'mangaStatus', label: t('Reading status'), missing: (i) => isEmptyString(i.mangaStatus) },
    { key: 'pubStatus', label: t('Publication status'), missing: (i) => isEmptyString(i.pubStatus) },
    { key: 'authors', label: t('Authors'), missing: (i) => isEmptyArr(i.authors) },
    { key: 'totalChapters', label: t('Total chapters'), missing: (i) => isEmptyString(i.totalChapters) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  manhua: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'mangaStatus', label: t('Reading status'), missing: (i) => isEmptyString(i.mangaStatus) },
    { key: 'pubStatus', label: t('Publication status'), missing: (i) => isEmptyString(i.pubStatus) },
    { key: 'authors', label: t('Authors'), missing: (i) => isEmptyArr(i.authors) },
    { key: 'totalChapters', label: t('Total chapters'), missing: (i) => isEmptyString(i.totalChapters) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  comics_west: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'mangaStatus', label: t('Reading status'), missing: (i) => isEmptyString(i.mangaStatus) },
    { key: 'pubStatus', label: t('Publication status'), missing: (i) => isEmptyString(i.pubStatus) },
    { key: 'authors', label: t('Authors'), missing: (i) => isEmptyArr(i.authors) },
    { key: 'totalChapters', label: t('Total issues'), missing: (i) => isEmptyString(i.totalChapters) },
    { key: 'genres', label: t('Genres'), missing: (i) => isEmptyArr(i.genres) },
  ],
  libros: [
    { key: 'cover', label: t('Cover'), missing: (i) => isEmptyString(i.cover) },
    { key: 'rating', label: t('Rating'), missing: (i) => !i.rating },
    { key: 'bookStatus', label: t('Reading status'), missing: (i) => isEmptyString(i.bookStatus) },
    { key: 'authors', label: t('Authors'), missing: (i) => isEmptyArr(i.authors) },
    { key: 'bookFormat', label: t('Format'), missing: (i) => isEmptyString(i.bookFormat) },
    { key: 'publisher', label: t('Publisher'), missing: (i) => isEmptyString(i.publisher) },
    { key: 'totalPages', label: t('Total pages'), missing: (i) => isEmptyString(i.totalPages) },
  ],
}

export default function DataHealthAuditModal({ items, onOpenItem, onClose }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>('__all__')
  const [severityFilter, setSeverityFilter] = useState<'any' | 'multi'>('any')

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const item of items) {
      const rules = RULES_PER_CATEGORY[item.categoryId]
      if (!rules) continue
      const misses = rules.filter((r) => r.missing(item)).map(({ key, label }) => ({ key, label }))
      if (misses.length > 0) out.push({ item, misses })
    }
    // Most-missing first — the items that need the most love bubble up.
    out.sort((a, b) => b.misses.length - a.misses.length || a.item.title.localeCompare(b.item.title))
    return out
  }, [items])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (categoryFilter !== '__all__' && r.item.categoryId !== categoryFilter) return false
      if (severityFilter === 'multi' && r.misses.length < 3) return false
      return true
    })
  }, [rows, categoryFilter, severityFilter])

  // Categories with hits + their per-category count in one pass — avoids the
  // O(N × cats) rescans the dropdown would otherwise do inside its .map.
  const { categoriesInResults, countByCat } = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.item.categoryId, (counts.get(r.item.categoryId) ?? 0) + 1)
    return { categoriesInResults: Array.from(counts.keys()), countByCat: counts }
  }, [rows])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel audit-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>{t('Audit incomplete items')}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            {rows.length === 0
              ? t('Every item in your library has every core field filled in for its category. Nothing to fix.')
              : <>{t('Scanned')}{' '}<b>{items.length}</b>{' '}{t('items ·')}{' '}<b>{rows.length}</b>{' '}{t('are missing at least one core field. Click a row to open the editor and fill in what\'s missing.')}</>}
          </p>

          {rows.length > 0 && (
            <>
              <div className="audit-filters">
                <label>
                  <span>{t('Library')}</span>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="__all__">{t('All ({rows})', { rows: rows.length })}</option>
                    {categoriesInResults.map((c) => {
                      const count = countByCat.get(c) ?? 0
                      return <option key={c} value={c}>{categoryLabelOf(c)} ({count})</option>
                    })}
                  </select>
                </label>
                <label>
                  <span>{t('Severity')}</span>
                  <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as 'any' | 'multi')}>
                    <option value="any">{t('Any missing field')}</option>
                    <option value="multi">{t('3+ missing fields')}</option>
                  </select>
                </label>
                <span className="audit-count">{t('Showing {filtered}', { filtered: filtered.length })}</span>
              </div>

              {filtered.length === 0 && (
                <p className="hint" style={{ marginTop: 16 }}>{t('No items match the current filter.')}</p>
              )}

              <ul className="audit-list">
                {filtered.map(({ item, misses }) => (
                  <li key={item.id}>
                    <button type="button" className="audit-row" onClick={() => { onOpenItem(item); onClose() }}>
                      <div className="audit-cover">
                        {item.cover
                          ? <img src={assetSrc(item.cover)} alt="" />
                          : <span className="audit-cover-empty">?</span>}
                      </div>
                      <div className="audit-body">
                        <div className="audit-title-row">
                          <span className="audit-title">{item.title}</span>
                          <span className="audit-cat">{categoryLabelOf(item.categoryId)}</span>
                        </div>
                        <div className="audit-chips">
                          {misses.map((m) => (
                            <span key={m.key} className="audit-chip">{m.label}</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
