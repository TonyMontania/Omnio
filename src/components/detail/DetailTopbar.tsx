// Back / Duplicate / Edit row shared by every detail modal.

export default function DetailTopbar({ onBack, onDuplicate, onEdit }: {
  onBack: () => void
  onDuplicate?: () => void
  onEdit?: () => void
}) {
  return (
    <div className="game-page-topbar">
      <button className="back-btn wide" onClick={onBack}>← Back</button>
      <div className="game-page-actions">
        {onDuplicate && <button className="edit-btn" onClick={onDuplicate}>⧉ Duplicate</button>}
        {onEdit && <button className="edit-btn" onClick={onEdit}>✎ Edit</button>}
      </div>
    </div>
  )
}
