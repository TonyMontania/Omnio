import { memo } from 'react'
import type { ErogeItem } from './types'
import { assetUrl } from './ipc'
import type { TagPrefs } from './constants'
import TagSignals from './TagSignals'

interface Props {
  game: ErogeItem
  onOpen: (id: string) => void
  onToggleFav: (id: string) => void
  cardFields?: Record<string, boolean>
  tagPrefs?: TagPrefs
}

function ErogeCardImpl({ game, onOpen, onToggleFav, cardFields, tagPrefs }: Props) {
  const cover = game.coverFile ? assetUrl('cover', game.coverFile) : undefined
  const show = (field: string) => cardFields?.[field] !== false
  const hasUpdate = !!game.updateAvailable && !game.archived
  const details = [
    show('vn') && game.vn ? 'VN' : '',
    show('engine') ? game.engine : '',
    show('version') ? game.version : '',
    show('creator') ? game.creator : '',
  ].filter(Boolean)
  return (
    <div className={`er-card${hasUpdate ? ' has-update' : ''}`} onClick={() => onOpen(game.id)}>
      <div className="gc-banner">
        {cover
          ? <img src={cover} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          : <div className="gc-nocover">No cover</div>}
        {hasUpdate && (
          <span className="gc-update" title={`New version: ${game.latestVersion ?? '?'}`}>
            {game.latestVersion ? `${game.latestVersion} new` : 'Update'}
          </span>
        )}
        <button
          type="button"
          className={`gc-fav${game.favorite ? ' on' : ''}`}
          title={game.favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={!!game.favorite}
          onClick={(e) => { e.stopPropagation(); onToggleFav(game.id) }}
        >★</button>
      </div>
      <div className="gc-info">
        {show('title') && <div className="gc-name" title={game.name}>{game.name}</div>}
        <div className="gc-line">
          {show('status') && game.status && (
            <span className={`gc-status st-${game.status.toLowerCase()}`}>{game.status}</span>
          )}
          {details.length > 0 && <span className="gc-details">{details.join(' · ')}</span>}
        </div>
        <TagSignals game={game} prefs={tagPrefs} />
      </div>
    </div>
  )
}

const ErogeCard = memo(ErogeCardImpl, (prev, next) =>
  prev.game === next.game
  && prev.onOpen === next.onOpen
  && prev.onToggleFav === next.onToggleFav
  && prev.cardFields === next.cardFields
  && prev.tagPrefs === next.tagPrefs
)
export default ErogeCard
