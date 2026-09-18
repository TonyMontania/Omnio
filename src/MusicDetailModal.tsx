import { useState } from 'react'
import { getMusicTypeLabel, isAlbumLikeMusic, getTotalDuration, getMusicSourceLabel, getVinylConditionLabel, assetSrc } from './types'
import { StarRatingDisplay } from './StarRating'
import type { Item, AnyItem, MusicItem, Collection } from './types'
import DetailTopbar from './components/detail/DetailTopbar'
import { exportItemAsJson } from './utils/files'
import { formatIsoDate } from './utils/format'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import DetailNotes from './components/detail/DetailNotes'
import CoverPlaceholder from './components/CoverPlaceholder'


interface Props {
  item: MusicItem
  groups: Collection[]
  allMusic: AnyItem[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
  allItems?: AnyItem[]
  onSaveTrackLyrics: (trackId: string, lyrics: string) => void
}

export default function MusicDetailModal({ item, groups, allMusic, onClose, onEdit, onDuplicate, onNavigate, onSaveTrackLyrics }: Props) {
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
  const relatedEntries = (item.relatedItems ?? [])
    .map((r) => ({ ref: allMusic.find((a) => a.id === r.itemId), rel: r }))
    .filter((x) => x.ref)
    .map(({ ref, rel }) => ({ item: ref!, badge: rel.relation }))
  const recommendedEntries = (item.recommendedItems ?? [])
    .map((id) => allMusic.find((a) => a.id === id))
    .filter((x): x is Item => !!x)
    .map((it) => ({ item: it }))

  return (
    <div className="game-page music-page">
      <DetailTopbar onBack={onClose} onDuplicate={onDuplicate} onEdit={onEdit} onExport={() => exportItemAsJson(item as unknown as Record<string, unknown>, item.title)} />

      <div className="music-modal-main">
        <div className="music-modal-cover">
          {item.cover ? <img className="zoomable" src={assetSrc(item.cover)} alt={item.title} data-zoom-label="Cover" /> : <div className="cover-preview-placeholder"><CoverPlaceholder categoryId={item.categoryId} /></div>}
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
                  <span className="pill static">{item.releaseDate ? formatIsoDate(item.releaseDate) : item.releaseYear}</span>
                </div>
              </div>
            )}
            {albumLike && item.genres && item.genres.length > 0 && (
              <div className="field-group">
                <label>Genres</label>
                <div className="card-tags">{item.genres.map((g) => <span key={g} className="card-tag">{g}</span>)}</div>
              </div>
            )}
            <div className="field-group">
              <label>Status</label>
              <span className="pill static">{item.consumed ? '✓ Listened' : 'Not listened'}</span>
              {!albumLike && (() => {
                // Prefer the live reference over the free-text label — when
                // both are set, the ID always wins. Clicking navigates to
                // the target album's detail view via the same handler that
                // the "Related" strip uses.
                const linkedAlbum = item.partOfAlbumId ? allMusic.find((a) => a.id === item.partOfAlbumId) : null
                if (linkedAlbum) {
                  return (
                    <button
                      type="button"
                      className="pill static clickable"
                      onClick={() => onNavigate(linkedAlbum.id)}
                      title="Open linked album"
                    >Part of: {linkedAlbum.title}</button>
                  )
                }
                if (item.partOfAlbum) return <span className="pill static">Part of: {item.partOfAlbum}</span>
                return null
              })()}
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

      <div className="music-modal-notes-wrap">
        {item.vinylCondition && (
          <div className="field-group">
            <label>Vinyl condition</label>
            <div className="pills"><span className="pill static">{getVinylConditionLabel(item.vinylCondition)}</span></div>
          </div>
        )}
        <DetailReview review={item.musicReview} hasSpoilers={item.hasSpoilers} />
        <DetailNotes notes={item.notes} />
        <DetailHistoryTable label="Listen history" entries={item.rewatches ?? []} />
        <DetailCoverStrip label="Related" entries={relatedEntries} onNavigate={onNavigate} />
        <DetailCoverStrip label="Recommendations" entries={recommendedEntries} onNavigate={onNavigate} />
          <CustomFieldsView fields={item.customFields} />
      </div>

