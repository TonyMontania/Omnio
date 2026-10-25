// Shared item editor layout: live preview on the left, tabbed form on the
// right, pinned footer. Tab ids follow the library editor (Overview,
// Identity, Progress, Media, History, Related, Notes) plus Links, always
// in the same order; a library passes only the tabs it uses.

import { useEffect, type ReactNode } from 'react'
import { t } from '../../i18n'

export type EditorTabId =
  | 'overview' | 'identity' | 'progress' | 'media'
  | 'history' | 'related' | 'notes' | 'links'

const TAB_ORDER: EditorTabId[] = ['overview', 'identity', 'progress', 'media', 'history', 'related', 'notes', 'links']

const TAB_LABELS: Record<EditorTabId, string> = {
  overview: t('Overview'),
  identity: t('Identity'),
  progress: t('Progress'),
  media: t('Media'),
  history: t('History'),
  related: t('Related'),
  notes: t('Notes'),
  links: t('Links'),
}

export interface EditorTab {
  id: EditorTabId
  label?: string
  /** Small count next to the label, e.g. filled links. Hidden when 0. */
  count?: number
  content: ReactNode
}

interface Props {
  title: string
  preview: { card: ReactNode; detail?: ReactNode }
  previewMode: 'card' | 'detail'
  onPreviewMode: (m: 'card' | 'detail') => void
  /** Small line under the preview, e.g. when the item was added. */
  previewNote?: string
  tabs: EditorTab[]
  activeTab: EditorTabId
  onTab: (id: EditorTabId) => void
  onCancel: () => void
  onSubmit: () => void
  saveLabel?: string
  /** Left side of the footer, e.g. a Delete button. */
  footerStart?: ReactNode
}

export default function EditorShell(p: Props) {
  const ordered = TAB_ORDER
    .map((id) => p.tabs.find((t) => t.id === id))
    .filter((t): t is EditorTab => !!t)
  const current = ordered.find((t) => t.id === p.activeTab) ?? ordered[0]
  const { onCancel, onSubmit } = p

  // Escape closes; Ctrl/Cmd+S saves from any tab.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSubmit() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, onSubmit])

  return (
    <div className="es-backdrop">
      <form
        className="es-panel"
        role="dialog"
        aria-label={p.title}
        onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      >
        <header className="es-head">
          <h2>{p.title}</h2>
          <button type="button" className="es-close" onClick={onCancel} aria-label={t('Close')}>✕</button>
        </header>

        <aside className="es-side">
          <span className="es-side-label">{t('Live preview')}</span>
          {p.preview.detail && (
            <div className="es-seg" role="tablist" aria-label={t('Preview')}>
              <button type="button" role="tab" aria-selected={p.previewMode === 'card'} className={p.previewMode === 'card' ? 'on' : ''} onClick={() => p.onPreviewMode('card')}>{t('Card')}</button>
              <button type="button" role="tab" aria-selected={p.previewMode === 'detail'} className={p.previewMode === 'detail' ? 'on' : ''} onClick={() => p.onPreviewMode('detail')}>{t('Detail')}</button>
            </div>
          )}
          <div className={`es-preview ${p.previewMode}`}>
            {p.previewMode === 'detail' && p.preview.detail ? p.preview.detail : p.preview.card}
          </div>
          {p.previewNote && <div className="es-preview-note">{p.previewNote}</div>}
        </aside>

        <div className="es-tabs" role="tablist">
          {ordered.map((t) => (
            <button
              type="button"
              key={t.id}
              role="tab"
              aria-selected={t.id === current?.id}
              className={t.id === current?.id ? 'on' : ''}
              onClick={() => p.onTab(t.id)}
            >
              {t.label ?? TAB_LABELS[t.id]}
              {!!t.count && <span className="es-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="es-main" role="tabpanel">
          <div className="es-grid" key={current?.id}>{current?.content}</div>
        </div>

        <footer className="es-foot">
          <div className="es-foot-start">{p.footerStart}</div>
          <span className="es-foot-hint">{t('Ctrl+S to save')}</span>
          <button type="button" className="es-btn" onClick={onCancel}>{t('Cancel')}</button>
          <button type="submit" className="es-btn primary">{p.saveLabel ?? t('Save')}</button>
        </footer>
      </form>
    </div>
  )
}
