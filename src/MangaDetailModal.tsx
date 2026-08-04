import { useState } from 'react'
import { getMangaStatus, getPublicationStatusLabel, getMangaSourceLabel, getAgeRatingLabel, getNextUnreadChapter, assetSrc } from './types'
import { MangaStatusIcon } from './icons'
import type { Item, Collection } from './types'
import DetailTopbar from './components/detail/DetailTopbar'
import ImageLightbox from './components/ImageLightbox'
import { exportItemAsJson } from './utils/files'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailFranchiseTimeline from './components/detail/DetailFranchiseTimeline'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import DetailNotes from './components/detail/DetailNotes'

const timelineSortKey = (i: Item) => i.startDate || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

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
  const [volumeLightbox, setVolumeLightbox] = useState<number | null>(null)
  const ms = getMangaStatus(item.mangaStatus)
  const nextCh = item.hasChapters ? getNextUnreadChapter(item.chapters) : null
  const franchiseItems = item.franchise
    ? allManga.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedEntries = (item.relatedItems ?? [])
    .map((r) => ({ ref: allManga.find((a) => a.id === r.itemId), rel: r }))
    .filter((x) => x.ref)
    .map(({ ref, rel }) => ({ item: ref!, badge: rel.relation }))
  const recommendedEntries = (item.recommendedItems ?? [])
    .map((id) => allManga.find((a) => a.id === id))
    .filter((x): x is Item => !!x)
    .map((it) => ({ item: it }))

  return (
    <div className="game-page">
      <DetailTopbar onBack={onClose} onDuplicate={onDuplicate} onEdit={onEdit} onExport={() => exportItemAsJson(item as unknown as Record<string, unknown>, item.title)} />

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
                  {item.mediaOwnership && <span className="pill static">{item.mediaOwnership === 'physical' ? 'Physical' : item.mediaOwnership === 'digital' ? 'Digital' : item.mediaOwnership === 'both' ? 'Physical + Digital' : 'Not owned'}</span>}
                  {item.mangadexId && (
                    <a
                      className="pill static pcgw-link"
                      href={`https://mangadex.org/title/${item.mangadexId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Follow this title on MangaDex to get chapter notifications in your reader"
                    >New chapters ↗</a>
                  )}
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

          <DetailReview review={item.mangaReview} hasSpoilers={item.hasSpoilers} />
          <DetailNotes notes={item.notes} />
          <DetailHistoryTable label="Reread history" entries={item.rewatches ?? []} />
          <DetailCoverStrip label="Related" entries={relatedEntries} onNavigate={onNavigate} />
          <DetailFranchiseTimeline items={franchiseItems} currentId={item.id} franchise={item.franchise} yearOf={yearOf} onNavigate={onNavigate} />
          <DetailCoverStrip label="Recommendations" entries={recommendedEntries} onNavigate={onNavigate} />
          <CustomFieldsView fields={item.customFields} />

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
            {item.volumeCovers.map((v, i) => (
              <div key={v.id} className="volume-card">
                <span className="volume-label">Volume {v.number}</span>
                <img
                  src={assetSrc(v.cover)}
                  alt={`Volume ${v.number}`}
                  onClick={() => setVolumeLightbox(i)}
                  title="Click to view full size"
                  style={{ cursor: 'zoom-in' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {volumeLightbox !== null && item.volumeCovers && (
        <ImageLightbox
          images={item.volumeCovers.map((v) => ({ src: v.cover, label: `Vol. ${v.number}` }))}
          index={volumeLightbox}
          onIndex={setVolumeLightbox}
          onClose={() => setVolumeLightbox(null)}
        />
      )}
    </div>
  )
}
