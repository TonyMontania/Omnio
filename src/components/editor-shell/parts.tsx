// Building blocks for EditorShell sections. Fields sit on a two-column
// grid; `wide` spans both columns for long values.

import { useRef, useState, type ReactNode } from 'react'

export function Field({ label, wide, hint, children }: { label: string; wide?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={`es-field${wide ? ' wide' : ''}`}>
      <span className="es-label">{label}{hint && <span className="es-label-hint">{hint}</span>}</span>
      {children}
    </label>
  )
}

/** Titled block inside a tab, e.g. "Fetch metadata". Spans the full width. */
export function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="es-group">
      <div className="es-group-head">
        <h3>{title}</h3>
        {hint && <span className="es-group-hint">{hint}</span>}
      </div>
      <div className="es-grid">{children}</div>
    </section>
  )
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="es-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function Toggles({ children }: { children: ReactNode }) {
  return <div className="es-toggles">{children}</div>
}

export function TogglePill({ on, icon, label, onLabel, onChange }: { on: boolean; icon: string; label: string; onLabel?: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`es-pill${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onChange(!on)}>
      <span className="es-pill-icon" aria-hidden>{icon}</span>{on ? (onLabel ?? label) : label}
    </button>
  )
}

/** One image of an item: cover, banner, logo, backdrop… Click or drop a file on it to replace it. */
export function ImageSlot({ label, src, shape = 'wide', onFile, onRemove, extra }: {
  label: string
  src?: string
  shape?: 'wide' | 'poster' | 'square' | 'logo'
  onFile: (file: File) => void
  onRemove?: () => void
  extra?: ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div className="es-image">
      <span className="es-label">{label}</span>
      <button
        type="button"
        className={`es-image-frame ${shape}${over ? ' over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file && file.type.startsWith('image/')) onFile(file)
        }}
        title={src ? `Replace ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
      >
        {src ? <img src={src} alt="" /> : <span>Drop an image or click to choose</span>}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) onFile(file)
      }} />
      <div className="es-image-actions">
        {extra}
        {src && onRemove && <button type="button" className="es-btn small danger" onClick={onRemove}>Remove</button>}
      </div>
    </div>
  )
}

/** Paste box for links or page sources, with the importer's status line. */
export function ImportBox({ value, onChange, onImport, busy, status, placeholder, large }: {
  value: string
  onChange: (v: string) => void
  onImport: () => void
  busy: boolean
  status?: string
  placeholder: string
  large?: boolean
}) {
  return (
    <div className="es-import">
      <textarea
        rows={large ? 4 : 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={large}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && value.trim() && !value.includes('\n')) { e.preventDefault(); onImport() } }}
      />
      <div className="es-import-row">
        <span className="es-import-status">{status}</span>
        <button type="button" className="es-btn primary" onClick={onImport} disabled={busy || !value.trim()}>
          {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
    </div>
  )
}

/** Detail-page preview: banner, chips, title and a short fact list. */
export function DetailPreview({ banner, title, subtitle, chips, facts, description }: {
  banner?: string
  title: string
  subtitle?: string
  chips?: string[]
  facts?: [string, string | undefined][]
  description?: string
}) {
  const shown = (facts ?? []).filter(([, v]) => !!v)
  return (
    <div className="es-detail">
      <div className="es-detail-banner">{banner ? <img src={banner} alt="" /> : <span>No cover</span>}</div>
      <div className="es-detail-body">
        {chips && chips.length > 0 && <div className="es-detail-chips">{chips.map((c) => <span key={c}>{c}</span>)}</div>}
        <div className="es-detail-title">{title || 'Untitled'}</div>
        {subtitle && <div className="es-detail-sub">{subtitle}</div>}
        {shown.length > 0 && (
          <dl className="es-detail-facts">
            {shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
        {description && <p className="es-detail-desc">{description}</p>}
      </div>
    </div>
  )
}

/** Small centred dialog used for the import-first step, the review and confirmations. */
export function EditorDialog({ title, children, actions, onClose, width }: {
  title: string
  children: ReactNode
  actions: ReactNode
  onClose: () => void
  width?: number
}) {
  return (
    <div className="es-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="es-dialog" role="dialog" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <h2>{title}</h2>
        {children}
        <div className="es-dialog-actions">{actions}</div>
      </div>
    </div>
  )
}

/** Summary shown after an import: what came in and what is still empty. */
export function ImportReview({ cover, title, meta, fields, status }: {
  cover?: string
  title: string
  meta?: string
  fields: { label: string; filled: boolean }[]
  status?: string
}) {
  const filled = fields.filter((f) => f.filled).length
  return (
    <>
      <div className="es-review">
        <div className="es-review-cover">{cover ? <img src={cover} alt="" /> : <span>No cover</span>}</div>
        <div className="es-review-info">
          <div className="es-review-title">{title || 'Untitled'}</div>
          {meta && <div className="es-review-meta">{meta}</div>}
          <div className="es-review-count">{filled} of {fields.length} fields filled</div>
        </div>
      </div>
      <div className="es-review-fields">
        {fields.map((f) => <span key={f.label} className={f.filled ? 'ok' : ''}>{f.filled ? '✓' : '–'} {f.label}</span>)}
      </div>
      {status && <p className="es-import-status block">{status}</p>}
    </>
  )
}
