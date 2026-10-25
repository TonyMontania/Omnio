import { useState } from 'react'
import { getMusicTypeLabel, isAlbumLikeMusic, getTotalDuration, getMusicSourceLabel, getVinylConditionLabel, assetSrc } from './types'
import { StarRatingDisplay } from './StarRating'
import type { Item, AnyItem, MusicItem, Collection } from './types'
import DetailShell, { DetailChips, DetailFacts, DetailSection } from './components/detail/DetailShell'
import { exportItemAsJson } from './utils/files'
import { formatIsoDate } from './utils/format'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import DetailNotes from './components/detail/DetailNotes'
import CoverPlaceholder from './components/CoverPlaceholder'
import { numColumnWidth } from './utils/numColumn'
import { plural, t } from './i18n'


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

export default function MusicDetailModal({ item, groups, allMusic, onEdit, onDuplicate, onNavigate, onSaveTrackLyrics }: Props) {
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

  const editionCount = (albumLike ? (item.editions?.length ?? 0) + (item.singleCovers?.length ?? 0) : 0)
  const relatedCount = relatedEntries.length + recommendedEntries.length
  const releaseLabel = item.releaseDate ? formatIsoDate(item.releaseDate) : item.releaseYear

  return (
    <>
      <DetailShell
        item={item}
        coverShape="square"
        chips={[item.musicType ? getMusicTypeLabel(item.musicType) : null, item.consumed ? t('Listened') : t('Not listened'), item.releaseYear || (item.releaseDate ? item.releaseDate.slice(0, 4) : null)]}
        subtitle={item.alternativeTitles && item.alternativeTitles.length > 0 ? item.alternativeTitles.join(' · ') : undefined}
        meta={[item.artist, albumLike ? item.label : null].filter(Boolean).join(' · ') || undefined}
        stats={[
          [t('Rating'), item.rating ? <StarRatingDisplay value={item.rating} /> : null],
          [t('Tracks'), albumLike && item.tracks && item.tracks.length > 0 ? String(item.tracks.length) : null],
          [t('Length'), totalDuration],
          [t('Listened on'), albumLike && item.finishedAt ? formatIsoDate(item.finishedAt) : null],
        ]}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onExport={() => exportItemAsJson(item as unknown as Record<string, unknown>, item.title)}
        tabs={[
          {
            id: 'overview',
            label: t('Overview'),
            content: (
              <>
                <DetailFacts facts={[
                  [t('Artist'), item.artist],
                  [t('Label'), albumLike ? item.label : null],
                  [t('Produced by'), item.producers?.join(', ')],
                  [t('Released'), releaseLabel],
                  [t('Type'), item.musicType ? getMusicTypeLabel(item.musicType) : null],
                  [t('Source'), item.musicSource ? getMusicSourceLabel(item.musicSource) : null],
                  [t('Genres'), albumLike ? item.genres?.join(', ') : null],
                  [t('Vinyl condition'), item.vinylCondition ? getVinylConditionLabel(item.vinylCondition) : null],
                  [t('Part of'), !albumLike && (() => {
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
                      title={t('Open linked album')}
                    >{t('Part of: {title}', { title: linkedAlbum.title })}</button>
                  )
                }
                if (item.partOfAlbum) return <span className="pill static">{t('Part of: {partOfAlbum}', { partOfAlbum: item.partOfAlbum })}</span>
                return null
              })()],
                  [t('Groups'), groups.length > 0 ? groups.map((g) => g.name).join(', ') : null],
                ]} />
                {item.tags && item.tags.length > 0 && <DetailSection title={t('Tags')}><DetailChips values={item.tags} /></DetailSection>}
                <DetailReview review={item.musicReview} hasSpoilers={item.hasSpoilers} />
                <DetailNotes notes={item.notes} />
                <CustomFieldsView fields={item.customFields} />
              </>
            ),
          },
          {
            id: 'tracks',
            label: t('Tracklist'),
            count: item.tracks?.length,
            hidden: !albumLike || !item.tracks || item.tracks.length === 0,
            content: <>
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

        const renderRow = (tr: typeof item.tracks[0]) => (
          <tr key={tr.id}>
            <td className="col-fav">{tr.favorite && <span className="track-fav-star" aria-label={t('Favourite')}>★</span>}</td>
            <td className="col-num">{tr.number}</td>
            <td className="col-title">{tr.name}</td>
            <td className="col-artist">
              {(() => {
                const raw = tr.artist?.trim()
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
                // "Architects" doesn'tr sit next to another track with
                // "Architects · Jon Green" in a different style. Before,
                // the single-artist branch fell back to plain text.
                return (
                  <span className="track-artist-pills">
                    {parts.map((p, i) => <span key={i} className="track-artist-pill">{p}</span>)}
                  </span>
                )
              })()}
            </td>
            <td className="col-duration">{tr.duration}</td>
            <td className="col-rating">{tr.rating ? <StarRatingDisplay value={tr.rating} /> : null}</td>
            <td className="col-listened">{tr.listened ? '✓' : ''}</td>
            <td className="col-lyrics">
              <button type="button" className={tr.lyrics ? 'lyrics-btn has-lyrics' : 'lyrics-btn'} onClick={() => openLyrics(tr)}>
                {tr.lyrics ? t('View') : t('+ Add')}
              </button>
            </td>
          </tr>
        )

        return (
          <div className="field-group music-tracklist">
            <div className="tracklist-header-row">
              <label>{t('Tracklist')}</label>
              {totalDuration && <span className="tracklist-total">{t('Total: {totalDuration}', { totalDuration: totalDuration })}</span>}
            </div>
            {groups.map(({ disc, list }) => (
              <div key={disc || 'single'} className="track-disc-group">
                {isMultiDisc && <div className="track-disc-divider">{t('Disc {disc}', { disc: disc })}{' '}<span className="track-disc-count">· {plural(list.length, '{n} track', '{n} tracks')}</span></div>}
                <table className="track-table">
                  <thead>
                    <tr>
                      <th className="col-fav"></th>
                      <th className="col-num" style={{ width: numColumnWidth(list.map((t) => t.number)) }}>#</th>
                      <th className="col-title">{t('Title')}</th>
                      <th className="col-artist">{t('Artist')}</th>
                      <th className="col-duration">{t('Duration')}</th>
                      <th className="col-rating">{t('Rating')}</th>
                      <th className="col-listened">{t('Listened')}</th>
                      <th className="col-lyrics">{t('Lyrics')}</th>
                    </tr>
                  </thead>
                  <tbody>{list.map(renderRow)}</tbody>
                </table>
              </div>
            ))}
          </div>
        )
      })()}

            </>,
          },
          {
            id: 'editions',
            label: t('Editions'),
            count: editionCount,
            hidden: editionCount === 0,
            content: <>
      {albumLike && item.singleCovers && item.singleCovers.length > 0 && (
        <div className="field-group single-covers-gallery">
          <label>{t('Single covers')}</label>
          <div className="single-covers-grid">
            {item.singleCovers.map((s) => (
              <div key={s.id} className="single-cover-card">
                <img className="zoomable" src={assetSrc(s.cover)} alt={s.name} data-zoom-group={`music-singles-${item.id}`} data-zoom-label={s.name} data-zoom-caption={s.year ? String(s.year) : undefined} />
                <span>{s.name}{s.year ? ` ${t('({year})', { year: s.year })}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {albumLike && item.editions && item.editions.length > 0 && (
        <div className="field-group music-editions">
          <label>{t('Editions')}</label>
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

            </>,
          },
          {
            id: 'history',
            label: t('Listen history'),
            count: item.rewatches?.length,
            hidden: !item.rewatches || item.rewatches.length === 0,
            content: <DetailHistoryTable label={t('Listen history')} entries={item.rewatches ?? []} />,
          },
          {
            id: 'related',
            label: t('Related'),
            count: relatedCount,
            hidden: relatedCount === 0,
            content: (
              <>
                <DetailCoverStrip label={t('Related')} entries={relatedEntries} onNavigate={onNavigate} />
                <DetailCoverStrip label={t('Recommendations')} entries={recommendedEntries} onNavigate={onNavigate} />
              </>
            ),
          },
        ]}
      />
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
                placeholder={t('Paste or type the lyrics here…')}
                rows={16}
                autoFocus
              />
            ) : (
              <pre className="lyrics-view">{currentLyricsTrack.lyrics || t('No lyrics yet.')}</pre>
            )}
            <div className="modal-actions">
              {lyricsEditing ? (
                <>
                  <button className="ghost" onClick={() => { setLyricsEditing(false); setLyricsDraft(currentLyricsTrack.lyrics ?? '') }}>{t('Cancel')}</button>
                  <button className="danger-solid" onClick={() => { onSaveTrackLyrics(currentLyricsTrack.id, lyricsDraft); setLyricsEditing(false) }}>{t('Save lyrics')}</button>
                </>
              ) : (
                <>
                  <button className="ghost" onClick={() => setLyricsTrackId(null)}>{t('Close')}</button>
                  <button className="danger-solid" onClick={() => setLyricsEditing(true)}>{t('Edit')}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
