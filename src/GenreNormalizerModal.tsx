// Genre normalizer. Detects genre labels that are the "same concept
// different spelling" ("Sci-Fi" / "Science Fiction" / "Ciencia ficción")
// by normalizing each string to a slug (lowercase, strip accents,
// collapse whitespace, remove punctuation) and grouping variants that
// collapse to the same slug. Users pick a canonical label per group and
// merge — everything is rewritten in one pass across affected items.
// Applies only to `genres[]`. Tags are user-authored and stay untouched
// (see memory/feedback_genres_vs_tags.md).

import { useMemo, useState } from 'react'
import type { Item } from './types'

type Props = {
  items: Item[]
  onClose: () => void
  onApply: (mapping: Record<string, string>) => void
}

function normalize(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

type Group = {
  slug: string
  variants: { label: string; count: number }[]
  totalUses: number
  affectedItems: number
}

export default function GenreNormalizerModal({ items, onClose, onApply }: Props) {
  const groups = useMemo<Group[]>(() => {
    // variant string → count of items that carry it
    const counts = new Map<string, number>()
    const itemsByVariant = new Map<string, Set<string>>()
    for (const item of items) {
      const seen = new Set<string>()
      for (const g of item.genres ?? []) {
        if (!g || typeof g !== 'string') continue
        if (seen.has(g)) continue
        seen.add(g)
        counts.set(g, (counts.get(g) ?? 0) + 1)
        if (!itemsByVariant.has(g)) itemsByVariant.set(g, new Set())
        itemsByVariant.get(g)!.add(item.id)
      }
    }
    // Bucket variants by normalized slug.
    const buckets = new Map<string, { label: string; count: number }[]>()
    for (const [label, count] of counts) {
      const slug = normalize(label)
      if (!slug) continue
      if (!buckets.has(slug)) buckets.set(slug, [])
      buckets.get(slug)!.push({ label, count })
    }
    const result: Group[] = []
    for (const [slug, variants] of buckets) {
      if (variants.length < 2) continue
      variants.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      const affected = new Set<string>()
      for (const v of variants) for (const id of itemsByVariant.get(v.label) ?? []) affected.add(id)
      result.push({
        slug,
        variants,
        totalUses: variants.reduce((s, v) => s + v.count, 0),
        affectedItems: affected.size,
      })
    }
    result.sort((a, b) => b.totalUses - a.totalUses)
    return result
  }, [items])

  // Per-group state: chosen canonical label + set of variants to include
  // in the merge. Default: canonical = most-used variant, all variants
  // selected. User can uncheck any variant to leave it alone.
  const [state, setState] = useState<Record<string, { canonical: string; selected: Set<string> }>>(() => {
    const init: Record<string, { canonical: string; selected: Set<string> }> = {}
    for (const g of groups) {
      init[g.slug] = {
        canonical: g.variants[0].label,
        selected: new Set(g.variants.map((v) => v.label)),
      }
    }
    return init
  })

  const setCanonical = (slug: string, value: string) => {
    setState((s) => ({ ...s, [slug]: { ...s[slug], canonical: value } }))
  }
  const toggleVariant = (slug: string, variant: string) => {
    setState((s) => {
      const cur = s[slug]
      const next = new Set(cur.selected)
      if (next.has(variant)) next.delete(variant); else next.add(variant)
      return { ...s, [slug]: { ...cur, selected: next } }
    })
  }

  const mergeGroup = (group: Group) => {
    const cur = state[group.slug]
    if (!cur || !cur.canonical.trim() || cur.selected.size < 2) return
    const mapping: Record<string, string> = {}
    for (const v of group.variants) {
      if (cur.selected.has(v.label) && v.label !== cur.canonical) {
        mapping[v.label] = cur.canonical.trim()
      }
    }
    if (Object.keys(mapping).length === 0) return
    onApply(mapping)
    // Local update: mark the merged group as resolved by removing it from
    // the view. The parent's items reload will refresh groups anyway, but
    // this makes the click feel snappier before that repaint.
    setState((s) => {
      const next = { ...s }
      delete next[group.slug]
      return next
    })
  }

  const mergeAll = () => {
    const mapping: Record<string, string> = {}
    for (const group of groups) {
      const cur = state[group.slug]
      if (!cur || !cur.canonical.trim() || cur.selected.size < 2) continue
      for (const v of group.variants) {
        if (cur.selected.has(v.label) && v.label !== cur.canonical) {
          mapping[v.label] = cur.canonical.trim()
        }
      }
    }
    if (Object.keys(mapping).length === 0) return
    onApply(mapping)
  }

  const remainingGroups = groups.filter((g) => state[g.slug])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel genre-normalizer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '92vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Genre normalizer</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {remainingGroups.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>
              No duplicate-looking genres detected. Your library's genre labels normalize to
              unique slugs — nothing to merge.
            </p>
          ) : (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                Detected {remainingGroups.length} group{remainingGroups.length === 1 ? '' : 's'} of genre labels that look like the same
                concept spelled differently. Pick the canonical label per group and click <b>Merge</b>.
                Only <code>genres[]</code> is touched — your <code>tags[]</code> stay as-is.
              </p>
              <div className="genre-groups">
                {remainingGroups.map((group) => {
                  const cur = state[group.slug]
                  const selectedCount = cur.selected.size
                  const canonicalEmpty = !cur.canonical.trim()
                  const canMerge = selectedCount >= 2 && !canonicalEmpty
                  return (
                    <div key={group.slug} className="genre-group">
                      <div className="genre-group-header">
                        <span className="genre-group-meta">
                          {selectedCount} of {group.variants.length} selected · {group.affectedItems} item{group.affectedItems === 1 ? '' : 's'} affected
                        </span>
                      </div>
                      <ul className="genre-variants">
                        {group.variants.map((v) => (
                          <li key={v.label}>
                            <label>
                              <input
                                type="checkbox"
                                checked={cur.selected.has(v.label)}
                                onChange={() => toggleVariant(group.slug, v.label)}
                              />
                              <span className="genre-variant-label">{v.label}</span>
                              <span className="genre-variant-count">{v.count}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <div className="genre-group-actions">
                        <label className="genre-canonical-field">
                          <span>Merge as</span>
                          <input
                            type="text"
                            value={cur.canonical}
                            onChange={(e) => setCanonical(group.slug, e.target.value)}
                            list={`canon-suggest-${group.slug}`}
                          />
                          <datalist id={`canon-suggest-${group.slug}`}>
                            {group.variants.map((v) => <option key={v.label} value={v.label} />)}
                          </datalist>
                        </label>
                        <button type="button" className="secondary-btn" disabled={!canMerge} onClick={() => mergeGroup(group)}>Merge</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
        {remainingGroups.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Close</button>
            <button type="button" className="primary-btn" onClick={mergeAll}>Merge all groups</button>
          </div>
        )}
      </div>
    </div>
  )
}
