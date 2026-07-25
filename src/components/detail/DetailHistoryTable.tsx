// Rewatch / reread / listen / replay history table shared by every detail
// modal. Data shape is identical across categories — { id, date, rating?, notes? }.

export interface HistoryEntry {
  id: string
  date?: string
  rating?: number
  notes?: string
}

export default function DetailHistoryTable({ label, entries }: {
  label: string
  entries: HistoryEntry[]
}) {
  if (entries.length === 0) return null
  return (
    <div className="field-group">
      <label>{label}</label>
      <table className="track-table">
        <thead>
          <tr>
            <th className="col-num">Date</th>
            <th className="col-rating">Rating</th>
            <th className="col-title">Notes</th>
            <th className="col-spacer"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((r) => (
            <tr key={r.id}>
              <td className="col-num">{r.date}</td>
              <td className="col-rating">{r.rating ? `★ ${r.rating}` : ''}</td>
              <td className="col-title">{r.notes ?? ''}</td>
              <td className="col-spacer"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
