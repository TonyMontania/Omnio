import { useState } from 'react'
import { getSeriesStatus, getSeriesFormatLabel, getWatchLocationLabel, getSeasonWatchedCount, getSeasonTotalEpisodes, getRelationLabel, renderMiniMarkdown, assetSrc } from './types'
import { AnimeStatusIcon } from './icons'
import type { Item, Collection } from './types'

function timelineSortKey(i: Item): string {
  return i.airedFrom || i.startYear || i.releaseYear || ''
}

interface Props {
  item: Item
  groups: Collection[]
  allSeries: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
}

export default function SeriesDetailModal({ item, groups, allSeries, onClose, onEdit, onDuplicate, onNavigate }: Props) {
  const [openSeason, setOpenSeason] = useState<string | null>(null)
  const [revealSpoilers, setRevealSpoilers] = useState(false)
  const ss = getSeriesStatus(item.seriesStatus)
  const franchiseItems = item.franchise
    ? allSeries.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedResolved = (item.relatedItems ?? []).map((r) => ({ rel: r, ref: allSeries.find((a) => a.id === r.itemId) })).filter((x) => x.ref)
  const recommendedResolved = (item.recommendedItems ?? []).map((id) => allSeries.find((a) => a.id === id)).filter((x): x is Item => !!x)
  const airedRange = item.airedFrom || item.airedTo
    ? [item.airedFrom, item.airedTo].filter(Boolean).join(' → ')
    : null
  const yearsRange = item.startYear || item.endYear
    ? [item.startYear, item.endYear].filter(Boolean).join(' – ')
    : null

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
            {item.network && <p className="game-modal-devs">{item.network}</p>}
            {item.seriesDescription && <div className="game-modal-description">{item.seriesDescription}</div>}
            <div className="dlc-addons-row">
              <div className="field-group">
                <label>Status</label>
                <div className="pills">
                  <span className="pill static"><AnimeStatusIcon value={ss.value} /> {ss.label}</span>
                  {item.seriesFormat && <span className="pill static">{getSeriesFormatLabel(item.seriesFormat)}</span>}
                  {yearsRange && <span className="pill static">{yearsRange}</span>}
                  {item.contentRating && <span className="pill static">{item.contentRating}</span>}
                  {item.watchedWhere && <span className="pill static">{getWatchLocationLabel(item.watchedWhere)}</span>}
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
            {item.directors && item.directors.length > 0 && (
              <div className="field-group">
                <label>Directors</label>
                <div className="pills">{item.directors.map((d) => <span key={d} className="pill static">{d}</span>)}</div>
              </div>
            )}
            {item.showrunners && item.showrunners.length > 0 && (
              <div className="field-group">
                <label>Showrunners</label>
                <div className="pills">{item.showrunners.map((s) => <span key={s} className="pill static">{s}</span>)}</div>
              </div>
            )}
            {item.writers && item.writers.length > 0 && (
              <div className="field-group">
                <label>Writers</label>
                <div className="pills">{item.writers.map((w) => <span key={w} className="pill static">{w}</span>)}</div>
              </div>
            )}
            {item.cast && item.cast.length > 0 && (
              <div className="field-group">
                <label>Cast</label>
                <div className="pills">{item.cast.map((c) => <span key={c} className="pill static">{c}</span>)}</div>
              </div>
            )}
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
            {item.unitCount && (
              <div className="field-group">
                <label>Seasons</label>
                <div className="pills"><span className="pill static">{item.unitCount}</span></div>
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
            {item.country && (
              <div className="field-group">
                <label>Country</label>
                <div className="pills"><span className="pill static">{item.country}</span></div>
              </div>
            )}
            {item.language && (
              <div className="field-group">
                <label>Language</label>
                <div className="pills"><span className="pill static">{item.language}</span></div>
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
          </div>

          {item.seriesReview && (
            <div className="field-group">
              <label>Review{item.hasSpoilers ? ' (spoilers)' : ''}</label>
              {item.hasSpoilers && !revealSpoilers ? (
                <button type="button" className="pill" onClick={() => setRevealSpoilers(true)}>Show spoilers</button>
              ) : (
                <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.seriesReview) }} />
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

          {item.hasSeasons && item.seasons && item.seasons.length > 0 && (
            <div className="field-group">
              <label>Seasons</label>
              <div className="season-list">
                {item.seasons.map((s) => {
                  const isOpen = openSeason === s.id
                  const w = getSeasonWatchedCount(s)
                  const t = getSeasonTotalEpisodes(s)
                  return (
                    <div key={s.id} className="season-row">
                      <button type="button" className="season-head clickable" onClick={() => s.episodes && s.episodes.length > 0 && setOpenSeason(isOpen ? null : s.id)}>
                        <span className="season-expand">{s.episodes && s.episodes.length > 0 ? (isOpen ? '▾' : '▸') : ''}</span>
                        <span className="season-label">S{s.number}</span>
                        <span className="season-title">{s.title ?? ''}</span>
                        {s.year && <span className="season-year">{s.year}</span>}
                        <span className="season-count">{w}/{t || '?'}</span>
                        {s.rating ? <span className="pill static">★ {s.rating}</span> : null}
                        {s.watched && !s.episodes?.length && <span className="pill static">✓</span>}
                      </button>
                      {isOpen && s.episodes && s.episodes.length > 0 && (
                        <table className="track-table episode-table season-episodes-table">
                          <thead>
                            <tr>
                              <th className="col-num">#</th>
                              <th className="col-title">Title</th>
                              <th className="col-listened">✓</th>
                              <th className="col-rating">Rating</th>
                              <th className="col-spacer"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.episodes.map((ep) => (
                              <tr key={ep.id} className={ep.watched ? 'ep-watched' : ''}>
                                <td className="col-num">{ep.number}</td>
                                <td className="col-title">{ep.title ?? '—'}</td>
                                <td className="col-listened">{ep.watched ? '✓' : ''}</td>
                                <td className="col-rating">{ep.rating ? `★ ${ep.rating}` : ''}</td>
                                <td className="col-spacer"></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
              </div>
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
