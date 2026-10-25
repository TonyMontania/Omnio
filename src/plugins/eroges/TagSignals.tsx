import type { ErogeItem } from './types'
import { matchTags, type TagPrefs } from './constants'
import { t } from '../../i18n'

export default function TagSignals({ game, prefs }: { game: ErogeItem; prefs?: TagPrefs }) {
  const { liked, avoided } = prefs ? matchTags(game.tags, prefs) : { liked: [], avoided: [] }
  if (!game.archived && liked.length === 0 && avoided.length === 0) return null
  return (
    <span className="er-signals">
      {liked.length > 0 && <span className="er-signal liked" title={t('Tags you like: {liked}', { liked: liked.join(', ') })}>♥ {liked.length}</span>}
      {avoided.length > 0 && <span className="er-signal avoided" title={t('Tags to avoid: {avoided}', { avoided: avoided.join(', ') })}>⚠ {avoided.length}</span>}
      {game.archived && <span className="er-signal archived" title={t('Archived — update checks skip it')}>{t('Archived')}</span>}
    </span>
  )
}
