// Back / Export / Duplicate / Edit row shared by every detail modal.

export default function DetailTopbar({ onBack, onDuplicate, onEdit, onExport }: {
  onBack: () => void
  onDuplicate?: () => void
  onEdit?: () => void
  onExport?: () => void
}) {
  return (
    <div className="game-page-topbar">
      <button className="back-btn wide" onClick={onBack}>← Back</button>
      <div className="game-page-actions">
        {onExport && <button className="edit-btn" onClick={onExport} title="Save this item's data as a .json file">↓ Export JSON</button>}
        {onDuplicate && <button className="edit-btn" onClick={onDuplicate}>⧉ Duplicate</button>}
        {onEdit && <button className="edit-btn" onClick={onEdit}>✎ Edit</button>}
      </div>
    </div>
  )
}
