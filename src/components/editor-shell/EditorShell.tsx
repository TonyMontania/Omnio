// Shared item editor layout: live preview and section index on the left,
// one scrolling form on the right. Every library maps its fields onto the
// same section ids so the editor reads the same everywhere; a library
// simply leaves out the sections it has nothing for.

import { useEffect, useRef, useState, type ReactNode } from 'react'

export type EditorSectionId =
  | 'import' | 'basics' | 'progress' | 'details' | 'media'
  | 'history' | 'related' | 'notes' | 'links'

const SECTION_ORDER: EditorSectionId[] = ['import', 'basics', 'progress', 'details', 'media', 'history', 'related', 'notes', 'links']

const SECTION_LABELS: Record<EditorSectionId, string> = {
  import: 'Import',
  basics: 'Basics',
  progress: 'Your progress',
  details: 'Details',
  media: 'Media',
  history: 'History',
  related: 'Related',
  notes: 'Notes & tags',
  links: 'Links',
}

export interface EditorSection {
  id: EditorSectionId
  /** Overrides the shared label, e.g. "Release" or "Publication". */
  label?: string
  hint?: string
  content: ReactNode
}

interface Props {
  title: string
  preview: { card: ReactNode; detail?: ReactNode }
  /** Small line under the preview, e.g. when the item was added. */
  previewNote?: string
  sections: EditorSection[]
  onCancel: () => void
  onSubmit: () => void
  saveLabel?: string
  /** Left side of the footer, e.g. a Delete button. */
  footerStart?: ReactNode
}

export default function EditorShell({ title, preview, previewNote, sections, onCancel, onSubmit, saveLabel = 'Save', footerStart }: Props) {
  const ordered = SECTION_ORDER
    .map((id) => sections.find((s) => s.id === id))
    .filter((s): s is EditorSection => !!s)
  const [mode, setMode] = useState<'card' | 'detail'>('card')
  const [active, setActive] = useState<EditorSectionId>(ordered[0]?.id ?? 'basics')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Highlight the section nearest the top of the form as it scrolls.
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const onScroll = () => {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-es-section]'))
      const top = root.getBoundingClientRect().top + 24
      let current = nodes[0]?.dataset.esSection
      for (const n of nodes) if (n.getBoundingClientRect().top <= top) current = n.dataset.esSection
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = nodes[nodes.length - 1]?.dataset.esSection
      if (current) setActive(current as EditorSectionId)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  const jump = (id: EditorSectionId) => {
    const root = scrollRef.current
    const el = root?.querySelector<HTMLElement>(`[data-es-section="${id}"]`)
    if (!root || !el) return
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 12
    root.scrollTo({ top, behavior: 'smooth' })
    setActive(id)
  }

  return (
    <div className="es-backdrop">
      <form
        className="es-panel"
        role="dialog"
        aria-label={title}
        onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      >
        <header className="es-head">
          <h2>{title}</h2>
          <button type="button" className="es-close" onClick={onCancel} aria-label="Close">✕</button>
        </header>

        <aside className="es-side">
          {preview.detail && (
            <div className="es-seg" role="tablist" aria-label="Preview">
              <button type="button" role="tab" aria-selected={mode === 'card'} className={mode === 'card' ? 'on' : ''} onClick={() => setMode('card')}>Card</button>
              <button type="button" role="tab" aria-selected={mode === 'detail'} className={mode === 'detail' ? 'on' : ''} onClick={() => setMode('detail')}>Detail</button>
            </div>
          )}
          <div className={`es-preview ${mode}`}>{mode === 'detail' && preview.detail ? preview.detail : preview.card}</div>
          {previewNote && <div className="es-preview-note">{previewNote}</div>}
          {ordered.length > 2 && (
            <nav className="es-nav" aria-label="Sections">
              {ordered.map((s) => (
                <button type="button" key={s.id} className={active === s.id ? 'on' : ''} onClick={() => jump(s.id)}>
                  {s.label ?? SECTION_LABELS[s.id]}
                </button>
              ))}
            </nav>
          )}
        </aside>

        <div className="es-main" ref={scrollRef}>
          {ordered.map((s) => (
            <section key={s.id} className={`es-section es-section-${s.id}`} data-es-section={s.id}>
              <div className="es-section-head">
                <h3>{s.label ?? SECTION_LABELS[s.id]}</h3>
                {s.hint && <span className="es-section-hint">{s.hint}</span>}
              </div>
              <div className="es-grid">{s.content}</div>
            </section>
          ))}
        </div>

        <footer className="es-foot">
          <div className="es-foot-start">{footerStart}</div>
          <button type="button" className="es-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="es-btn primary">{saveLabel}</button>
        </footer>
      </form>
    </div>
  )
}
