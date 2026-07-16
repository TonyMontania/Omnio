import { useState } from 'react'
import { getMusicTypeLabel, renderMiniMarkdown, isAlbumLikeMusic, getTotalDuration, getMusicSourceLabel, getRelationLabel, assetSrc } from './types'
import { StarRatingDisplay } from './StarRating'
import type { Item, Collection } from './types'


interface Props {
  item: Item
  groups: Collection[]
  allMusic: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
  onSaveTrackLyrics: (trackId: string, lyrics: string) => void
}

export default function MusicDetailModal({ item, groups, allMusic, onClose, onEdit, onDuplicate, onNavigate, onSaveTrackLyrics }: Props) {
  const [revealSpoilers, setRevealSpoilers] = useState(false)
  const [lyricsTrackId, setLyricsTrackId] = useState<string | null>(null)
  const [lyricsDraft, setLyricsDraft] = useState('')
  const [lyricsEditing, setLyricsEditing] = useState(false)
  const openLyrics = (t: { id: string; lyrics?: string }) => {
    setLyricsTrackId(t.id)
    setLyricsDraft(t.lyrics ?? '')
    setLyricsEditing(!t.lyrics)
  }
  const currentLyricsTrack = item.tracks?.find((t) => t.id === lyricsTrackId) ?? null
  const albumLike = isAlbumLikeMusic(item.musicType)
  const totalDuration = albumLike && item.tracks && item.tracks.length > 0 ? getTotalDuration(item.tracks) : null
  const relatedResolved = (item.relatedItems ?? []).map((r) => ({ rel: r, ref: allMusic.find((a) => a.id === r.itemId) })).filter((x) => x.ref)
  const recommendedResolved = (item.recommendedItems ?? []).map((id) => allMusic.find((a) => a.id === id)).filter((x): x is Item => !!x)

  return (
    <div className="game-page music-page">
      <div className="game-page-topbar">
        <button className="back-btn wide" onClick={onClose}>← Back</button>
        <div className="game-page-actions">
          <button className="edit-btn" onClick={onDuplicate}>⧉ Duplicate</button>
          <button className="edit-btn" onClick={onEdit}>✎ Edit</button>
        </div>
      </div>

      <div className="music-modal-main">
        <div className="music-modal-cover">
          {item.cover ? <img src={assetSrc(item.cover)} alt="" /> : <div className="cover-preview-placeholder">No cover</div>}
        </div>
        <div className="music-modal-info">
          <h1>{item.title}</h1>
          {item.alternativeTitles && item.alternativeTitles.length > 0 && (
            <p className="game-modal-alt-titles">{item.alternativeTitles.join(' · ')}</p>
          )}
          {item.artist && <p className="music-modal-artist">{item.artist}</p>}
          {albumLike && item.label && <p className="music-modal-label">{item.label}</p>}
          {item.producers && item.producers.length > 0 && (
            <p className="music-modal-label">Produced by {item.producers.join(', ')}</p>
          )}

          <div className="music-badge-row">
            {item.musicType && (
              <div className="field-group">
                <label>Type</label>
                <div className="pills"><span className="pill static">{getMusicTypeLabel(item.musicType)}</span></div>
              </div>
            )}
            {item.musicSource && (
              <div className="field-group">
                <label>Source</label>
                <div className="pills"><span className="pill static">{getMusicSourceLabel(item.musicSource)}</span></div>
              </div>
            )}
            {(item.releaseDate || item.releaseYear) && (
              <div className="field-group">
                <label>Release</label>
                <div className="pills">
                  <span className="pill static">{item.releaseDate ? new Date(item.releaseDate).toLocaleDateString() : item.releaseYear}</span>
                </div>
              </div>
            )}
            {albumLike && item.genres && item.genres.length > 0 && (
              <div className="field-group">
                <label>Genres</label>
                <div className="pills">{item.genres.map((g) => <span key={g} className="pill static">{g}</span>)}</div>
              </div>
            )}
            <div className="field-group">
              <label>Status</label>
              <span className="pill static">{item.consumed ? '✓ Listened' : 'Not listened'}</span>
              {!albumLike && item.partOfAlbum && <span className="pill static">Part of: {item.partOfAlbum}</span>}
            </div>
            {item.rating ? (
              <div className="field-group">
                <label>Rating</label>
                <div className="pills"><StarRatingDisplay value={item.rating} /></div>
              </div>
            ) : null}
            {albumLike && item.finishedAt && (
              <div className="field-group">
                <label>Listened on</label>
                <div className="pills"><span className="pill static">{item.finishedAt}</span></div>
              </div>
            )}
          </div>

          {groups.length > 0 && (
            <div className="field-group">
              <label>Groups</label>
              <div className="pills">
                {groups.map((g) => <span key={g.id} className="badge group-badge">{g.name}</span>)}
              </div>
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

      {item.musicReview && (
        <div className="field-group music-modal-notes">
          <label>Review{item.hasSpoilers ? ' (spoilers)' : ''}</label>
          {item.hasSpoilers && !revealSpoilers ? (
            <button type="button" className="pill" onClick={() => setRevealSpoilers(true)}>Show spoilers</button>
          ) : (
            <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.musicReview) }} />
          )}
        </div>
      )}

      {item.notes && (
        <div className="field-group music-modal-notes">
          <label>Notes</label>
          <div className="notes-preview" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.notes) }} />
        </div>
      )}

      {item.rewatches && item.rewatches.length > 0 && (
        <div className="field-group music-modal-notes">
          <label>Listen history</label>
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
        <div className="field-group music-modal-notes">
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

      {recommendedResolved.length > 0 && (
        <div className="field-group music-modal-notes">
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

      {albumLike && item.tracks && item.tracks.length > 0 && (
        <div className="field-group music-tracklist">
          <div className="tracklist-header-row">
            <label>Tracklist</label>
            {totalDuration && <span className="tracklist-total">Total: {totalDuration}</span>}
          </div>
          <table className="track-table">
            <thead>
              <tr>
                <th className="col-fav"></th>
                <th className="col-num">#</th>
                <th className="col-title">Title</th>
                <th className="col-artist">Artist</th>
                <th className="col-duration">Duration</th>
                <th className="col-rating">Rating</th>
                <th className="col-listened">Listened</th>
                <th className="col-lyrics">Lyrics</th>
                <th className="col-spacer"></th>
              </tr>
            </thead>
            <tbody>
              {item.tracks.map((t) => (
                <tr key={t.id}>
                  <td className="col-fav">{t.favorite ? <span className="track-fav-star">★</span> : null}</td>
                  <td className="col-num">{t.number}</td>
                  <td className="col-title">{t.name}</td>
                  <td className="col-artist">{t.artist || ''}</td>
                  <td className="col-duration">{t.duration}</td>
                  <td className="col-rating">{t.rating ? <StarRatingDisplay value={t.rating} /> : null}</td>
                  <td className="col-listened">{t.listened ? '✓' : ''}</td>
                  <td className="col-lyrics">
                    <button type="button" className={t.lyrics ? 'lyrics-btn has-lyrics' : 'lyrics-btn'} onClick={() => openLyrics(t)}>
                      {t.lyrics ? 'View' : '+ Add'}
                    </button>
                  </td>
                  <td className="col-spacer"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {albumLike && item.singleCovers && item.singleCovers.length > 0 && (
        <div className="field-group single-covers-gallery">
          <label>Single covers</label>
          <div className="single-covers-grid">
            {item.singleCovers.map((s) => (
              <div key={s.id} className="single-cover-card">
                <img src={assetSrc(s.cover)} alt={s.name} />
                <span>{s.name}{s.year ? ` (${s.year})` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {albumLike && item.editions && item.editions.length > 0 && (
        <div className="field-group music-editions">
          <label>Editions</label>
          {item.editions.map((ed) => (
            <div key={ed.id} className="music-edition">
              {ed.cover
                ? <img className="music-edition-cover" src={assetSrc(ed.cover)} alt="" />
                : <div className="music-edition-cover placeholder">No cover</div>}
              <div className="music-edition-info">
                <h4>{ed.name}</h4>
                {ed.tracks && ed.tracks.length > 0 && (
                  <div className="music-edition-tracks">
                    {ed.tracks.map((t) => (
                      <div key={t.id} className="music-edition-track">
                        <span className="t-num">{t.number}</span>
                        <span className="t-name">{t.name}{t.favorite ? ' ★' : ''}</span>
                        {t.duration && <span>{t.duration}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {currentLyricsTrack && (
        <div className="modal-overlay" onClick={() => setLyricsTrackId(null)}>
          <div className="modal-box lyrics-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lyrics-header">
              <div>
                <p className="lyrics-track-title">{currentLyricsTrack.name}</p>
                <p className="lyrics-track-meta">{currentLyricsTrack.artist || item.artist} · {currentLyricsTrack.duration}</p>
              </div>
              <button type="button" className="panel-close" onClick={() => setLyricsTrackId(null)}>✕</button>
            </div>
            {lyricsEditing ? (
              <textarea
                className="lyrics-textarea"
                value={lyricsDraft}
                onChange={(e) => setLyricsDraft(e.target.value)}
                placeholder="Paste or type the lyrics here…"
                rows={16}
                autoFocus
              />
            ) : (
              <pre className="lyrics-view">{currentLyricsTrack.lyrics || 'No lyrics yet.'}</pre>
            )}
            <div className="modal-actions">
              {lyricsEditing ? (
                <>
                  <button className="ghost" onClick={() => { setLyricsEditing(false); setLyricsDraft(currentLyricsTrack.lyrics ?? '') }}>Cancel</button>
                  <button className="danger-solid" onClick={() => { onSaveTrackLyrics(currentLyricsTrack.id, lyricsDraft); setLyricsEditing(false) }}>Save lyrics</button>
                </>
              ) : (
                <>
                  <button className="ghost" onClick={() => setLyricsTrackId(null)}>Close</button>
                  <button className="danger-solid" onClick={() => setLyricsEditing(true)}>Edit</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}