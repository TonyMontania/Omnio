// Horizontal cover-only strip used by every detail modal for Related /
// Recommendations / Derived works / Original work sections. Same DOM in
// every category — only the section label, the item list and (optionally)
// the per-cover badge change.

import type { Item, RelationKind } from '../../types'
import { getRelationLabel, assetSrc } from '../../types'

export interface StripEntry {
  item: Item
  badge?: RelationKind | string   // shown as a small pill overlaying the cover
}

export default function DetailCoverStrip({ label, entries, onNavigate }: {
  label: string
  entries: StripEntry[]
  onNavigate: (id: string) => void
}) {
  if (entries.length === 0) return null
  return (
    <div className="field-group">
      <label>{label}</label>
      <div className="cover-strip">
        {entries.map(({ item, badge }) => {
          const badgeLabel = typeof badge === 'string' && badge in RELATION_KIND_LABELS
            ? getRelationLabel(badge as RelationKind)
            : badge
          return (
            <button key={item.id} type="button" className="cover-strip-item" onClick={() => onNavigate(item.id)} title={badgeLabel ? `${item.title} — ${badgeLabel}` : item.title}>
              {item.cover
                ? <img src={assetSrc(item.cover)} alt={item.title} />
                : <div className="cover-strip-placeholder">{item.title.slice(0, 2).toUpperCase()}</div>}
              {badgeLabel && <span className="cover-strip-badge">{badgeLabel}</span>}
              {!badgeLabel && <span className="cover-strip-title">{item.title}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Tiny lookup so we can distinguish arbitrary badge strings (e.g. game source
// labels used in derivedWorks) from actual RelationKind values.
const RELATION_KIND_LABELS: Record<string, true> = {
  sequel: true, prequel: true, side_story: true, spin_off: true, standalone: true,
  dlc_expansion: true, remake: true, remaster: true, reboot: true, port: true,
  alt_version: true, same_collection: true, same_series: true, same_universe: true,
  crossover: true, adaptation: true, other: true,
}
