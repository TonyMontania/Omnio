// Review field with a spoiler-reveal gate. Every detail modal used to
// duplicate this ~15-line block, keeping the reveal state in a local
// useState. Now it lives here.

import { useState } from 'react'
import { renderMiniMarkdown } from '../../types'

export default function DetailReview({ review, hasSpoilers }: {
  review?: string
  hasSpoilers?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  if (!review) return null
  return (
    <div className="field-group">
      <label>Review{hasSpoilers ? ' (spoilers)' : ''}</label>
      {hasSpoilers && !revealed ? (
        <button type="button" className="spoiler-reveal-btn" onClick={() => setRevealed(true)}>
          ⚠ This review contains spoilers — click to reveal
        </button>
      ) : (
        <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(review) }} />
      )}
    </div>
  )
}
