// List-view row for the Eroges plugin. Compact horizontal layout that
// mirrors Nyx's `game-row.game-card` style: tag pills + title +
// version + creator + update badge, plus favorite toggle. Rendered
// instead of `<ErogeCard />` when the user picks "☰ List" in the
// topnav view-toggle.

import { memo } from 'react'
import type { ErogeItem } from './types'
import { engineClass } from './constants'

interface Props {
  game: ErogeItem
  onOpen: (id: string) => void
  onToggleFav: (id: string) => void
  cardFields?: Record<string, boolean>
}

function ErogeRowImpl({ game, onOpen, onToggleFav, cardFields }: Props) {
  const showTitle = cardFields?.title !== false
  const showVn = cardFields?.vn !== false
  const showEngine = cardFields?.engine !== false
  const showStatus = cardFields?.status !== false
  const showVersion = cardFields?.version !== false
  const showCreator = cardFields?.creator !== false
  return (
    <div className="er-row" onClick={() => onOpen(game.id)}>
      <button
        type="button"
        className={`er-row-fav ${game.favorite ? 'on' : ''}`}
        title="Favorite"
        onClick={(e) => { e.stopPropagation(); onToggleFav(game.id) }}
      >★</button>
      <div className="er-row-tags">
        {showVn && game.vn && <span className="er-tag eng-vn">VN</span>}
        {showEngine && game.engine && <span className={`er-tag eng-${engineClass(game.engine)}`}>{game.engine}</span>}
        {showStatus && game.status && <span className={`er-tag st-${game.status.toLowerCase()}`}>{game.status}</span>}
        {game.backlogStatus && <span className={`er-tag bl-${game.backlogStatus}`}>{game.backlogStatus}</span>}
      </div>
      <div className="er-row-title">
        {showTitle && <span className="er-row-name">{game.name}</span>}
        {showVersion && game.version && <span className="er-row-version">[{game.version}]</span>}
        {showCreator && game.creator && <span className="er-row-creator">[{game.creator}]</span>}
      </div>
      {game.updateAvailable && <span className="er-row-update">UPDATE</span>}
    </div>
  )
}

const ErogeRow = memo(ErogeRowImpl, (prev, next) =>
  prev.game === next.game
  && prev.onOpen === next.onOpen
  && prev.onToggleFav === next.onToggleFav
  && prev.cardFields === next.cardFields
)
export default ErogeRow
