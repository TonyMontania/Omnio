import { formatDurationMinutes, getWatchLocationLabel, getMovieSourceLabel } from './types'
import type { Item, AnyItem, MovieItem, Collection, FranchiseSection, FranchiseGraph } from './types'
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
import { t } from './i18n'

interface Props {
  item: MovieItem
  groups: Collection[]
  allMovies: AnyItem[]
  // All items, not just Movies — cross-library adaptation links
  // (BasedOnDisplay) need to resolve targets in any category.
  allItems?: AnyItem[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
  onOpenCrossLibraryFranchise?: (franchise: string) => void
  franchiseSections?: FranchiseSection[]
  franchiseViewMode?: 'year' | 'sections' | 'graph'
  franchiseGraph?: FranchiseGraph
}

const yearOf = (i: Item) => i.releaseYear || ''

export default function MovieDetailModal({ item, groups, allMovies, allItems, onEdit, onDuplicate, onNavigate, onOpenCrossLibraryFranchise, franchiseSections, franchiseViewMode, franchiseGraph }: Props) {
  const banner = item.bannerImage2
  const franchiseItems = item.franchise
    ? allMovies.filter((a) => a.franchise === item.franchise).sort((a, b) => yearOf(a).localeCompare(yearOf(b)))
    : []
  const relatedEntries = (item.relatedItems ?? [])
    .map((r) => ({ ref: allMovies.find((a) => a.id === r.itemId), rel: r }))
    .filter((x) => x.ref)
    .map(({ ref, rel }) => ({ item: ref!, badge: rel.relation }))
  const recommendedEntries = (item.recommendedItems ?? [])
    .map((id) => allMovies.find((a) => a.id === id))
    .filter((x): x is Item => !!x)
    .map((it) => ({ item: it }))

  const relatedCount = relatedEntries.length + recommendedEntries.length + Math.max(0, franchiseItems.length - 1)
  const runtime = formatDurationMinutes(item.duration)

  return (
    <DetailShell
      item={item}
      banner={banner}
      chips={[item.consumed ? t('Watched') : t('Not watched'), item.releaseYear, item.contentRating]}
      subtitle={item.alternativeTitles && item.alternativeTitles.length > 0 ? item.alternativeTitles.join(' · ') : undefined}
      meta={item.directors && item.directors.length > 0 ? t('Directed by {directors}', { directors: item.directors.join(', ') }) : undefined}
      stats={[
        [t('Rating'), item.rating ? t('★ {rating}', { rating: item.rating }) : null],
        [t('Runtime'), runtime || null],
        [t('Times watched'), item.timesWatched ? t('{timesWatched}×', { timesWatched: item.timesWatched }) : null],
        [t('Watched on'), item.finishedAt ? formatDay(item.finishedAt) : null],
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
              {allItems && <BasedOnDisplay itemId={item.id} allItems={allItems} onNavigate={onNavigate} />}
              {item.movieDescription && <p className="detail-description">{item.movieDescription}</p>}
              <DetailFacts facts={[
                [t('Directors'), item.directors?.join(', ')],
                [t('Writers'), item.writers?.join(', ')],
                [t('Released'), item.releaseYear],
                [t('Genres'), item.genres?.join(', ')],
                [t('Franchise'), item.franchise],
                [t('Production'), item.productionCompanies?.join(', ')],
                [t('Distributed by'), item.distributors?.join(', ')],
                [t('Source'), item.movieSource ? getMovieSourceLabel(item.movieSource) : null],
                [t('Content rating'), item.contentRating],
                [t('Watched where'), item.watchedWhere ? getWatchLocationLabel(item.watchedWhere) : null],
                [t('Groups'), groups.length > 0 ? groups.map((g) => g.name).join(', ') : null],
              ]} />
              {item.cast && item.cast.length > 0 && <DetailSection title={t('Cast')}><DetailChips values={item.cast} /></DetailSection>}
              {item.tags && item.tags.length > 0 && <DetailSection title={t('Tags')}><DetailChips values={item.tags} /></DetailSection>}
              <DetailReview review={item.movieReview} hasSpoilers={item.hasSpoilers} />
              <DetailNotes notes={item.notes} />
              <CustomFieldsView fields={item.customFields} />
            </>
          ),
        },
        {
          id: 'history',
          label: t('Rewatches'),
          count: item.rewatches?.length,
          hidden: !item.rewatches || item.rewatches.length === 0,
          content: <DetailHistoryTable label={t('Rewatch history')} entries={item.rewatches ?? []} />,
        },
        {
          id: 'related',
          label: t('Related'),
          count: relatedCount,
          hidden: relatedCount === 0,
          content: (
            <>
              <DetailCoverStrip label={t('Related')} entries={relatedEntries} onNavigate={onNavigate} />
              <DetailFranchiseTimeline items={franchiseItems} currentId={item.id} franchise={item.franchise} yearOf={yearOf} onNavigate={onNavigate} onOpenCrossLibrary={onOpenCrossLibraryFranchise} sections={franchiseSections} viewMode={franchiseViewMode} graph={franchiseGraph} />
              <DetailCoverStrip label={t('Recommendations')} entries={recommendedEntries} onNavigate={onNavigate} />
            </>
          ),
        },
      ]}
    />
  )
}
