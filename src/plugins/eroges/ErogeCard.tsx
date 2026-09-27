import { memo } from 'react'
import type { ErogeItem } from './types'
import { assetUrl } from './ipc'
import { engineClass } from './constants'

interface Props {
  game: ErogeItem
  onOpen: (id: string) => void
  onToggleFav: (id: string) => void
  cardFields?: Record<string, boolean>
}

function ErogeCardImpl({ game, onOpen, onToggleFav, cardFields }: Props) {
  const cover = game.coverFile ? assetUrl('cover', game.coverFile) : undefined
  const showTitle = cardFields?.title !== false
  const showVn = cardFields?.vn !== false
  const showEngine = cardFields?.engine !== false
  const showStatus = cardFields?.status !== false
  const showVersion = cardFields?.version !== false
  const showCreator = cardFields?.creator !== false
  return (
    <div className="er-card" onClick={() => onOpen(game.id)}>
      <div className="gc-banner">
        {cover
          ? <img src={cover} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          : <div className="gc-nocover">No cover</div>}
        <div className="gc-tags">
          {showVn && game.vn ? <span className="er-tag eng-vn">VN</span> : null}
          {showEngine && game.engine ? <span className={`er-tag eng-${engineClass(game.engine)}`}>{game.engine}</span> : null}
          {showStatus && game.status ? <span className={`er-tag st-${game.status.toLowerCase()}`}>{game.status}</span> : null}
        </div>
        <button
          type="button"
          className={`gc-fav ${game.favorite ? 'on' : ''}`}
          title="Favorite"
          onClick={(e) => { e.stopPropagation(); onToggleFav(game.id) }}
        >★</button>
        {game.updateAvailable && (
          <div className="gc-update-badge" title={`New version: ${game.latestVersion ?? '?'}`}>UPDATE</div>
        )}
      </div>
      <div className="gc-info">
        {showTitle && <div className="gc-name">{game.name}</div>}
        <div className="gc-meta">
          {showVersion && game.version ? <span className="gc-version">[{game.version}]</span> : null}
          {showCreator && game.creator ? <span className="gc-creator">[{game.creator}]</span> : null}
        </div>
      </div>
    </div>
  )
}

// Cards re-render only when their game or callbacks change — with 100+
// items in the grid, unchanged rows would otherwise all re-render on
// every parent state update (search input, sort change, favorite
// toggle on another card).
const ErogeCard = memo(ErogeCardImpl, (prev, next) =>
  prev.game === next.game
  && prev.onOpen === next.onOpen
  && prev.onToggleFav === next.onToggleFav
  && prev.cardFields === next.cardFields
)
export default ErogeCard
