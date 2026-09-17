// Settings pane — define user-added fields per library.
//
// Sits under Settings → Custom fields. Left column: a library
// selector. Right column: the list of fields for that library, plus
// an "add field" form. Each field has a name, a kind, an optional
// description, and (for select fields) a list of options.
//
// The editor never touches item data — schema changes only. When a
// user renames a field, existing values keep flowing because they're
// keyed by field id, not by display name. Deleting a field leaves
// stale values on items untouched too; if the field is re-added
// later, the old values quietly reappear.

import { useState } from 'react'
import type { LibraryCustomFieldDef, LibraryCustomFieldKind } from '../types/customFields'
import { CATEGORIES } from '../categories'

interface Props {
  fields: Record<string, LibraryCustomFieldDef[]>
  onChange: (next: Record<string, LibraryCustomFieldDef[]>) => void
}

const KIND_LABELS: Record<LibraryCustomFieldKind, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / No',
  select: 'Select from list',
}
const KIND_ORDER: LibraryCustomFieldKind[] = ['text', 'number', 'date', 'boolean', 'select']

export default function LibraryCustomFieldsEditor({ fields, onChange }: Props) {
  const [categoryId, setCategoryId] = useState<string>(CATEGORIES[0].id)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<LibraryCustomFieldKind>('text')

  const list = fields[categoryId] ?? []

  const setList = (next: LibraryCustomFieldDef[]) => {
    const map = { ...fields }
    if (next.length === 0) delete map[categoryId]
    else map[categoryId] = next
    onChange(map)
  }

  const addField = () => {
    const name = newName.trim()
    if (!name) return
    const def: LibraryCustomFieldDef = {
      id: crypto.randomUUID(),
      name,
      kind: newKind,
      options: newKind === 'select' ? [] : undefined,
      createdAt: Date.now(),
    }
    setList([...list, def])
    setNewName('')
  }

  const patch = (id: string, fn: (d: LibraryCustomFieldDef) => LibraryCustomFieldDef) => {
    setList(list.map((d) => (d.id === id ? fn(d) : d)))
  }
  const remove = (id: string) => setList(list.filter((d) => d.id !== id))

  return (
    <div className="library-custom-fields">
      <div className="field-group">
        <label>Library</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} {(fields[c.id]?.length ?? 0) > 0 ? ` · ${fields[c.id]!.length} field${fields[c.id]!.length === 1 ? '' : 's'}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="library-custom-fields-add">
        <input
          placeholder="New field name (e.g. Kojima meta, PC ports available)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addField() }}
        />
        <select value={newKind} onChange={(e) => setNewKind(e.target.value as LibraryCustomFieldKind)}>
          {KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
        <button type="button" className="primary-btn" onClick={addField} disabled={!newName.trim()}>+ Add field</button>
      </div>

      {list.length === 0 ? (
        <p className="hint">No custom fields for this library yet. Add one above — it'll appear in every item editor for this library.</p>
      ) : (
        <ul className="library-custom-fields-list">
          {list.map((def) => (
            <li key={def.id} className="library-custom-field">
              <div className="library-custom-field-row">
                <input
                  className="library-custom-field-name"
                  value={def.name}
                  onChange={(e) => patch(def.id, (d) => ({ ...d, name: e.target.value }))}
                />
                <select
                  value={def.kind}
                  onChange={(e) => patch(def.id, (d) => ({ ...d, kind: e.target.value as LibraryCustomFieldKind }))}
                >
                  {KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
                <button type="button" className="pill" onClick={() => remove(def.id)}>Remove</button>
              </div>
              <input
                className="library-custom-field-desc"
                placeholder="Optional description (shown under the input in the editor)"
                value={def.description ?? ''}
                onChange={(e) => patch(def.id, (d) => ({ ...d, description: e.target.value || undefined }))}
              />
              <label className="library-custom-field-show-on-card">
                <input
                  type="checkbox"
                  checked={!!def.showOnCard}
                  onChange={(e) => patch(def.id, (d) => ({ ...d, showOnCard: e.target.checked || undefined }))}
                />
                <span>Show as a chip on the item card</span>
              </label>
              {def.kind === 'select' && (
                <div className="library-custom-field-options">
                  <label>Options (one per line)</label>
                  <textarea
                    value={(def.options ?? []).join('\n')}
                    onChange={(e) => patch(def.id, (d) => ({ ...d, options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) }))}
                    rows={Math.max(3, (def.options?.length ?? 0) + 1)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
