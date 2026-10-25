import { useState } from 'react'
import { getMangaStatus, getPublicationStatusLabel, getMangaSourceLabel, getAgeRatingLabel, getNextUnreadChapter, assetSrc } from './types'
import type { Item, AnyItem, MangaItem, Collection, FranchiseSection, FranchiseGraph } from './types'
import DetailShell, { DetailChips, DetailFacts, DetailSection } from './components/detail/DetailShell'
import { formatDay } from './utils/format'
import ImageLightbox from './components/ImageLightbox'
import { exportItemAsJson } from './utils/files'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailFranchiseTimeline from './components/detail/DetailFranchiseTimeline'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import { BasedOnDisplay } from './components/BasedOn'
import DetailNotes from './components/detail/DetailNotes'
import { numColumnWidth } from './utils/numColumn'
import { t } from './i18n'

const timelineSortKey = (i: Item) => i.startDate || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

interface Props {
  item: MangaItem
  groups: Collection[]
  allManga: AnyItem[]
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

export default function MangaDetailModal({ item, groups, allManga, onEdit, onDuplicate, onNavigate, allItems, onOpenCrossLibraryFranchise, franchiseSections, franchiseViewMode, franchiseGraph }: Props) {
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

  const relatedCount = relatedEntries.length + recommendedEntries.length + Math.max(0, franchiseItems.length - 1)
  const chapterCount = item.hasChapters ? item.chapters?.length ?? 0 : 0
  const volumeCount = item.volumeCovers?.length ?? 0
  const ownership = item.mediaOwnership
    ? item.mediaOwnership === 'physical' ? t('Physical') : item.mediaOwnership === 'digital' ? t('Digital') : item.mediaOwnership === 'both' ? t('Physical + Digital') : t('Not owned')
    : null

  return (
    <DetailShell
      item={item}
      chips={[ms.label, item.pubStatus ? getPublicationStatusLabel(item.pubStatus) : null, item.magazine]}
      subtitle={item.alternativeTitles && item.alternativeTitles.length > 0 ? item.alternativeTitles.join(' · ') : undefined}
      meta={[item.authors?.join(', '), item.mangaArtists?.join(', ')].filter(Boolean).join(' · ') || undefined}
      stats={[
        [t('Rating'), item.rating ? t('★ {rating}', { rating: item.rating }) : null],
        [t('Chapters'), item.chaptersRead ? t('{chaptersRead}{value}', { chaptersRead: item.chaptersRead, value: item.totalChapters ? ` ${t('/ {totalChapters}', { totalChapters: item.totalChapters })}` : '' }) : item.totalChapters ? t('{totalChapters} total', { totalChapters: item.totalChapters }) : null],
        [t('Volumes'), item.volumesRead ? t('{volumesRead}{value}', { volumesRead: item.volumesRead, value: item.totalVolumes ? ` ${t('/ {totalVolumes}', { totalVolumes: item.totalVolumes })}` : '' }) : null],
        [t('Next chapter'), nextCh ? t('Ch. {number}', { number: nextCh.number }) : null],
        [t('Finished'), item.finishedAt ? formatDay(item.finishedAt) : null],
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
              {item.mangaDescription && <p className="detail-description">{item.mangaDescription}</p>}
              {item.mangadexId && (
                <a className="pill static pcgw-link" style={{ alignSelf: 'flex-start' }} href={`https://mangadex.org/title/${item.mangadexId}`} target="_blank" rel="noopener noreferrer" title={t('Follow this title on MangaDex to get chapter notifications in your reader')}>{t('New chapters on MangaDex ↗')}</a>
              )}
              <DetailFacts facts={[
                [t('Authors'), item.authors?.join(', ')],
                [t('Artists'), item.mangaArtists?.join(', ')],
                [t('Magazine'), item.magazine],
                [t('Publication'), item.pubStatus ? getPublicationStatusLabel(item.pubStatus) : null],
                [t('Genres'), item.genres?.join(', ')],
                [t('Source'), item.mangaSource ? getMangaSourceLabel(item.mangaSource) : null],
                [t('Age rating'), item.ageRating ? getAgeRatingLabel(item.ageRating) : null],
                [t('Owned as'), ownership],
                [t('Started'), item.startDate ? formatDay(item.startDate) : null],
                [t('Next chapter'), nextCh ? t('Ch. {number}{value}', { number: nextCh.number, value: nextCh.title ? ` ${t('— {title}', { title: nextCh.title })}` : '' }) : null],
                [t('Groups'), groups.length > 0 ? groups.map((g) => g.name).join(', ') : null],
              ]} />
              {item.tags && item.tags.length > 0 && <DetailSection title={t('Tags')}><DetailChips values={item.tags} /></DetailSection>}
              <DetailReview review={item.mangaReview} hasSpoilers={item.hasSpoilers} />
              <DetailNotes notes={item.notes} />
              <CustomFieldsView fields={item.customFields} />
            </>
          ),
        },
        {
          id: 'chapters',
          label: t('Chapters'),
          count: chapterCount,
          hidden: chapterCount === 0,
          content: <>
          {item.hasChapters && item.chapters && item.chapters.length > 0 && (
            <div className="field-group">
              <label>{t('Chapters')}</label>
              <table className="track-table episode-table">
                <thead>
                  <tr>
                    <th className="col-num" style={{ width: numColumnWidth((item.chapters ?? []).map((c) => c.number)) }}>#</th>
                    <th className="col-title">{t('Title')}</th>
                    <th className="col-listened">✓</th>
                    <th className="col-rating">{t('Rating')}</th>
                    <th className="col-spacer"></th>
                  </tr>
                </thead>
                <tbody>
                  {item.chapters.map((c) => (
                    <tr key={c.id} className={c.read ? 'ep-watched' : ''}>
                      <td className="col-num">{c.number}</td>
                      <td className="col-title">{c.title ?? '—'}</td>
                      <td className="col-listened">{c.read ? '✓' : ''}</td>
                      <td className="col-rating">{c.rating ? t('★ {rating}', { rating: c.rating }) : ''}</td>
                      <td className="col-spacer"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>,
        },
        {
          id: 'volumes',
          label: t('Volumes'),
          count: volumeCount,
          hidden: volumeCount === 0,
          content: <>
      {item.volumeCovers && item.volumeCovers.length > 0 && (
        <div className="field-group volume-gallery">
          <label>{t('Volumes')}</label>
          <div className="volume-grid">
            {item.volumeCovers.map((v, i) => (
              <div key={v.id} className="volume-card">
                <span className="volume-label">{t('Volume {number}', { number: v.number })}</span>
                <img
                  src={assetSrc(v.cover)}
                  alt={t('Volume {number}', { number: v.number })}
                  onClick={() => setVolumeLightbox(i)}
                  title={t('Click to view full size')}
                  style={{ cursor: 'zoom-in' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {volumeLightbox !== null && item.volumeCovers && (
        <ImageLightbox
          images={item.volumeCovers.map((v) => ({ src: v.cover, label: t('Vol. {number}', { number: v.number }) }))}
          index={volumeLightbox}
          onIndex={setVolumeLightbox}
          onClose={() => setVolumeLightbox(null)}
        />
      )}
          </>,
        },
        {
          id: 'history',
          label: t('Rereads'),
          count: item.rewatches?.length,
          hidden: !item.rewatches || item.rewatches.length === 0,
          content: <DetailHistoryTable label={t('Reread history')} entries={item.rewatches ?? []} />,
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
