// Like RelatedListEditor but without a per-row relation kind — just a plain
// list of recommended item ids.

import type { Item } from '../../types'
import AnimeItemPicker from './AnimeItemPicker'

export default function RecommendationsEditor({ ids, options, onAdd, onRemove, pickerPlaceholder }: {
  ids: string[]
  options: Item[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  pickerPlaceholder?: string
}) {
  const lookup = (id: string) => options.find((o) => o.id === id)
  return (
    <div>
      <AnimeItemPicker options={options} excludeIds={ids} onPick={onAdd} placeholder={pickerPlaceholder ?? 'Add recommendation…'} />
      {ids.length > 0 && (
        <div className="related-list">
          {ids.map((id) => {
            const it = lookup(id)
            return (
              <div key={id} className="related-row">
                {it?.cover && <img src={it.cover} alt="" />}
                <span className="related-title">{it?.title ?? '(missing)'}</span>
                <button type="button" className="track-remove" onClick={() => onRemove(id)}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
