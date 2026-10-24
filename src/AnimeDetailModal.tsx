import type React from 'react'
import { getAnimeStatus, getAiringStatusLabel, getAnimeFormatLabel, getAnimeSeasonLabel, getDemographicLabel, getAnimeSourceLabel, getAgeRatingLabel, getTotalRuntimeMinutes, formatDurationMinutes, getNextUnwatchedEpisode } from './types'
import type { Item, AnyItem, AnimeItem, Collection, FranchiseSection, FranchiseGraph } from './types'
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

interface Props {
  item: AnimeItem
  groups: Collection[]
  allAnime: AnyItem[]
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

const timelineSortKey = (i: Item) => i.airedFrom || i.seasonYear || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

export default function AnimeDetailModal({ item, groups, allAnime, onEdit, onDuplicate, onNavigate, allItems, onOpenCrossLibraryFranchise, franchiseSections, franchiseViewMode, franchiseGraph }: Props) {
  const ws = getAnimeStatus(item.watchStatus)
  const totalRuntime = getTotalRuntimeMinutes(item.episodeDuration, item.totalEpisodes, item.episodesWatched)
  const airedRange = item.airedFrom || item.airedTo
    ? [item.airedFrom, item.airedTo].filter(Boolean).join(' → ')
    : null
  const nextEp = item.hasEpisodes ? getNextUnwatchedEpisode(item.episodes) : null
  const franchiseItems = item.franchise
    ? allAnime.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedEntries = (item.relatedItems ?? [])
    .map((r) => ({ ref: allAnime.find((a) => a.id === r.itemId), rel: r }))
    .filter((x) => x.ref)
    .map(({ ref, rel }) => ({ item: ref!, badge: rel.relation }))
  const recommendedEntries = (item.recommendedItems ?? [])
    .map((id) => allAnime.find((a) => a.id === id))
    .filter((x): x is Item => !!x)
    .map((it) => ({ item: it }))

  const relatedCount = relatedEntries.length + recommendedEntries.length + Math.max(0, franchiseItems.length - 1)
  const episodeCount = item.hasEpisodes ? item.episodes?.length ?? 0 : 0

  return (
    <DetailShell
      item={item}
      chips={[
        ws.label,
        item.airingStatus ? getAiringStatusLabel(item.airingStatus) : null,
        item.animeFormat ? getAnimeFormatLabel(item.animeFormat) : null,
        item.season ? `${getAnimeSeasonLabel(item.season)} ${item.seasonYear ?? ''}`.trim() : item.seasonYear,
      ]}
      subtitle={item.alternativeTitles && item.alternativeTitles.length > 0 ? item.alternativeTitles.join(' · ') : undefined}
      meta={item.studios && item.studios.length > 0 ? item.studios.join(', ') : undefined}
      stats={[
        ['Rating', item.rating ? `★ ${item.rating}` : null],
        ['Episodes', item.episodesWatched ? `${item.episodesWatched}${item.totalEpisodes ? ` / ${item.totalEpisodes}` : ''}` : item.totalEpisodes ? `${item.totalEpisodes} total` : null],
        ['Watch time', totalRuntime !== null ? formatDurationMinutes(String(totalRuntime)) : null],
        ['Next episode', nextEp ? `Ep. ${nextEp.number}` : null],
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
              {item.animeDescription && <p className="detail-description">{item.animeDescription}</p>}
              <DetailFacts facts={[
                ['Studios', item.studios?.join(', ')],
                ['Aired', airedRange],
                ['Season', item.season ? `${getAnimeSeasonLabel(item.season)} ${item.seasonYear ?? ''}` : item.seasonYear],
                ['Format', item.animeFormat ? getAnimeFormatLabel(item.animeFormat) : null],
                ['Airing', item.airingStatus ? getAiringStatusLabel(item.airingStatus) : null],
                ['Episode length', item.episodeDuration ? `${item.episodeDuration} min` : null],
                ['Genres', item.genres?.join(', ')],
                ['Demographic', item.demographic ? getDemographicLabel(item.demographic) : null],
                ['Source', item.animeSource ? getAnimeSourceLabel(item.animeSource) : null],
                ['Age rating', item.ageRating ? getAgeRatingLabel(item.ageRating) : null],
                ['Started', item.startDate ? formatDay(item.startDate) : null],
                ['Next episode', nextEp ? `Ep. ${nextEp.number}${nextEp.title ? ` — ${nextEp.title}` : ''}` : null],
                ['Favorite episode', item.favoriteEpisode ? `#${item.favoriteEpisode}${item.favoriteEpisodeNote ? ` — ${item.favoriteEpisodeNote}` : ''}` : null],
                ['Dropped at', item.watchStatus === 'dropped' && (item.droppedAtEpisode || item.droppedReason) ? [item.droppedAtEpisode ? `Ep. ${item.droppedAtEpisode}` : '', item.droppedReason ?? ''].filter(Boolean).join(' — ') : null],
                ['Groups', groups.length > 0 ? groups.map((g) => g.name).join(', ') : null],
              ]} />
              {item.tags && item.tags.length > 0 && <DetailSection title="Tags"><DetailChips values={item.tags} /></DetailSection>}
              <DetailReview review={item.animeReview} hasSpoilers={item.hasSpoilers} />
              <DetailNotes notes={item.notes} />
              <CustomFieldsView fields={item.customFields} />
            </>
          ),
        },
        {
          id: 'episodes',
          label: 'Episodes',
          count: episodeCount,
          hidden: episodeCount === 0,
          content: <>
          {item.hasEpisodes && item.episodes && item.episodes.length > 0 && (() => {
            // Sprint I — visually group by AniDB prefix (S / C / T / P
            // / O) in the read-only view so a list with specials and
            // credits doesn't read as a single 40-row wall.
            const groupFor = (number: string): string | undefined => {
              const first = number.charAt(0).toUpperCase()
              switch (first) {
                case 'S': return 'Specials / OVAs'
                case 'C': return 'Openings & Endings'
                case 'T': return 'Trailers / PVs'
                case 'P': return 'Parodies'
                case 'O': return 'Other'
                default: return undefined
              }
            }
            const tooltipFor = (number: string): string | undefined => {
              const first = number.charAt(0).toUpperCase()
              switch (first) {
                case 'S': return 'Special / OVA'
                case 'C': return 'Credits (opening / ending)'
                case 'T': return 'Trailer / PV'
                case 'P': return 'Parody'
                case 'O': return 'Other'
                default: return undefined
              }
            }
            const hasPrefixes = item.episodes.some((e) => /^[a-z]/i.test(e.number))
            // Sprint I — only render the AniDB metadata columns when
            // at least one episode has data for them, so a hand-added
            // list without dates doesn't grow two empty columns.
            const hasAirdate = item.episodes.some((e) => e.airdate)
            const hasLength = item.episodes.some((e) => e.length)
            const cols = 6 + (hasAirdate ? 1 : 0) + (hasLength ? 1 : 0)
            const rows: React.ReactNode[] = []
            let lastGroup: string | undefined | null = null
            for (const ep of item.episodes) {
              const g = groupFor(ep.number)
              if (g && g !== lastGroup) {
                rows.push(
                  <tr key={`__g-${g}-${ep.id}`} className="track-group-row">
                    <td colSpan={cols}>{g}</td>
                  </tr>
                )
                lastGroup = g
              } else if (!g) {
                lastGroup = null
              }
              rows.push(
                <tr key={ep.id} className={ep.watched ? 'ep-watched' : ''}>
                  <td className="col-num" title={tooltipFor(ep.number)}>{ep.number}</td>
                  <td className="col-title">{ep.title ?? '—'}</td>
                  {hasAirdate && <td className="col-airdate">{ep.airdate ?? ''}</td>}
                  {hasLength && <td className="col-length">{ep.length ? `${ep.length}m` : ''}</td>}
                  <td className="col-listened">{ep.watched ? '✓' : ''}</td>
                  <td className="col-rating">{ep.rating ? `★ ${ep.rating}` : ''}</td>
                  <td className="col-fav">{ep.filler ? 'F' : ''}</td>
                  <td className="col-spacer"></td>
                </tr>
              )
            }
            return (
              <div className="field-group">
                <label>Episodes</label>
                {hasPrefixes && (
                  <div className="episode-number-legend">
                    <span>Number prefix legend (AniDB):</span>
                    <code>1, 2, 3…</code> regular ·
                    <code>S</code> special / OVA ·
                    <code>C</code> credits (opening/ending) ·
                    <code>T</code> trailer / PV ·
                    <code>P</code> parody ·
                    <code>O</code> other
                  </div>
                )}
                <table className="track-table episode-table">
                  <thead>
                    <tr>
                      <th className="col-num" style={{ width: numColumnWidth((item.episodes ?? []).map((ep) => ep.number)) }}>#</th>
                      <th className="col-title">Title</th>
                      {hasAirdate && <th className="col-airdate">Air date</th>}
                      {hasLength && <th className="col-length">Length</th>}
                      <th className="col-listened">✓</th>
                      <th className="col-rating">Rating</th>
                      <th className="col-fav">Filler</th>
                      <th className="col-spacer"></th>
                    </tr>
                  </thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
            )
          })()}

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
