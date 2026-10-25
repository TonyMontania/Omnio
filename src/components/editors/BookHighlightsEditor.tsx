// Sprint E finish — Books. Highlights / quotes list. One entry per
// passage the user wants to remember. Text is a textarea (quotes
// tend to be paragraph-length); the rest is compact.

import type { BookHighlight } from '../../types/entities'
import { plural, t } from '../../i18n'

interface Props {
  highlights: BookHighlight[]
  onChange: (next: BookHighlight[]) => void
}

export default function BookHighlightsEditor({ highlights, onChange }: Props) {
  const add = () => {
    onChange([...highlights, {
      id: crypto.randomUUID(),
      text: '',
      capturedAt: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
    }])
  }
  const patch = (id: string, fn: (h: BookHighlight) => BookHighlight) => {
    onChange(highlights.map((h) => (h.id === id ? fn(h) : h)))
  }
  const remove = (id: string) => onChange(highlights.filter((h) => h.id !== id))

  return (
    <div className="field-group book-highlights">
      <div className="book-highlights-head">
        <label>{t('Highlights & quotes')}</label>
        {highlights.length > 0 && (
          <span className="book-highlights-count">
            {plural(highlights.length, '{n} highlight', '{n} highlights')}
          </span>
        )}
        <button type="button" className="secondary-btn" onClick={add}>{t('+ Add highlight')}</button>
      </div>
      <p className="hint">{t('Save passages worth remembering — a Kindle-style highlights list you can revisit without opening the book.')}</p>

      {highlights.length === 0 ? (
        <p className="hint" style={{ opacity: 0.6 }}>{t('No highlights yet.')}</p>
      ) : (
        <ul className="book-highlights-list">
          {highlights.map((h) => (
            <li key={h.id} className="book-highlight">
              <div className="book-highlight-row">
                <input placeholder={t('Page')} value={h.page ?? ''} onChange={(e) => patch(h.id, (x) => ({ ...x, page: e.target.value || undefined }))} />
                <input type="date" value={h.capturedAt ?? ''} onChange={(e) => patch(h.id, (x) => ({ ...x, capturedAt: e.target.value || undefined }))} />
                <button type="button" className="book-highlight-remove" onClick={() => remove(h.id)} title={t('Remove highlight')} aria-label={t('Remove highlight')}>✕</button>
              </div>
              <textarea
                className="book-highlight-text"
                placeholder={t('The passage itself…')}
                rows={3}
                value={h.text}
                onChange={(e) => patch(h.id, (x) => ({ ...x, text: e.target.value }))}
              />
              <input
                className="book-highlight-note"
                placeholder={t('Optional note — why did this stand out?')}
                value={h.note ?? ''}
                onChange={(e) => patch(h.id, (x) => ({ ...x, note: e.target.value || undefined }))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
