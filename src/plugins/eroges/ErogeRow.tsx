// List-view row: the same information as a grid card, laid out on one
// line with a small cover thumbnail.

import { memo } from 'react'
import type { ErogeItem } from './types'
import { assetUrl } from './ipc'
import { BACKLOG_LABELS, type TagPrefs } from './constants'
import TagSignals from './TagSignals'

interface Props {
  game: ErogeItem
  onOpen: (id: string) => void
  onToggleFav: (id: string) => void
  cardFields?: Record<string, boolean>
  tagPrefs?: TagPrefs
}

function ErogeRowImpl({ game, onOpen, onToggleFav, cardFields, tagPrefs }: Props) {
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
    <div className={`er-row${hasUpdate ? ' has-update' : ''}`} onClick={() => onOpen(game.id)}>
      <div className="er-row-thumb">
        {cover && <img src={cover} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
      </div>
      <div className="er-row-main">
        {show('title') && <div className="er-row-name" title={game.name}>{game.name}</div>}
        <div className="gc-line">
          {show('status') && game.status && (
            <span className={`gc-status st-${game.status.toLowerCase()}`}>{game.status}</span>
          )}
          {details.length > 0 && <span className="gc-details">{details.join(' · ')}</span>}
        </div>
      </div>
      <div className="er-row-side">
        <TagSignals game={game} prefs={tagPrefs} />
        {hasUpdate && <span className="gc-update inline">{game.latestVersion ? `${game.latestVersion} new` : 'Update'}</span>}
        {game.backlogStatus && <span className="er-row-progress">{BACKLOG_LABELS[game.backlogStatus] ?? game.backlogStatus}</span>}
        <button
          type="button"
          className={`er-row-fav${game.favorite ? ' on' : ''}`}
          title={game.favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={!!game.favorite}
          onClick={(e) => { e.stopPropagation(); onToggleFav(game.id) }}
        >★</button>
      </div>
    </div>
  )
}

const ErogeRow = memo(ErogeRowImpl, (prev, next) =>
  prev.game === next.game
  && prev.onOpen === next.onOpen
  && prev.onToggleFav === next.onToggleFav
  && prev.cardFields === next.cardFields
  && prev.tagPrefs === next.tagPrefs
)
export default ErogeRow
