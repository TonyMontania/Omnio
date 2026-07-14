import { useState } from 'react'
import { renderMiniMarkdown, formatDurationMinutes, getWatchLocationLabel, getMovieSourceLabel, getRelationLabel, assetSrc } from './types'
import type { Item, Collection } from './types'

interface Props {
  item: Item
  groups: Collection[]
  allMovies: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
}

function timelineSortKey(i: Item): string {
  return i.releaseYear || ''
}

export default function MovieDetailModal({ item, groups, allMovies, onClose, onEdit, onDuplicate, onNavigate }: Props) {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false)
  const banner = item.bannerImage2
  const franchiseItems = item.franchise
    ? allMovies.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedResolved = (item.relatedItems ?? []).map((r) => ({ rel: r, ref: allMovies.find((a) => a.id === r.itemId) })).filter((x) => x.ref)
  const recommendedResolved = (item.recommendedItems ?? []).map((id) => allMovies.find((a) => a.id === id)).filter((x): x is Item => !!x)

  return (
    <div className="game-page">
      <div className="game-page-topbar">
        <button className="back-btn wide" onClick={onClose}>← Back</button>
        <div className="game-page-actions">
          <button className="edit-btn" onClick={onDuplicate}>⧉ Duplicate</button>
          <button className="edit-btn" onClick={onEdit}>✎ Edit</button>
        </div>
      </div>

      {banner && (
        <div className="game-modal-banner">
          <img src={assetSrc(banner)} alt="" />
          <div className="banner-fade" />
        </div>
      )}

      <div className="game-modal-body" style={banner ? { marginTop: 110 } : undefined}>
        <div className="game-modal-main">
          <div className="game-modal-cover">
            {item.cover ? <img src={assetSrc(item.cover)} alt="" /> : <div className="cover-preview-placeholder">No cover</div>}
          </div>
          <div className="game-modal-info">
            <div className="game-modal-title-row">
              <h1>{item.title} {item.releaseYear && <span className="game-modal-year">({item.releaseYear})</span>}</h1>
            </div>
            {item.alternativeTitles && item.alternativeTitles.length > 0 && (
              <p className="game-modal-alt-titles">{item.alternativeTitles.join(' · ')}</p>
            )}
            {item.directors && item.directors.length > 0 && (
              <p className="game-modal-devs">{item.directors.join(', ')}</p>
            )}
            {item.cast && item.cast.length > 0 && (
              <p className="game-modal-devs">Starring: {item.cast.join(', ')}</p>
            )}
            {item.movieDescription && <div className="game-modal-description">{item.movieDescription}</div>}
            <div className="dlc-addons-row">
              <div className="field-group">
                <label>Status</label>
                <div className="pills">
                  <span className="pill static">{item.consumed ? '✓ Watched' : 'Not watched'}</span>
                  {item.movieSource && <span className="pill static">Source: {getMovieSourceLabel(item.movieSource)}</span>}
                  {item.contentRating && <span className="pill static">{item.contentRating}</span>}
                </div>
              </div>
              {item.franchise && (
                <div className="field-group">
                  <label>Franchise</label>
                  <div className="pills"><span className="pill static">{item.franchise}</span></div>
                </div>
              )}
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
            {formatDurationMinutes(item.duration) && (
              <div className="field-group">
                <label>Duration</label>
                <div className="pills"><span className="pill static">{formatDurationMinutes(item.duration)}</span></div>
              </div>
            )}
            {item.timesWatched && (
              <div className="field-group">
                <label>Times watched</label>
                <div className="pills"><span className="pill static">{item.timesWatched}×</span></div>
              </div>
            )}
            {item.rating ? (
              <div className="field-group">
                <label>Rating</label>
                <div className="pills"><span className="pill static">★ {item.rating}</span></div>
              </div>
            ) : null}
            {item.finishedAt && (
              <div className="field-group">
                <label>Watched on</label>
                <div className="pills"><span className="pill static">{item.finishedAt}</span></div>
              </div>
            )}
            {item.watchedWhere && (
              <div className="field-group">
                <label>Watched where</label>
                <div className="pills"><span className="pill static">{getWatchLocationLabel(item.watchedWhere)}</span></div>
              </div>
            )}
          </div>

          {item.movieReview && (
            <div className="field-group">
              <label>Review{item.hasSpoilers ? ' (spoilers)' : ''}</label>
              {item.hasSpoilers && !spoilerRevealed ? (
                <button type="button" className="spoiler-reveal-btn" onClick={() => setSpoilerRevealed(true)}>
                  ⚠ This review contains spoilers — click to reveal
                </button>
              ) : (
                <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.movieReview) }} />
              )}
            </div>
          )}

          {item.notes && (
            <div className="field-group">
              <label>Notes</label>
              <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.notes) }} />
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
              <label>Franchise — {item.franchise}</label>
              <div className="franchise-timeline">
                {franchiseItems.map((f) => (
                  <button key={f.id} type="button" className={f.id === item.id ? 'franchise-item current' : 'franchise-item'} onClick={() => f.id !== item.id && onNavigate(f.id)}>
                    {f.cover && <img src={assetSrc(f.cover)} alt="" />}
                    <span className="franchise-title">{f.title}</span>
                    <span className="franchise-year">{timelineSortKey(f)}</span>
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
        </div>
      </div>
    </div>
  )
}