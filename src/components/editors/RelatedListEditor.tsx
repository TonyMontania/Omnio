// One editor for both Related (with per-row relation kind) and
// Recommendations (plain id list). Callers pass either `related` OR `ids`
// depending on the flavor — the row markup and picker are shared.

import type { RelatedItem, Item, RelationKind } from '../../types'
import { RELATION_OPTIONS } from '../../types'
import AnimeItemPicker from './AnimeItemPicker'

type Props =
  | {
      mode?: 'related'
      related: RelatedItem[]
      options: Item[]
      onAdd: (itemId: string) => void
      onRemove: (itemId: string) => void
      onChangeRelation: (itemId: string, r: RelationKind) => void
      pickerPlaceholder?: string
    }
  | {
      mode: 'recommendations'
      ids: string[]
      options: Item[]
      onAdd: (id: string) => void
      onRemove: (id: string) => void
      pickerPlaceholder?: string
    }

export default function RelatedListEditor(props: Props) {
  const lookup = (id: string) => props.options.find((o) => o.id === id)
  const ids = props.mode === 'recommendations' ? props.ids : props.related.map((r) => r.itemId)
  const placeholder = props.pickerPlaceholder ?? (props.mode === 'recommendations' ? 'Add recommendation…' : 'Add related…')
  return (
    <div>
      <AnimeItemPicker options={props.options} excludeIds={ids} onPick={props.onAdd} placeholder={placeholder} />
      {ids.length > 0 && (
        <div className="related-list">
          {ids.map((id) => {
            const it = lookup(id)
            const rel = props.mode === 'recommendations' ? null : props.related.find((r) => r.itemId === id)
            return (
              <div key={id} className="related-row">
                {it?.cover && <img src={it.cover} alt="" />}
                <span className="related-title">{it?.title ?? '(missing)'}</span>
                {rel && (
                  <select value={rel.relation} onChange={(e) => (props as Extract<Props, { mode?: 'related' }>).onChangeRelation(id, e.target.value as RelationKind)}>
                    {RELATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                <button type="button" className="track-remove" onClick={() => props.onRemove(id)}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
