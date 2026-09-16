// Sprint E finish — Movies. Structured viewing log editor. Every
// row is one time the user watched this movie. Kept small and
// tabular — a movie the user has watched five times reads as five
// tidy rows, not five collapsible cards.

import type { MovieViewing, MovieFormat } from '../../types/entities'

interface Props {
  viewings: MovieViewing[]
  onChange: (next: MovieViewing[]) => void
}

const FORMAT_OPTIONS: { value: MovieFormat; label: string }[] = [
  { value: 'theater',   label: 'Theater / cinema' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'bluray',    label: 'Blu-ray' },
  { value: 'dvd',       label: 'DVD' },
  { value: 'download',  label: 'Download' },
  { value: 'other',     label: 'Other' },
]

export default function MovieViewingsEditor({ viewings, onChange }: Props) {
  const add = () => {
    onChange([...viewings, { id: crypto.randomUUID(), createdAt: Date.now() }])
  }
  const patch = (id: string, fn: (v: MovieViewing) => MovieViewing) => {
    onChange(viewings.map((v) => (v.id === id ? fn(v) : v)))
  }
  const remove = (id: string) => onChange(viewings.filter((v) => v.id !== id))

  return (
    <div className="field-group movie-viewings">
      <div className="movie-viewings-head">
        <label>Viewings</label>
        {viewings.length > 0 && (
          <span className="movie-viewings-count">
            {viewings.length} viewing{viewings.length === 1 ? '' : 's'}
          </span>
        )}
        <button type="button" className="secondary-btn" onClick={add}>+ Add viewing</button>
      </div>
      <p className="hint">Log each watch — first time in a theater, a re-view at home, a rewatch on a plane. Nothing here is required.</p>

      {viewings.length === 0 ? (
        <p className="hint" style={{ opacity: 0.6 }}>No viewings logged yet.</p>
      ) : (
        <ul className="movie-viewings-list">
          {viewings.map((v) => (
            <li key={v.id} className="movie-viewing">
              <input type="date" value={v.date ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, date: e.target.value || undefined }))} />
              <select value={v.format ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, format: (e.target.value || undefined) as MovieFormat | undefined }))}>
                <option value="">— format</option>
                {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input placeholder="Location" value={v.location ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, location: e.target.value || undefined }))} />
              <input placeholder="With whom" value={v.companions ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, companions: e.target.value || undefined }))} />
              <input placeholder="Note" value={v.note ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, note: e.target.value || undefined }))} />
              <button type="button" className="movie-viewing-remove" onClick={() => remove(v.id)} title="Remove viewing" aria-label="Remove viewing">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
