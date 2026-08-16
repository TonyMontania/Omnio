// Role normalizer. Same shape as GenreNormalizerModal but scans
// MusicArtist.members[].roles and MusicArtist.members[].stints[].roles
// across every artist. Detects variants that normalize to the same
// slug ("Vocals" / "vocals" / "Voz" / "Vocal") and lets the user pick
// a canonical label per group. Everything is rewritten in one pass so
// the band-timeline color palette stays consistent and the roles
// autocomplete stops offering three versions of the same thing.

import { useMemo, useState } from 'react'
import type { MusicArtist } from './types'

type Props = {
  artists: MusicArtist[]
  onClose: () => void
  onApply: (mapping: Record<string, string>) => void
}

function normalize(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// "vocals" → "Vocals", "clean vocals" → "Clean Vocals". Applied to the
// default canonical suggestion so the picker leads with a properly
// title-cased option instead of the noisiest raw variant.
function titleCase(s: string): string {
  return s.trim().split(/\s+/).map((w) => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join(' ')
}

type Group = {
  slug: string
  variants: { label: string; count: number }[]
  totalUses: number
  affectedArtists: number
}

export default function RoleNormalizerModal({ artists, onClose, onApply }: Props) {
  const groups = useMemo<Group[]>(() => {
    const counts = new Map<string, number>()
    const artistsByVariant = new Map<string, Set<string>>()
    for (const artist of artists) {
      const seen = new Set<string>()
      const collect = (roles?: string[]) => {
        for (const r of roles ?? []) {
          if (!r || typeof r !== 'string') continue
          if (seen.has(r)) continue
          seen.add(r)
          counts.set(r, (counts.get(r) ?? 0) + 1)
          if (!artistsByVariant.has(r)) artistsByVariant.set(r, new Set())
          artistsByVariant.get(r)!.add(artist.id)
        }
      }
      for (const m of artist.members ?? []) {
        collect(m.roles)
        for (const s of m.stints ?? []) collect(s.roles)
      }
    }
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
      for (const v of variants) for (const id of artistsByVariant.get(v.label) ?? []) affected.add(id)
      result.push({
        slug,
        variants,
        totalUses: variants.reduce((s, v) => s + v.count, 0),
        affectedArtists: affected.size,
      })
    }
    result.sort((a, b) => b.totalUses - a.totalUses)
    return result
  }, [artists])

  const [state, setState] = useState<Record<string, { canonical: string; selected: Set<string> }>>(() => {
    const init: Record<string, { canonical: string; selected: Set<string> }> = {}
    for (const g of groups) {
      // Default canonical = properly title-cased version of the most-used
      // variant. Wikipedia-style capitalization matches what the roles
      // autocomplete in the artist editor already suggests.
      init[g.slug] = {
        canonical: titleCase(g.variants[0].label),
        selected: new Set(g.variants.map((v) => v.label)),
      }
    }
    return init
  })

  const setCanonical = (slug: string, value: string) => setState((s) => ({ ...s, [slug]: { ...s[slug], canonical: value } }))
  const toggleVariant = (slug: string, variant: string) => setState((s) => {
    const cur = s[slug]
    const next = new Set(cur.selected)
    if (next.has(variant)) next.delete(variant); else next.add(variant)
    return { ...s, [slug]: { ...cur, selected: next } }
  })

  const mergeGroup = (group: Group) => {
    const cur = state[group.slug]
    if (!cur || !cur.canonical.trim() || cur.selected.size < 2) return
    const mapping: Record<string, string> = {}
    for (const v of group.variants) {
      if (cur.selected.has(v.label) && v.label !== cur.canonical) mapping[v.label] = cur.canonical.trim()
    }
    if (Object.keys(mapping).length === 0) return
    onApply(mapping)
    setState((s) => { const next = { ...s }; delete next[group.slug]; return next })
  }

  const mergeAll = () => {
    const mapping: Record<string, string> = {}
    for (const group of groups) {
      const cur = state[group.slug]
      if (!cur || !cur.canonical.trim() || cur.selected.size < 2) continue
      for (const v of group.variants) {
        if (cur.selected.has(v.label) && v.label !== cur.canonical) mapping[v.label] = cur.canonical.trim()
      }
    }
    if (Object.keys(mapping).length === 0) return
    onApply(mapping)
  }

  const remainingGroups = groups.filter((g) => state[g.slug])

  return (
    <div className="modal-overlay">
      <div className="modal-panel genre-normalizer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '92vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Role normalizer</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {remainingGroups.length === 0 ? (
            <p className="hint" style={{ margin: 0 }}>
              No duplicate-looking roles detected across your artists. Nothing to merge.
            </p>
          ) : (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                Detected {remainingGroups.length} group{remainingGroups.length === 1 ? '' : 's'} of role labels that look like the same
                thing spelled differently. Pick the canonical label per group and click <b>Merge</b>.
                Applies across every member's <code>roles</code> and every stint's <code>roles</code>.
              </p>
              <div className="genre-groups">
                {remainingGroups.map((group) => {
                  const cur = state[group.slug]
                  const selectedCount = cur.selected.size
                  const canonicalEmpty = !cur.canonical.trim()
                  const canMerge = selectedCount >= 2 && !canonicalEmpty
                  const titleCased = titleCase(group.variants[0].label)
                  return (
                    <div key={group.slug} className="genre-group">
                      <div className="genre-group-header">
                        <span className="genre-group-meta">
                          {selectedCount} of {group.variants.length} selected · {group.affectedArtists} artist{group.affectedArtists === 1 ? '' : 's'} affected
                        </span>
                      </div>
                      <ul className="genre-variants">
                        {group.variants.map((v) => (
                          <li key={v.label}>
                            <label>
                              <input type="checkbox" checked={cur.selected.has(v.label)} onChange={() => toggleVariant(group.slug, v.label)} />
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
                            {/* Title-cased suggestion first, then raw variants
                                so the user gets both the "clean" option and the
                                exact-string options in the same dropdown. */}
                            <option value={titleCased} />
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
