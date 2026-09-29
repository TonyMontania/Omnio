import { useEffect, useRef, useState } from 'react'
import type { CategoryId } from '../types/items'
import { CATEGORIES } from '../categories'

interface Props {
  enabledCategories: string[]
  onSubmit: (categoryId: CategoryId, title: string) => void
  onClose: () => void
}

export default function QuickAddPopover({ enabledCategories, onSubmit, onClose }: Props) {
  const cats = CATEGORIES.filter((c) => enabledCategories.includes(c.id))
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>(cats[0]?.id ?? 'videojuegos')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!cats.some((c) => c.id === categoryId) && cats[0]) setCategoryId(cats[0].id)
  }, [cats, categoryId])

  const canSubmit = title.trim().length > 0
  const submit = () => {
    if (!canSubmit) return
    onSubmit(categoryId as CategoryId, title.trim())
    setTitle('')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel quick-add-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Quick add</h2>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <p className="hint">Drop a stub into a library — you can flesh it out from the full editor later.</p>
          <div className="quick-add-row">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="quick-add-cat"
            >
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              placeholder={`Add a ${cats.find((c) => c.id === categoryId)?.singular ?? 'item'}…`}
              className="quick-add-input"
            />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" onClick={submit} disabled={!canSubmit}>+ Add</button>
        </div>
      </div>
    </div>
  )
}
