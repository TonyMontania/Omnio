// Manages the "related items" list for an entry — each row also picks a
// relation kind (sequel, prequel, adaptation, etc.).

import type { RelatedItem, Item, RelationKind } from '../../types'
import { RELATION_OPTIONS } from '../../types'
import AnimeItemPicker from './AnimeItemPicker'

export default function RelatedListEditor({ related, options, onAdd, onRemove, onChangeRelation, pickerPlaceholder }: {
  related: RelatedItem[]
  options: Item[]
  onAdd: (itemId: string) => void
  onRemove: (itemId: string) => void
  onChangeRelation: (itemId: string, r: RelationKind) => void
  pickerPlaceholder?: string
}) {
  const lookup = (id: string) => options.find((o) => o.id === id)
  return (
    <div>
      <AnimeItemPicker options={options} excludeIds={related.map((r) => r.itemId)} onPick={onAdd} placeholder={pickerPlaceholder ?? 'Add related…'} />
      {related.length > 0 && (
        <div className="related-list">
          {related.map((r) => {
            const it = lookup(r.itemId)
            return (
              <div key={r.itemId} className="related-row">
                {it?.cover && <img src={it.cover} alt="" />}
                <span className="related-title">{it?.title ?? '(missing)'}</span>
                <select value={r.relation} onChange={(e) => onChangeRelation(r.itemId, e.target.value as RelationKind)}>
                  {RELATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button type="button" className="track-remove" onClick={() => onRemove(r.itemId)}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
