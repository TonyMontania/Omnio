// User-defined *library-level* custom fields — schema entries the
// user defines in Settings so every item in that library grows the
// same extra fields.
//
// Distinct from the existing per-item `CustomField` in entities.ts,
// which is a free-form key/value pair one item can carry on its own.
// This one is a typed schema shared across every item in a library:
// Games might get a "Kojima meta" number and a "PC ports available"
// boolean; Books might get an "edition purchased" text and a
// "shelf" select. Item values live under
// item.libraryCustomFieldValues[fieldId], keyed by the field's uuid
// so renaming a field label doesn't lose data.
//
// Field kinds are intentionally small — each maps to a native HTML
// input so the editor doesn't need custom widgets. `select` carries
// its own options; the rest use the input's default parser.

export type LibraryCustomFieldKind = 'text' | 'number' | 'date' | 'boolean' | 'select'

export interface LibraryCustomFieldDef {
  id: string
  name: string
  kind: LibraryCustomFieldKind
  // Only used when kind === 'select'. Blank when not applicable.
  options?: string[]
  // Optional short helper the editor shows under the input.
  description?: string
  // Sprint H — when true, the field value renders as a small chip on
  // the item card (in addition to the editor). Off by default so the
  // card doesn't grow noisy the moment a user adds their first field.
  showOnCard?: boolean
  createdAt: number
}

// The raw value stored on the item — any kind that fits an input.
// `unknown` at the type level so consumers can't silently assume a
// shape; the editor + read paths cast at the specific kind.
export type LibraryCustomFieldValue = string | number | boolean | null

// Normalizes a raw input value into the type that matches `def.kind`.
// Returns null when the input is empty so a cleared field doesn't
// persist an empty string. Any invalid value falls back to null too
// — bad data never crashes the read paths.
export function normalizeLibraryCustomValue(def: LibraryCustomFieldDef, raw: unknown): LibraryCustomFieldValue {
  switch (def.kind) {
    case 'text': {
      if (raw == null) return null
      const s = String(raw).trim()
      return s.length === 0 ? null : s
    }
    case 'number': {
      if (raw === '' || raw == null) return null
      const n = Number(raw)
      return isNaN(n) ? null : n
    }
    case 'date':
      if (!raw) return null
      return String(raw)
    case 'boolean':
      return !!raw
    case 'select': {
      if (raw == null || raw === '') return null
      const v = String(raw)
      if (def.options && !def.options.includes(v)) return null
      return v
    }
  }
}

export function displayLibraryCustomValue(def: LibraryCustomFieldDef, value: LibraryCustomFieldValue): string {
  if (value == null || value === '') return '—'
  switch (def.kind) {
    case 'boolean':
      return value ? 'Yes' : 'No'
    default:
      return String(value)
  }
}
