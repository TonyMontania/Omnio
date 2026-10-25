// Review field with a spoiler-reveal gate. Every detail modal used to
// duplicate this ~15-line block, keeping the reveal state in a local
// useState. Now it lives here.

import { useState } from 'react'
import { renderMiniMarkdown } from '../../types'
import { t } from '../../i18n'

export default function DetailReview({ review, hasSpoilers }: {
  review?: string
  hasSpoilers?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  if (!review) return null
  return (
    <div className="field-group">
      <label>{t('Review{value}', { value: hasSpoilers ? t(' (spoilers)') : '' })}</label>
      {hasSpoilers && !revealed ? (
        <button type="button" className="spoiler-reveal-btn" onClick={() => setRevealed(true)}>
          {t('⚠ This review contains spoilers — click to reveal')}
        </button>
      ) : (
        <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(review) }} />
      )}
    </div>
  )
}
