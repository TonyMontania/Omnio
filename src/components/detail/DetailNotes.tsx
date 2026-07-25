// Plain notes block rendered with the mini-markdown pipeline. Same
// 5-line component in every detail modal — extracted so tweaks land once.

import { renderMiniMarkdown } from '../../types'

export default function DetailNotes({ notes, label = 'Notes' }: { notes?: string; label?: string }) {
  if (!notes) return null
  return (
    <div className="field-group">
      <label>{label}</label>
      <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(notes) }} />
    </div>
  )
}
