// Sprint E finish — Movies. Structured viewing log editor. Every
// row is one time the user watched this movie. Kept small and
// tabular — a movie the user has watched five times reads as five
// tidy rows, not five collapsible cards.

import type { MovieViewing, MovieFormat } from '../../types/entities'
import { plural, t } from '../../i18n'

interface Props {
  viewings: MovieViewing[]
  onChange: (next: MovieViewing[]) => void
}

const FORMAT_OPTIONS: { value: MovieFormat; label: string }[] = [
  { value: 'theater',   label: t('Theater / cinema') },
  { value: 'streaming', label: t('Streaming') },
  { value: 'bluray',    label: t('Blu-ray') },
  { value: 'dvd',       label: t('DVD') },
  { value: 'download',  label: t('Download') },
  { value: 'other',     label: t('Other') },
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
        <label>{t('Viewings')}</label>
        {viewings.length > 0 && (
          <span className="movie-viewings-count">
            {plural(viewings.length, '{n} viewing', '{n} viewings')}
          </span>
        )}
        <button type="button" className="secondary-btn" onClick={add}>{t('+ Add viewing')}</button>
      </div>
      <p className="hint">{t('Log each watch — first time in a theater, a re-view at home, a rewatch on a plane. Nothing here is required.')}</p>

      {viewings.length === 0 ? (
        <p className="hint" style={{ opacity: 0.6 }}>{t('No viewings logged yet.')}</p>
      ) : (
        <ul className="movie-viewings-list">
          {viewings.map((v) => (
            <li key={v.id} className="movie-viewing">
              <input type="date" value={v.date ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, date: e.target.value || undefined }))} />
              <select value={v.format ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, format: (e.target.value || undefined) as MovieFormat | undefined }))}>
                <option value="">{t('— format')}</option>
                {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input placeholder={t('Location')} value={v.location ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, location: e.target.value || undefined }))} />
              <input placeholder={t('With whom')} value={v.companions ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, companions: e.target.value || undefined }))} />
              <input placeholder={t('Note')} value={v.note ?? ''} onChange={(e) => patch(v.id, (x) => ({ ...x, note: e.target.value || undefined }))} />
              <button type="button" className="movie-viewing-remove" onClick={() => remove(v.id)} title={t('Remove viewing')} aria-label={t('Remove viewing')}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