      {albumLike && item.tracks && item.tracks.length > 0 && (() => {
        // Group tracks by disc when the album is multi-disc. Parse
        // discCount the same way the editor does — first digit wins.
        const parsedDiscs = (() => {
          const raw = (item.discCount ?? '').trim()
          if (!raw) return 1
          const m = /(\d+)/.exec(raw)
          return m ? Math.max(1, Math.min(20, parseInt(m[1], 10))) : 1
        })()
        const isMultiDisc = parsedDiscs > 1
        const groups: { disc: string; list: typeof item.tracks }[] = (() => {
          if (!isMultiDisc) return [{ disc: '', list: item.tracks! }]
          const map = new Map<string, typeof item.tracks>()
          for (let d = 1; d <= parsedDiscs; d++) map.set(String(d), [])
          for (const t of item.tracks!) {
            const key = t.disc && map.has(t.disc) ? t.disc : '1'
            map.get(key)!.push(t)
          }
          return Array.from(map.entries()).map(([disc, list]) => ({ disc, list: list! }))
        })()

        const renderRow = (t: typeof item.tracks[0]) => (
          <tr key={t.id}>
            <td className="col-num">{t.number}</td>
            <td className="col-title">{t.favorite && <span className="track-fav-star" aria-label="Favourite">★ </span>}{t.name}</td>
            <td className="col-artist">
              {(() => {
                const raw = t.artist?.trim()
                if (!raw) return null
                // Only split on separators that mean "multiple artists"
                // — commas, ampersands, `feat.` / `ft.`, and ` x `. Do
                // NOT split on `/` or `:` — those are common inside a
                // single band name (156/Silence, AC/DC, He Is Legend,
                // Sunami:Portrayal Of Guilt). Splitting on those was
                // turning one band into two pills.
                const parts = raw
                  .split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\sx\s)\s*/i)
                  .map((p) => p.trim())
                  .filter(Boolean)
                // Always render as pills — same visual weight whether
                // there's one artist or many, so a track with a lone
                // "Architects" doesn't sit next to another track with
                // "Architects · Jon Green" in a different style. Before,
                // the single-artist branch fell back to plain text.
                return (
                  <span className="track-artist-pills">
                    {parts.map((p, i) => <span key={i} className="track-artist-pill">{p}</span>)}
                  </span>
                )
              })()}
            </td>
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
        )

        return (
          <div className="field-group music-tracklist">
            <div className="tracklist-header-row">
              <label>Tracklist</label>
              {totalDuration && <span className="tracklist-total">Total: {totalDuration}</span>}
            </div>
            {groups.map(({ disc, list }) => (
              <div key={disc || 'single'} className="track-disc-group">
                {isMultiDisc && <div className="track-disc-divider">Disc {disc} <span className="track-disc-count">· {list.length} {list.length === 1 ? 'track' : 'tracks'}</span></div>}
                <table className="track-table">
                  <thead>
                    <tr>
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
                  <tbody>{list.map(renderRow)}</tbody>
                </table>
              </div>
            ))}
          </div>
        )
      })()}

      {albumLike && item.singleCovers && item.singleCovers.length > 0 && (
        <div className="field-group single-covers-gallery">
          <label>Single covers</label>
          <div className="single-covers-grid">
            {item.singleCovers.map((s) => (
              <div key={s.id} className="single-cover-card">
                <img className="zoomable" src={assetSrc(s.cover)} alt={s.name} data-zoom-group={`music-singles-${item.id}`} data-zoom-label={s.name} data-zoom-caption={s.year ? String(s.year) : undefined} />
                <span>{s.name}{s.year ? ` (${s.year})` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {albumLike && item.editions && item.editions.length > 0 && (
        <div className="field-group music-editions">
          <label>Editions</label>
          {item.editions.map((ed) => {
            // Editions without their own cover fall back to the album's main
            // cover — Deluxe / Anniversary re-issues almost always share
            // the base artwork, and forcing the user to re-upload it was
            // creating a "No cover" placeholder on nearly every entry.
            const displayCover = ed.cover ?? item.cover
            return (
              <div key={ed.id} className="music-edition">
                {displayCover
                  ? <img className="music-edition-cover zoomable" src={assetSrc(displayCover)} alt={ed.name} data-zoom-group={`music-editions-${item.id}`} data-zoom-label={ed.name} data-zoom-caption={ed.releaseDate || undefined} />
                  : <div className="music-edition-cover placeholder"><CoverPlaceholder categoryId={item.categoryId} /></div>}
                <div className="music-edition-info">
                  <h4>{ed.name}</h4>
                  {ed.releaseDate && <p className="music-edition-date">{ed.releaseDate}</p>}
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
            )
          })}
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
