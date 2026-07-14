import { useState } from 'react'
import { getAnimeStatus, getAiringStatusLabel, getAnimeFormatLabel, getAnimeSeasonLabel, getDemographicLabel, getAnimeSourceLabel, getAgeRatingLabel, getTotalRuntimeMinutes, formatDurationMinutes, getNextUnwatchedEpisode, getRelationLabel, renderMiniMarkdown, assetSrc } from './types'
import { AnimeStatusIcon } from './icons'
import type { Item, Collection } from './types'

interface Props {
  item: Item
  groups: Collection[]
  allAnime: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
}

function timelineSortKey(i: Item): string {
  return i.airedFrom || i.seasonYear || i.releaseYear || ''
}

export default function AnimeDetailModal({ item, groups, allAnime, onClose, onEdit, onDuplicate, onNavigate }: Props) {
  const [revealSpoilers, setRevealSpoilers] = useState(false)
  const ws = getAnimeStatus(item.watchStatus)
  const totalRuntime = getTotalRuntimeMinutes(item.episodeDuration, item.totalEpisodes, item.episodesWatched)
  const airedRange = item.airedFrom || item.airedTo
    ? [item.airedFrom, item.airedTo].filter(Boolean).join(' → ')
    : null
  const nextEp = item.hasEpisodes ? getNextUnwatchedEpisode(item.episodes) : null
  const franchiseItems = item.franchise
    ? allAnime.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedResolved = (item.relatedItems ?? []).map((r) => ({ rel: r, ref: allAnime.find((a) => a.id === r.itemId) })).filter((x) => x.ref)
  const recommendedResolved = (item.recommendedItems ?? []).map((id) => allAnime.find((a) => a.id === id)).filter((x): x is Item => !!x)

  return (
    <div className="game-page">
      <div className="game-page-topbar">
        <button className="back-btn wide" onClick={onClose}>← Back</button>
        <div className="game-page-actions">
          <button className="edit-btn" onClick={onDuplicate}>⧉ Duplicate</button>
          <button className="edit-btn" onClick={onEdit}>✎ Edit</button>
        </div>
      </div>

      <div className="game-modal-body">
        <div className="game-modal-main">
          <div className="game-modal-cover">
            {item.cover ? <img src={assetSrc(item.cover)} alt="" /> : <div className="cover-preview-placeholder">No cover</div>}
          </div>
          <div className="game-modal-info">
            <div className="game-modal-title-row">
              <h1>{item.title}</h1>
            </div>
            {item.alternativeTitles && item.alternativeTitles.length > 0 && (
              <p className="game-modal-alt-titles">{item.alternativeTitles.join(' · ')}</p>
            )}
            {item.studios && item.studios.length > 0 && (
              <p className="game-modal-devs">{item.studios.join(', ')}</p>
            )}
            {item.animeDescription && <div className="game-modal-description">{item.animeDescription}</div>}
            <div className="dlc-addons-row">
              <div className="field-group">
                <label>Status</label>
                <div className="pills">
                  <span className="pill static"><AnimeStatusIcon value={ws.value} /> {ws.label}</span>
                  {item.airingStatus && <span className="pill static">{getAiringStatusLabel(item.airingStatus)}</span>}
                  {item.animeFormat && <span className="pill static">{getAnimeFormatLabel(item.animeFormat)}</span>}
                  {item.season && <span className="pill static">{getAnimeSeasonLabel(item.season)} {item.seasonYear}</span>}
                  {item.demographic && <span className="pill static">{getDemographicLabel(item.demographic)}</span>}
                  {item.ageRating && <span className="pill static">{getAgeRatingLabel(item.ageRating)}</span>}
                  {item.animeSource && <span className="pill static">Source: {getAnimeSourceLabel(item.animeSource)}</span>}
                </div>
              </div>
              {groups.length > 0 && (
                <div className="field-group">
                  <label>Groups</label>
                  <div className="pills">
                    {groups.map((g) => <span key={g.id} className="badge group-badge">{g.name}</span>)}
                  </div>
                </div>
              )}
            </div>
            {item.genres && item.genres.length > 0 && (
              <div className="field-group">
                <label>Genres</label>
                <div className="pills">{item.genres.map((g) => <span key={g} className="pill static">{g}</span>)}</div>
              </div>
            )}
            {item.tags && item.tags.length > 0 && (
              <div className="field-group modal-tags">
                <label>Tags</label>
                <div className="card-tags">{item.tags.map((t) => <span key={t} className="card-tag">{t}</span>)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="game-modal-extra">
          <div className="dlc-addons-row wrap-4">
            {item.episodesWatched && (
              <div className="field-group">
                <label>Episodes</label>
                <div className="pills"><span className="pill static">{item.episodesWatched}{item.totalEpisodes ? ` / ${item.totalEpisodes}` : ''}</span></div>
              </div>
            )}
            {item.episodeDuration && (
              <div className="field-group">
                <label>Ep. duration</label>
                <div className="pills"><span className="pill static">{item.episodeDuration} min</span></div>
              </div>
            )}
            {totalRuntime !== null && (
              <div className="field-group">
                <label>Total runtime</label>
                <div className="pills"><span className="pill static">{formatDurationMinutes(String(totalRuntime))}</span></div>
              </div>
            )}
            {item.rating ? (
              <div className="field-group">
                <label>Rating</label>
                <div className="pills"><span className="pill static">★ {item.rating}</span></div>
              </div>
            ) : null}
            {airedRange && (
              <div className="field-group">
                <label>Aired</label>
                <div className="pills"><span className="pill static">{airedRange}</span></div>
              </div>
            )}
            {item.startDate && (
              <div className="field-group">
                <label>Started</label>
                <div className="pills"><span className="pill static">{item.startDate}</span></div>
              </div>
            )}
            {item.finishedAt && (
              <div className="field-group">
                <label>Finished</label>
                <div className="pills"><span className="pill static">{item.finishedAt}</span></div>
              </div>
            )}
            {item.favoriteEpisode && (
              <div className="field-group">
                <label>Favorite ep.</label>
                <div className="pills"><span className="pill static">#{item.favoriteEpisode}{item.favoriteEpisodeNote ? ` — ${item.favoriteEpisodeNote}` : ''}</span></div>
              </div>
            )}
            {item.watchStatus === 'dropped' && (item.droppedAtEpisode || item.droppedReason) && (
              <div className="field-group">
                <label>Dropped at</label>
                <div className="pills"><span className="pill static">{item.droppedAtEpisode ? `Ep. ${item.droppedAtEpisode}` : ''}{item.droppedAtEpisode && item.droppedReason ? ' — ' : ''}{item.droppedReason ?? ''}</span></div>
              </div>
            )}
            {nextEp && (
              <div className="field-group">
                <label>Next episode</label>
                <div className="pills"><span className="pill static">Ep. {nextEp.number}{nextEp.title ? ` — ${nextEp.title}` : ''}</span></div>
              </div>
            )}
          </div>

          {item.animeReview && (
            <div className="field-group">
              <label>Review{item.hasSpoilers ? ' (spoilers)' : ''}</label>
              {item.hasSpoilers && !revealSpoilers ? (
                <button type="button" className="pill" onClick={() => setRevealSpoilers(true)}>Show spoilers</button>
              ) : (
                <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.animeReview) }} />
              )}
            </div>
          )}

          {item.rewatches && item.rewatches.length > 0 && (
            <div className="field-group">
              <label>Rewatch history</label>
              <table className="track-table">
                <thead>
                  <tr>
                    <th className="col-num">Date</th>
                    <th className="col-rating">Rating</th>
                    <th className="col-title">Notes</th>
                    <th className="col-spacer"></th>
                  </tr>
                </thead>
                <tbody>
                  {item.rewatches.map((r) => (
                    <tr key={r.id}>
                      <td className="col-num">{r.date}</td>
                      <td className="col-rating">{r.rating ? `★ ${r.rating}` : ''}</td>
                      <td className="col-title">{r.notes ?? ''}</td>
                      <td className="col-spacer"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {relatedResolved.length > 0 && (
            <div className="field-group">
              <label>Related</label>
              <div className="cover-strip">
                {relatedResolved.map(({ rel, ref }) => (
                  <button key={rel.itemId} type="button" className="cover-strip-item" onClick={() => onNavigate(rel.itemId)} title={`${ref!.title} — ${getRelationLabel(rel.relation)}`}>
                    {ref!.cover
                      ? <img src={assetSrc(ref!.cover)} alt={ref!.title} />
                      : <div className="cover-strip-placeholder">{ref!.title.slice(0, 2).toUpperCase()}</div>}
                    <span className="cover-strip-badge">{getRelationLabel(rel.relation)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {franchiseItems.length > 1 && (
            <div className="field-group">
              <label>Franchise timeline — {item.franchise}</label>
              <div className="franchise-timeline">
                {franchiseItems.map((f) => (
                  <button key={f.id} type="button" className={f.id === item.id ? 'franchise-item current' : 'franchise-item'} onClick={() => f.id !== item.id && onNavigate(f.id)}>
                    {f.cover && <img src={assetSrc(f.cover)} alt="" />}
                    <span className="franchise-title">{f.title}</span>
                    <span className="franchise-year">{timelineSortKey(f).slice(0, 4)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recommendedResolved.length > 0 && (
            <div className="field-group">
              <label>Recommendations</label>
              <div className="cover-strip">
                {recommendedResolved.map((r) => (
                  <button key={r.id} type="button" className="cover-strip-item" onClick={() => onNavigate(r.id)} title={r.title}>
                    {r.cover
                      ? <img src={assetSrc(r.cover)} alt={r.title} />
                      : <div className="cover-strip-placeholder">{r.title.slice(0, 2).toUpperCase()}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.hasEpisodes && item.episodes && item.episodes.length > 0 && (
            <div className="field-group">
              <label>Episodes</label>
              <table className="track-table episode-table">
                <thead>
                  <tr>
                    <th className="col-num">#</th>
                    <th className="col-title">Title</th>
                    <th className="col-listened">✓</th>
                    <th className="col-rating">Rating</th>
                    <th className="col-fav">Filler</th>
                    <th className="col-spacer"></th>
                  </tr>
                </thead>
                <tbody>
                  {item.episodes.map((ep) => (
                    <tr key={ep.id} className={ep.watched ? 'ep-watched' : ''}>
                      <td className="col-num">{ep.number}</td>
                      <td className="col-title">{ep.title ?? '—'}</td>
                      <td className="col-listened">{ep.watched ? '✓' : ''}</td>
                      <td className="col-rating">{ep.rating ? `★ ${ep.rating}` : ''}</td>
                      <td className="col-fav">{ep.filler ? 'F' : ''}</td>
                      <td className="col-spacer"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {item.notes && (
            <div className="field-group">
              <label>Notes</label>
              <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.notes) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}