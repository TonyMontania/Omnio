import { useState } from 'react'
import { getMangaStatus, getPublicationStatusLabel, getMangaSourceLabel, getAgeRatingLabel, getRelationLabel, getNextUnreadChapter, renderMiniMarkdown, assetSrc } from './types'
import { MangaStatusIcon } from './icons'
import type { Item, Collection } from './types'

function timelineSortKey(i: Item): string {
  return i.startDate || i.releaseYear || ''
}

interface Props {
  item: Item
  groups: Collection[]
  allManga: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
}

export default function MangaDetailModal({ item, groups, allManga, onClose, onEdit, onDuplicate, onNavigate }: Props) {
  const [revealSpoilers, setRevealSpoilers] = useState(false)
  const ms = getMangaStatus(item.mangaStatus)
  const nextCh = item.hasChapters ? getNextUnreadChapter(item.chapters) : null
  const franchiseItems = item.franchise
    ? allManga.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedResolved = (item.relatedItems ?? []).map((r) => ({ rel: r, ref: allManga.find((a) => a.id === r.itemId) })).filter((x) => x.ref)
  const recommendedResolved = (item.recommendedItems ?? []).map((id) => allManga.find((a) => a.id === id)).filter((x): x is Item => !!x)

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
            {((item.authors && item.authors.length > 0) || (item.mangaArtists && item.mangaArtists.length > 0)) && (
              <p className="game-modal-devs">
                {item.authors && item.authors.join(', ')}
                {item.authors && item.authors.length > 0 && item.mangaArtists && item.mangaArtists.length > 0 && ' · '}
                {item.mangaArtists && item.mangaArtists.join(', ')}
              </p>
            )}
            {item.mangaDescription && <div className="game-modal-description">{item.mangaDescription}</div>}
            <div className="dlc-addons-row">
              <div className="field-group">
                <label>Status</label>
                <div className="pills">
                  <span className={`badge status-badge status-${ms.value}`}><MangaStatusIcon value={ms.value} /> {ms.label}</span>
                  {item.pubStatus && <span className="badge group-badge">{getPublicationStatusLabel(item.pubStatus)}</span>}
                  {item.mangaSource && <span className="pill static">Source: {getMangaSourceLabel(item.mangaSource)}</span>}
                  {item.ageRating && <span className="pill static">{getAgeRatingLabel(item.ageRating)}</span>}
                  {item.magazine && <span className="pill static">{item.magazine}</span>}
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
            {item.chaptersRead && (
              <div className="field-group">
                <label>Chapters</label>
                <div className="pills"><span className="pill static">{item.chaptersRead}{item.totalChapters ? ` / ${item.totalChapters}` : ''}</span></div>
              </div>
            )}
            {item.volumesRead && (
              <div className="field-group">
                <label>Volumes</label>
                <div className="pills"><span className="pill static">{item.volumesRead}{item.totalVolumes ? ` / ${item.totalVolumes}` : ''}</span></div>
              </div>
            )}
            {item.rating ? (
              <div className="field-group">
                <label>Rating</label>
                <div className="pills"><span className="pill static">★ {item.rating}</span></div>
              </div>
            ) : null}
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
            {nextCh && (
              <div className="field-group">
                <label>Next chapter</label>
                <div className="pills"><span className="pill static">Ch. {nextCh.number}{nextCh.title ? ` — ${nextCh.title}` : ''}</span></div>
              </div>
            )}
          </div>

          {item.mangaReview && (
            <div className="field-group">
              <label>Review{item.hasSpoilers ? ' (spoilers)' : ''}</label>
              {item.hasSpoilers && !revealSpoilers ? (
                <button type="button" className="pill" onClick={() => setRevealSpoilers(true)}>Show spoilers</button>
              ) : (
                <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.mangaReview) }} />
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
              <label>Reread history</label>
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

          {item.hasChapters && item.chapters && item.chapters.length > 0 && (
            <div className="field-group">
              <label>Chapters</label>
              <table className="track-table episode-table">
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
                  {item.chapters.map((c) => (
                    <tr key={c.id} className={c.read ? 'ep-watched' : ''}>
                      <td className="col-num">{c.number}</td>
                      <td className="col-title">{c.title ?? '—'}</td>
                      <td className="col-listened">{c.read ? '✓' : ''}</td>
                      <td className="col-rating">{c.rating ? `★ ${c.rating}` : ''}</td>
                      <td className="col-spacer"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {item.volumeCovers && item.volumeCovers.length > 0 && (
        <div className="field-group volume-gallery">
          <label>Volumes</label>
          <div className="volume-grid">
            {item.volumeCovers.map((v) => (
              <div key={v.id} className="volume-card">
                <span className="volume-label">Volume {v.number}</span>
                <img src={assetSrc(v.cover)} alt={`Volume ${v.number}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}