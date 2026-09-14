// Item-editor section — renders the user-defined library custom
// fields for the current category. Drops into every add / edit
// panel; when the library has no custom fields, the section shows
// nothing at all (not even a title) so it stays invisible unless
// the user has opted in.

import type { LibraryCustomFieldDef, LibraryCustomFieldValue } from '../types/customFields'
import { normalizeLibraryCustomValue } from '../types/customFields'

interface Props {
  defs: LibraryCustomFieldDef[]
  values: Record<string, LibraryCustomFieldValue>
  onChange: (next: Record<string, LibraryCustomFieldValue>) => void
}

export default function LibraryCustomFieldsSection({ defs, values, onChange }: Props) {
  if (defs.length === 0) return null
  const setValue = (id: string, raw: unknown) => {
    const def = defs.find((d) => d.id === id)
    if (!def) return
    onChange({ ...values, [id]: normalizeLibraryCustomValue(def, raw) })
  }
  return (
    <div className="editor-section library-custom-fields-section">
      <h4>Custom fields</h4>
      {defs.map((def) => {
        const v = values[def.id]
        return (
          <div key={def.id} className="field-group">
            <label>{def.name}</label>
            <FieldInput def={def} value={v} onChange={(next) => setValue(def.id, next)} />
            {def.description && <p className="hint">{def.description}</p>}
          </div>
        )
      })}
    </div>
  )
}

interface InputProps {
  def: LibraryCustomFieldDef
  value: LibraryCustomFieldValue | undefined
  onChange: (raw: unknown) => void
}

function FieldInput({ def, value, onChange }: InputProps) {
  switch (def.kind) {
    case 'text':
      return <input type="text" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <input type="number" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
    case 'date':
      return <input type="date" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
    case 'boolean':
      return (
        <div className="yesno">
          <button type="button" className={value === true ? 'pill active' : 'pill'} onClick={() => onChange(true)}>Yes</button>
          <button type="button" className={value === false ? 'pill active' : 'pill'} onClick={() => onChange(false)}>No</button>
          <button type="button" className={value == null ? 'pill active' : 'pill'} onClick={() => onChange(null)}>—</button>
        </div>
      )
    case 'select':
      return (
        <select value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(def.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
  }
}
