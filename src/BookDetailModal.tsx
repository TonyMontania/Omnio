import { getBookStatus, getBookFormatLabel, getBookSourceLabel, getPublicationStatusLabel, getAgeRatingLabel, assetSrc } from './types'
import { MangaStatusIcon } from './icons'  // Book status uses the same visual language as Manga (plan/reading/completed/paused/dropped).
import type { Item, Collection, MangaStatus } from './types'
import DetailTopbar from './components/detail/DetailTopbar'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailFranchiseTimeline from './components/detail/DetailFranchiseTimeline'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import DetailNotes from './components/detail/DetailNotes'

const timelineSortKey = (i: Item) => i.releaseDate || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

interface Props {
  item: Item
  groups: Collection[]
  allBooks: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
}

export default function BookDetailModal({ item, groups, allBooks, onClose, onEdit, onDuplicate, onNavigate }: Props) {
  const bs = getBookStatus(item.bookStatus)
  // Same franchise/related/recommended shape as every other detail view —
  // Books share the code path so behaviour is identical.
  const franchiseItems = item.franchise
    ? allBooks.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedEntries = (item.relatedItems ?? [])
    .map((r) => ({ ref: allBooks.find((a) => a.id === r.itemId), rel: r }))
    .filter((x) => x.ref)
    .map(({ ref, rel }) => ({ item: ref!, badge: rel.relation }))
  const recommendedEntries = (item.recommendedItems ?? [])
    .map((id) => allBooks.find((a) => a.id === id))
    .filter((x): x is Item => !!x)
    .map((it) => ({ item: it }))

  return (
    <div className="game-page">
      <DetailTopbar onBack={onClose} onDuplicate={onDuplicate} onEdit={onEdit} />

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
            {item.authors && item.authors.length > 0 && (
              <p className="game-modal-devs">{item.authors.join(', ')}</p>
            )}
            {item.description && <div className="game-modal-description">{item.description}</div>}
            <div className="dlc-addons-row">
              <div className="field-group">
                <label>Status</label>
                <div className="pills">
                  <span className={`badge status-badge status-${bs.value}`}><MangaStatusIcon value={bs.value as MangaStatus} /> {bs.label}</span>
                  {item.pubStatus && <span className="badge group-badge">{getPublicationStatusLabel(item.pubStatus)}</span>}
                  {item.bookFormat && <span className="pill static">{getBookFormatLabel(item.bookFormat)}</span>}
                  {item.bookSource && <span className="pill static">Source: {getBookSourceLabel(item.bookSource)}</span>}
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
          <div className="dlc-addons-row wrap-4">
            {item.pagesRead && (
              <div className="field-group">
                <label>Pages</label>
                <div className="pills"><span className="pill static">{item.pagesRead}{item.totalPages ? ` / ${item.totalPages}` : ''}</span></div>
              </div>
            )}
            {item.publisher && (
              <div className="field-group">
                <label>Publisher</label>
                <div className="pills"><span className="pill static">{item.publisher}</span></div>
              </div>
            )}
            {item.saga && (
              <div className="field-group">
                <label>Series</label>
                <div className="pills"><span className="pill static">{item.saga}{item.sagaIndex ? ` · ${item.sagaIndex}` : ''}</span></div>
              </div>
            )}
            {item.isbn && (
              <div className="field-group">
                <label>ISBN</label>
                <div className="pills"><span className="pill static">{item.isbn}</span></div>
              </div>
            )}
            {item.translator && (
              <div className="field-group">
                <label>Translator</label>
                <div className="pills"><span className="pill static">{item.translator}</span></div>
              </div>
            )}
            {item.rating ? (
              <div className="field-group">
                <label>Rating</label>
                <div className="pills"><span className="pill static">★ {item.rating}</span></div>
              </div>
            ) : null}
            {item.releaseDate && (
              <div className="field-group">
                <label>Published</label>
                <div className="pills"><span className="pill static">{item.releaseDate}</span></div>
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

          <DetailReview review={item.bookReview} hasSpoilers={item.hasSpoilers} />
          <DetailNotes notes={item.notes} />
          <DetailHistoryTable label="Reread history" entries={item.rewatches ?? []} />
          <DetailCoverStrip label="Related" entries={relatedEntries} onNavigate={onNavigate} />
          <DetailFranchiseTimeline items={franchiseItems} currentId={item.id} franchise={item.franchise} yearOf={yearOf} onNavigate={onNavigate} />
          <DetailCoverStrip label="Recommendations" entries={recommendedEntries} onNavigate={onNavigate} />
          <CustomFieldsView fields={item.customFields} />
        </div>
      </div>
    </div>
  )
}
