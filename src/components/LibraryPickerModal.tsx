// Small picker modal for "Move item to another library". Lists every
// category as a click target (minus the item's current library and
// any category the user has disabled in Settings → Libraries). Kept
// deliberately simple — no confirm step, no field-mapping wizard;
// the item's non-applicable fields stay on the record and quietly
// come back if the user moves it back.

import { CATEGORIES } from '../categories'

interface Props {
  currentCategoryId: string
  enabledCategories?: string[]
  onClose: () => void
  onPick: (categoryId: string) => void
}

export default function LibraryPickerModal({ currentCategoryId, enabledCategories, onClose, onPick }: Props) {
  const targets = CATEGORIES.filter((c) => {
    if (c.id === currentCategoryId) return false
    if (enabledCategories && !enabledCategories.includes(c.id)) return false
    return true
  })
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal library-picker" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Move to library</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="library-picker-hint">
          Pick a destination. The item's fields specific to its old library stay on the record — nothing is dropped.
        </div>
        <ul className="library-picker-list">
          {targets.length === 0 && <li className="empty">No other enabled libraries.</li>}
          {targets.map((c) => (
            <li key={c.id} onClick={() => { onPick(c.id); onClose() }}>
              <span className="library-picker-name">{c.label}</span>
              <span className="library-picker-arrow">→</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
