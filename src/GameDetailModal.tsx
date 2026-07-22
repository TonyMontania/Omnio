import { useState } from 'react'
import { getOwnershipLabel, getGameStatus, getGameSourceLabel, getAgeRatingLabel, getRelationLabel, renderMiniMarkdown, assetSrc } from './types'
import { GameStatusIcon } from './icons'
import type { Item, Collection } from './types'

interface Props {
  item: Item
  groups: Collection[]
  allGames: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
}

function timelineSortKey(i: Item): string {
  return i.releaseDate || i.releaseYear || ''
}

export default function GameDetailModal({ item, groups, allGames, onClose, onEdit, onDuplicate, onNavigate }: Props) {
  const [revealSpoilers, setRevealSpoilers] = useState(false)
  const gs = getGameStatus(item.gameStatus)
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null
  const franchiseItems = item.franchise
    ? allGames.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedResolved = (item.relatedItems ?? []).map((r) => ({ rel: r, ref: allGames.find((a) => a.id === r.itemId) })).filter((x) => x.ref)
  const recommendedResolved = (item.recommendedItems ?? []).map((id) => allGames.find((a) => a.id === id)).filter((x): x is Item => !!x)

  return (
    <div className="game-page">
      <div className="game-page-topbar">
        <button className="back-btn wide" onClick={onClose}>← Back</button>
        <div className="game-page-actions">
          <button className="edit-btn" onClick={onDuplicate}>⧉ Duplicate</button>
          <button className="edit-btn" onClick={onEdit}>✎ Edit</button>
        </div>
      </div>

      {item.bannerImage && (
        <div className="game-modal-banner">
          <img src={assetSrc(item.bannerImage)} alt="" />
          <div className="banner-fade" />
        </div>
      )}
      {item.bannerImage && item.logoImage && <img className="game-modal-logo" src={assetSrc(item.logoImage)} alt="" />}

      <div className="game-modal-body" style={item.bannerImage ? { marginTop: 110 } : undefined}>
        <div className="game-modal-main">
          <div className="game-modal-cover">
            {item.cover ? <img src={assetSrc(item.cover)} alt="" /> : <div className="cover-preview-placeholder">No cover</div>}
          </div>
          <div className="game-modal-info">
            <div className="game-modal-title-row">
              <h1>{item.title} {year && <span className="game-modal-year">({year})</span>}</h1>
              {!item.bannerImage && item.logoImage && <img className="game-modal-logo-inline" src={assetSrc(item.logoImage)} alt="" />}
            </div>
            {item.alternativeTitles && item.alternativeTitles.length > 0 && (
              <p className="game-modal-alt-titles">{item.alternativeTitles.join(' · ')}</p>
            )}
            {((item.devs && item.devs.length > 0) || (item.publishers && item.publishers.length > 0)) && (
              <p className="game-modal-devs">
                {item.devs && item.devs.length > 0 && item.devs.join(', ')}
                {item.devs && item.devs.length > 0 && item.publishers && item.publishers.length > 0 && ' · '}
                {item.publishers && item.publishers.length > 0 && item.publishers.join(', ')}
              </p>
            )}
            {item.description && <div className="game-modal-description">{item.description}</div>}
            <div className="dlc-addons-row">
              <div className="field-group">
                <label>Status</label>
                <div className="pills">
                  <span className={`badge status-badge status-${gs.value}`}><GameStatusIcon value={gs.value} /> {gs.label}</span>
                  {item.gameSource && <span className="pill static">Source: {getGameSourceLabel(item.gameSource)}</span>}
                  {item.ageRating && <span className="pill static">{getAgeRatingLabel(item.ageRating)}</span>}
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
          {item.platforms && item.platforms.length > 0 && (
            <div className="field-group">
              <label>Platforms</label>
              <div className="pills">{item.platforms.map((p) => <span key={p} className="pill static">{p}</span>)}</div>
            </div>
          )}
          <div className="dlc-addons-row wrap-4">
            {item.ownership && (
              <div className="field-group">
                <label>Ownership</label>
                <div className="pills"><span className="pill static">{getOwnershipLabel(item.ownership)}</span></div>
              </div>
            )}
            {item.playTime && (
              <div className="field-group">
                <label>Time played</label>
                <div className="pills"><span className="pill static">{item.playTime}h played</span></div>
              </div>
            )}
            {(item.achievementsUnlocked || item.achievementsTotal) && (
              <div className="field-group">
                <label>Achievements</label>
                <div className="pills"><span className="pill static">{item.achievementsUnlocked || '0'} / {item.achievementsTotal || '?'}</span></div>
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
                <label>Completion date</label>
                <div className="pills"><span className="pill static">Finished: {item.finishedAt}</span></div>
              </div>
            )}
          </div>

          {item.bundleContents && item.bundleContents.length > 0 && (
            <div className="field-group">
              <label>Bundle contents</label>
              <div className="bundle-view-grid">
                {item.bundleContents.map((b) => (
                  <div key={b.id} className="bundle-view-card">
                    <div className="bundle-view-cover">
                      {b.cover
                        ? <img src={assetSrc(b.cover)} alt={b.name} />
                        : <span>{b.name.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="bundle-view-text">
                      <div className="bundle-view-name">{b.name}</div>
                      <span className="pill static">
                        <GameStatusIcon value={b.status} /> {getGameStatus(b.status).label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {((item.dlcList && item.dlcList.length > 0) || (item.addonsList && item.addonsList.length > 0)) && (
            <div className="dlc-addons-row">
              {item.dlcList && item.dlcList.length > 0 && (
                <div className="field-group">
                  <label>DLC &amp; expansions</label>
                  <ul className="tag-list">
                    {item.dlcList.map((d) => (
                      <li key={d.id}><span>{d.name}</span><span className="pill static"><GameStatusIcon value={d.status} /> {getGameStatus(d.status).label}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {item.addonsList && item.addonsList.length > 0 && (
                <div className="field-group">
                  <label>Addons</label>
                  <ul className="tag-list">
                    {item.addonsList.map((d) => (
                      <li key={d.id}><span>{d.name}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {item.gameReview && (
            <div className="field-group">
              <label>Review{item.hasSpoilers ? ' (spoilers)' : ''}</label>
              {item.hasSpoilers && !revealSpoilers ? (
                <button type="button" className="pill" onClick={() => setRevealSpoilers(true)}>Show spoilers</button>
              ) : (
                <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.gameReview) }} />
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
              <label>Replay history</label>
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
        </div>
      </div>
    </div>
  )
}