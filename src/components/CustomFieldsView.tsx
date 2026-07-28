import type { CustomField } from '../types'

// Renders an item's user-defined key/value list. Used at the bottom of
// every category's detail view so any Notion-style custom fields the user
// added in the editor show up alongside the built-in schema fields.
// Returns null when the item has none, so callers can drop it in
// unconditionally without a wrapper check.
export default function CustomFieldsView({ fields }: { fields?: CustomField[] }) {
  if (!fields || fields.length === 0) return null
  return (
    <div className="pd-section">
      <span className="pd-section-label">Custom fields</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
        {fields.map((f) => (
          <div key={f.id} style={{ display: 'flex', gap: 12, fontSize: 14, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--text-dim)', minWidth: 120, flex: '0 0 auto', fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: 2 }}>
              {f.key || '—'}
            </span>
            <span style={{ color: 'var(--text)', flex: 1, wordBreak: 'break-word' }}>
              {f.value || <span style={{ color: 'var(--text-dim)' }}>(empty)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
