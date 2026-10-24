import { useState } from 'react'
import { getSeriesStatus, getSeriesFormatLabel, getSeasonWatchedCount, getSeasonTotalEpisodes } from './types'
import type { Item, AnyItem, SeriesItem, Collection, FranchiseSection, FranchiseGraph } from './types'
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
import { numColumnWidth } from './utils/numColumn'

const timelineSortKey = (i: Item) => i.airedFrom || i.startYear || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

interface Props {
  item: SeriesItem
  groups: Collection[]
  allSeries: AnyItem[]
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

export default function SeriesDetailModal({ item, groups, allSeries, onEdit, onDuplicate, onNavigate, allItems, onOpenCrossLibraryFranchise, franchiseSections, franchiseViewMode, franchiseGraph }: Props) {
  const [openSeason, setOpenSeason] = useState<string | null>(null)
  const ss = getSeriesStatus(item.seriesStatus)
  const franchiseItems = item.franchise
    ? allSeries.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedEntries = (item.relatedItems ?? [])
    .map((r) => ({ ref: allSeries.find((a) => a.id === r.itemId), rel: r }))
    .filter((x) => x.ref)
    .map(({ ref, rel }) => ({ item: ref!, badge: rel.relation }))
  const recommendedEntries = (item.recommendedItems ?? [])
    .map((id) => allSeries.find((a) => a.id === id))
    .filter((x): x is Item => !!x)
    .map((it) => ({ item: it }))
  const yearsRange = item.startYear || item.endYear
    ? [item.startYear, item.endYear].filter(Boolean).join(' – ')
    : null

  const relatedCount = relatedEntries.length + recommendedEntries.length + Math.max(0, franchiseItems.length - 1)
  const seasonCount = item.hasSeasons ? item.seasons?.length ?? 0 : 0
  const credits = [item.showrunners?.join(', '), item.network].filter(Boolean).join(' · ')

  return (
    <DetailShell
      item={item}
      chips={[ss.label, item.seriesFormat ? getSeriesFormatLabel(item.seriesFormat) : null, yearsRange, item.contentRating]}
      subtitle={item.alternativeTitles && item.alternativeTitles.length > 0 ? item.alternativeTitles.join(' · ') : undefined}
      meta={credits || undefined}
      stats={[
        ['Rating', item.rating ? `★ ${item.rating}` : null],
        ['Episodes', item.episodesWatched ? `${item.episodesWatched}${item.totalEpisodes ? ` / ${item.totalEpisodes}` : ''}` : item.totalEpisodes ? `${item.totalEpisodes} total` : null],
        ['Seasons', item.unitCount || (seasonCount ? String(seasonCount) : null)],
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
              {item.seriesDescription && <p className="detail-description">{item.seriesDescription}</p>}
              <DetailFacts facts={[
                ['Network', item.network],
                ['Years', yearsRange],
                ['Format', item.seriesFormat ? getSeriesFormatLabel(item.seriesFormat) : null],
                ['Showrunners', item.showrunners?.join(', ')],
                ['Directors', item.directors?.join(', ')],
                ['Writers', item.writers?.join(', ')],
                ['Genres', item.genres?.join(', ')],
                ['Country', item.country],
                ['Language', item.language],
                ['Content rating', item.contentRating],
                ['Started', item.startDate ? formatDay(item.startDate) : null],
                ['Groups', groups.length > 0 ? groups.map((g) => g.name).join(', ') : null],
              ]} />
              {item.cast && item.cast.length > 0 && <DetailSection title="Cast"><DetailChips values={item.cast} /></DetailSection>}
              {item.tags && item.tags.length > 0 && <DetailSection title="Tags"><DetailChips values={item.tags} /></DetailSection>}
              <DetailReview review={item.seriesReview} hasSpoilers={item.hasSpoilers} />
              <DetailNotes notes={item.notes} />
              <CustomFieldsView fields={item.customFields} />
            </>
          ),
        },
        {
          id: 'seasons',
          label: 'Seasons',
          count: seasonCount,
          hidden: seasonCount === 0,
          content: <>
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
                              <th className="col-num" style={{ width: numColumnWidth((s.episodes ?? []).map((ep) => ep.number)) }}>#</th>
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

          </>,
        },
        {
          id: 'history',
          label: 'Rewatches',
          count: item.rewatches?.length,
          hidden: !item.rewatches || item.rewatches.length === 0,
          content: <DetailHistoryTable label="Rewatch history" entries={item.rewatches ?? []} />,
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
