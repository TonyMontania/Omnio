import { getBookStatus, getBookFormatLabel, getBookSourceLabel, getPublicationStatusLabel, getAgeRatingLabel } from './types'
import type { Item, AnyItem, Collection, BookItem, FranchiseSection, FranchiseGraph } from './types'
import DetailShell, { DetailChips, DetailFacts, DetailSection } from './components/detail/DetailShell'
import { formatDay } from './utils/format'
import { exportItemAsJson } from './utils/files'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailFranchiseTimeline from './components/detail/DetailFranchiseTimeline'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import { BasedOnDisplay } from './components/BasedOn'
import DetailNotes from './components/detail/DetailNotes'

const timelineSortKey = (i: Item) => i.releaseDate || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

interface Props {
  item: BookItem
  groups: Collection[]
  allBooks: AnyItem[]     // sibling lookup still uses the bag — franchise / related pull from every category
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
  allItems?: AnyItem[]
  onOpenCrossLibraryFranchise?: (franchise: string) => void
  franchiseSections?: FranchiseSection[]
  franchiseViewMode?: 'year' | 'sections' | 'graph'
  franchiseGraph?: FranchiseGraph
}

export default function BookDetailModal({ item, groups, allBooks, onEdit, onDuplicate, onNavigate, allItems, onOpenCrossLibraryFranchise, franchiseSections, franchiseViewMode, franchiseGraph }: Props) {
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

  const relatedCount = relatedEntries.length + recommendedEntries.length + Math.max(0, franchiseItems.length - 1)
  const noteCount = (item.chapterNotes?.length ?? 0) + (item.highlights?.length ?? 0)

  return (
    <DetailShell
      item={item}
      chips={[bs.label, item.bookFormat ? getBookFormatLabel(item.bookFormat) : null, item.pubStatus ? getPublicationStatusLabel(item.pubStatus) : null]}
      subtitle={item.alternativeTitles && item.alternativeTitles.length > 0 ? item.alternativeTitles.join(' · ') : undefined}
      meta={item.authors && item.authors.length > 0 ? item.authors.join(', ') : undefined}
      stats={[
        ['Rating', item.rating ? `★ ${item.rating}` : null],
        ['Pages', item.pagesRead ? `${item.pagesRead}${item.totalPages ? ` / ${item.totalPages}` : ''}` : item.totalPages ? `${item.totalPages} total` : null],
        ['Series', item.saga ? `${item.saga}${item.sagaIndex ? ` #${item.sagaIndex}` : ''}` : null],
        ['Finished', item.finishedAt ? formatDay(item.finishedAt) : null],
      ]}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      onExport={() => exportItemAsJson(item as unknown as Record<string, unknown>, item.title)}
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <>
              {allItems && <BasedOnDisplay itemId={item.id} allItems={allItems} onNavigate={onNavigate} />}
              {item.description && <p className="detail-description">{item.description}</p>}
              <DetailFacts facts={[
                ['Authors', item.authors?.join(', ')],
                ['Publisher', item.publisher],
                ['Published', item.releaseDate ? formatDay(item.releaseDate) : item.releaseYear],
                ['Series', item.saga ? `${item.saga}${item.sagaIndex ? ` · ${item.sagaIndex}` : ''}` : null],
                ['Translator', item.translator],
                ['ISBN', item.isbn],
                ['Format', item.bookFormat ? getBookFormatLabel(item.bookFormat) : null],
                ['Genres', item.genres?.join(', ')],
                ['Source', item.bookSource ? getBookSourceLabel(item.bookSource) : null],
                ['Age rating', item.ageRating ? getAgeRatingLabel(item.ageRating) : null],
                ['Started', item.startDate ? formatDay(item.startDate) : null],
                ['Groups', groups.length > 0 ? groups.map((g) => g.name).join(', ') : null],
              ]} />
              {item.tags && item.tags.length > 0 && <DetailSection title="Tags"><DetailChips values={item.tags} /></DetailSection>}
              <DetailReview review={item.bookReview} hasSpoilers={item.hasSpoilers} />
              <DetailNotes notes={item.notes} />
              <CustomFieldsView fields={item.customFields} />
            </>
          ),
        },
        {
          id: 'highlights',
          label: 'Highlights',
          count: noteCount,
          hidden: noteCount === 0,
          content: <>
          {item.chapterNotes && item.chapterNotes.length > 0 && (
            <div className="field-group">
              <label>Notes per chapter ({item.chapterNotes.length})</label>
              <ul className="chapter-notes-list detail">
                {item.chapterNotes.map((n) => (
                  <li key={n.id} className="chapter-notes-row">
                    <span className="chapter-notes-chapter-static">{n.chapter}</span>
                    <p className="chapter-notes-body-static">{n.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.highlights && item.highlights.length > 0 && (
            <div className="field-group">
              <label>Highlights &amp; notes ({item.highlights.length})</label>
              <ul className="highlights-list">
                {item.highlights.map((h) => (
                  <li key={h.id} className="highlights-row">
                    {h.text && <blockquote className="highlights-text">{h.text}</blockquote>}
                    {h.note && <p className="highlights-note"><span className="highlights-note-label">Note</span> {h.note}</p>}
                    <div className="highlights-meta">
                      {h.page && <span>Page {h.page}</span>}
                      {h.location && <span>Loc {h.location}</span>}
                      {h.addedAt && <span>{h.addedAt}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          </>,
        },
        {
          id: 'history',
          label: 'Rereads',
          count: item.rewatches?.length,
          hidden: !item.rewatches || item.rewatches.length === 0,
          content: <DetailHistoryTable label="Reread history" entries={item.rewatches ?? []} />,
        },
        {
          id: 'related',
          label: 'Related',
          count: relatedCount,
          hidden: relatedCount === 0,
          content: (
            <>
              <DetailCoverStrip label="Related" entries={relatedEntries} onNavigate={onNavigate} />
              <DetailFranchiseTimeline items={franchiseItems} currentId={item.id} franchise={item.franchise} yearOf={yearOf} onNavigate={onNavigate} onOpenCrossLibrary={onOpenCrossLibraryFranchise} sections={franchiseSections} viewMode={franchiseViewMode} graph={franchiseGraph} />
              <DetailCoverStrip label="Recommendations" entries={recommendedEntries} onNavigate={onNavigate} />
            </>
          ),
        },
      ]}
    />
  )
}
