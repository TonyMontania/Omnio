import type { ErogeItem } from './types'
import { matchTags, type TagPrefs } from './constants'

export default function TagSignals({ game, prefs }: { game: ErogeItem; prefs?: TagPrefs }) {
  const { liked, avoided } = prefs ? matchTags(game.tags, prefs) : { liked: [], avoided: [] }
  if (!game.archived && liked.length === 0 && avoided.length === 0) return null
  return (
    <span className="er-signals">
      {liked.length > 0 && <span className="er-signal liked" title={`Tags you like: ${liked.join(', ')}`}>♥ {liked.length}</span>}
      {avoided.length > 0 && <span className="er-signal avoided" title={`Tags to avoid: ${avoided.join(', ')}`}>⚠ {avoided.length}</span>}
      {game.archived && <span className="er-signal archived" title="Archived — update checks skip it">Archived</span>}
    </span>
  )
}
