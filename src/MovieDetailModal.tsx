import { formatDurationMinutes, getWatchLocationLabel, getMovieSourceLabel, assetSrc } from './types'
import type { Item, Collection } from './types'
import DetailTopbar from './components/detail/DetailTopbar'
import { exportItemAsJson } from './utils/files'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailFranchiseTimeline from './components/detail/DetailFranchiseTimeline'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import DetailNotes from './components/detail/DetailNotes'

interface Props {
  item: Item
  groups: Collection[]
  allMovies: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
}

const yearOf = (i: Item) => i.releaseYear || ''

export default function MovieDetailModal({ item, groups, allMovies, onClose, onEdit, onDuplicate, onNavigate }: Props) {
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

  return (
    <div className="game-page">
      <DetailTopbar onBack={onClose} onDuplicate={onDuplicate} onEdit={onEdit} onExport={() => exportItemAsJson(item as unknown as Record<string, unknown>, item.title)} />

      {banner && (
        <div className="game-modal-banner">
          <img src={assetSrc(banner)} alt="" />
          <div className="banner-fade" />
        </div>
      )}

      <div className="game-modal-body" style={banner ? { marginTop: 110 } : undefined}>
        <div className="game-modal-main">
          <div className="game-modal-cover">
            {item.cover ? <img src={assetSrc(item.cover)} alt="" /> : <div className="cover-preview-placeholder">No cover</div>}
          </div>
          <div className="game-modal-info">
            <div className="game-modal-title-row">
              <h1>{item.title} {item.releaseYear && <span className="game-modal-year">({item.releaseYear})</span>}</h1>
            </div>
            {item.alternativeTitles && item.alternativeTitles.length > 0 && (
              <p className="game-modal-alt-titles">{item.alternativeTitles.join(' · ')}</p>
            )}
            {item.directors && item.directors.length > 0 && (
              <p className="game-modal-devs">{item.directors.join(', ')}</p>
            )}
            {item.writers && item.writers.length > 0 && (
              <p className="game-modal-devs">Written by {item.writers.join(', ')}</p>
            )}
            {item.cast && item.cast.length > 0 && (
              <p className="game-modal-devs">Starring: {item.cast.join(', ')}</p>
            )}
            {item.movieDescription && <div className="game-modal-description">{item.movieDescription}</div>}
            <div className="dlc-addons-row">
              <div className="field-group">
                <label>Status</label>
                <div className="pills">
                  <span className="pill static">{item.consumed ? '✓ Watched' : 'Not watched'}</span>
                  {item.movieSource && <span className="pill static">Source: {getMovieSourceLabel(item.movieSource)}</span>}
                  {item.contentRating && <span className="pill static">{item.contentRating}</span>}
                </div>
              </div>
              {item.franchise && (
                <div className="field-group">
                  <label>Franchise</label>
                  <div className="pills"><span className="pill static">{item.franchise}</span></div>
                </div>
              )}
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
            {formatDurationMinutes(item.duration) && (
              <div className="field-group">
                <label>Duration</label>
                <div className="pills"><span className="pill static">{formatDurationMinutes(item.duration)}</span></div>
              </div>
            )}
            {item.timesWatched && (
              <div className="field-group">
                <label>Times watched</label>
                <div className="pills"><span className="pill static">{item.timesWatched}×</span></div>
              </div>
            )}
            {item.rating ? (
              <div className="field-group">
                <label>Rating</label>
                <div className="pills"><span className="pill static">★ {item.rating}</span></div>
              </div>
            ) : null}
            {item.finishedAt && (
              <div className="field-group">
                <label>Watched on</label>
                <div className="pills"><span className="pill static">{item.finishedAt}</span></div>
              </div>
            )}
            {item.watchedWhere && (
              <div className="field-group">
                <label>Watched where</label>
                <div className="pills"><span className="pill static">{getWatchLocationLabel(item.watchedWhere)}</span></div>
              </div>
            )}
          </div>

          {item.productionCompanies && item.productionCompanies.length > 0 && (
            <div className="field-group">
              <label>Production companies</label>
              <div className="pills">{item.productionCompanies.map((c) => <span key={c} className="pill static">{c}</span>)}</div>
            </div>
          )}
          {item.distributors && item.distributors.length > 0 && (
            <div className="field-group">
              <label>Distributed by</label>
              <div className="pills">{item.distributors.map((d) => <span key={d} className="pill static">{d}</span>)}</div>
            </div>
          )}

          <DetailReview review={item.movieReview} hasSpoilers={item.hasSpoilers} />
          <DetailNotes notes={item.notes} />
          <DetailHistoryTable label="Rewatch history" entries={item.rewatches ?? []} />
          <DetailCoverStrip label="Related" entries={relatedEntries} onNavigate={onNavigate} />
          <DetailFranchiseTimeline items={franchiseItems} currentId={item.id} franchise={item.franchise} yearOf={yearOf} onNavigate={onNavigate} />
          <DetailCoverStrip label="Recommendations" entries={recommendedEntries} onNavigate={onNavigate} />
          <CustomFieldsView fields={item.customFields} />
        </div>
      </div>
    </div>
  )
}
