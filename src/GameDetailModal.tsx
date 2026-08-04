import { useState } from 'react'
import { getOwnershipLabel, getGameStatus, getGameSourceLabel, getAgeRatingLabel, assetSrc } from './types'
import { GameStatusIcon } from './icons'
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

interface Props {
  item: Item
  groups: Collection[]
  allGames: Item[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
}

const timelineSortKey = (i: Item) => i.releaseDate || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

export default function GameDetailModal({ item, groups, allGames, onClose, onEdit, onDuplicate, onNavigate }: Props) {
  const [screenshotLightbox, setScreenshotLightbox] = useState<number | null>(null)
  const gs = getGameStatus(item.gameStatus)
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null
  const franchiseItems = item.franchise
    ? allGames.filter((a) => a.franchise === item.franchise).sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
    : []
  const relatedEntries = (item.relatedItems ?? [])
    .map((r) => ({ ref: allGames.find((a) => a.id === r.itemId), rel: r }))
    .filter((x) => x.ref)
    .map(({ ref, rel }) => ({ item: ref!, badge: rel.relation }))
  const recommendedEntries = (item.recommendedItems ?? [])
    .map((id) => allGames.find((a) => a.id === id))
    .filter((x): x is Item => !!x)
    .map((it) => ({ item: it }))
  const originalWork = item.originalWorkId ? allGames.find((a) => a.id === item.originalWorkId) : null
  const derivedWorks = allGames.filter((a) => a.originalWorkId === item.id)

  return (
    <div className="game-page">
      <DetailTopbar onBack={onClose} onDuplicate={onDuplicate} onEdit={onEdit} onExport={() => exportItemAsJson(item as unknown as Record<string, unknown>, item.title)} />

      {item.bannerImage && (
        <div className="game-modal-banner">
          <img src={assetSrc(item.bannerImage)} alt="" />
          <div className="banner-fade" />
        </div>
      )}
      {item.bannerImage && item.logoImage && <img className="game-modal-logo" src={assetSrc(item.logoImage)} alt="" />}

      <div className="game-modal-body" style={item.bannerImage ? { marginTop: 110 } : undefined}>
        <div className="game-modal-main">
          <div className="game-modal-cover">
            {item.cover ? <img src={assetSrc(item.cover)} alt="" /> : <div className="cover-preview-placeholder">No cover</div>}
          </div>
          <div className="game-modal-info">
            <div className="game-modal-title-row">
              <h1>{item.title} {year && <span className="game-modal-year">({year})</span>}</h1>
              {!item.bannerImage && item.logoImage && <img className="game-modal-logo-inline" src={assetSrc(item.logoImage)} alt="" />}
            </div>
            {item.alternativeTitles && item.alternativeTitles.length > 0 && (
              <p className="game-modal-alt-titles">{item.alternativeTitles.join(' · ')}</p>
            )}
            {((item.devs && item.devs.length > 0) || (item.publishers && item.publishers.length > 0)) && (
              <p className="game-modal-devs">
                {item.devs && item.devs.length > 0 && item.devs.join(', ')}
                {item.devs && item.devs.length > 0 && item.publishers && item.publishers.length > 0 && ' · '}
                {item.publishers && item.publishers.length > 0 && item.publishers.join(', ')}
              </p>
            )}
            {item.description && <div className="game-modal-description">{item.description}</div>}
            <div className="dlc-addons-row">
              <div className="field-group">
                <label>Status</label>
                <div className="pills">
                  <span className={`badge status-badge status-${gs.value}`}><GameStatusIcon value={gs.value} /> {gs.label}</span>
                  {item.gameSource && <span className="pill static">Source: {getGameSourceLabel(item.gameSource)}</span>}
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
          {item.platforms && item.platforms.length > 0 && (
            <div className="field-group">
              <label>Platforms</label>
              <div className="pills">{item.platforms.map((p) => <span key={p} className="pill static">{p}</span>)}</div>
            </div>
          )}
          <div className="dlc-addons-row wrap-4">
            {item.ownership && (
              <div className="field-group">
                <label>Ownership</label>
                <div className="pills"><span className="pill static">{getOwnershipLabel(item.ownership)}</span></div>
              </div>
            )}
            {item.playTime && (
              <div className="field-group">
                <label>Time played</label>
                <div className="pills"><span className="pill static">{item.playTime}h played</span></div>
              </div>
            )}
            {(item.achievementsUnlocked || item.achievementsTotal) && (
              <div className="field-group">
                <label>Achievements</label>
                <div className="pills"><span className="pill static">{item.achievementsUnlocked || '0'} / {item.achievementsTotal || '?'}</span></div>
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
                <label>Completion date</label>
                <div className="pills"><span className="pill static">Finished: {item.finishedAt}</span></div>
              </div>
            )}
          </div>

          {item.bundleContents && item.bundleContents.length > 0 && (
            <div className="field-group">
              <label>Bundle contents</label>
              <div className="bundle-view-grid">
                {item.bundleContents.map((b) => (
                  <div key={b.id} className="bundle-view-card">
                    <div className="bundle-view-cover">
                      {b.cover
                        ? <img src={assetSrc(b.cover)} alt={b.name} />
                        : <span>{b.name.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="bundle-view-text">
                      <div className="bundle-view-name">{b.name}</div>
                      <span className="pill static">
                        <GameStatusIcon value={b.status} /> {getGameStatus(b.status).label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {((item.dlcList && item.dlcList.length > 0) || (item.addonsList && item.addonsList.length > 0)) && (
            <div className="dlc-addons-row">
              {item.dlcList && item.dlcList.length > 0 && (
                <div className="field-group">
                  <label>DLC &amp; expansions</label>
                  <ul className="tag-list">
                    {item.dlcList.map((d) => (
                      <li key={d.id}><span>{d.name}</span><span className="pill static"><GameStatusIcon value={d.status} /> {getGameStatus(d.status).label}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {item.addonsList && item.addonsList.length > 0 && (
                <div className="field-group">
                  <label>Addons</label>
                  <ul className="tag-list">
                    {item.addonsList.map((d) => (
                      <li key={d.id}><span>{d.name}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {item.achievements && item.achievements.length > 0 && (() => {
            const unlocked = item.achievements!.filter((a) => a.unlockedAt).length
            const sorted = [...item.achievements!].sort((a, b) => {
              if (!!a.unlockedAt !== !!b.unlockedAt) return a.unlockedAt ? -1 : 1
              if (a.unlockedAt && b.unlockedAt) return b.unlockedAt.localeCompare(a.unlockedAt)
              return a.name.localeCompare(b.name)
            })
            return (
              <div className="field-group">
                <label>Achievements ({unlocked} / {item.achievements!.length} unlocked)</label>
                <ul className="achievement-list detail">
                  {sorted.map((a) => (
                    <li key={a.id} className={a.unlockedAt ? 'achievement-row unlocked' : 'achievement-row'}>
                      <span className="achievement-toggle-icon">{a.unlockedAt ? '★' : '☆'}</span>
                      <div className="achievement-body">
                        <div className="achievement-name-static">{a.name}</div>
                        {a.description && <div className="achievement-desc-static">{a.description}</div>}
                        {a.unlockedAt && <div className="achievement-date-static">Unlocked {a.unlockedAt.slice(0, 10)}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}

          {item.screenshots && item.screenshots.length > 0 && (
            <div className="field-group">
              <label>Screenshots ({item.screenshots.length})</label>
              <div className="screenshots-grid detail">
                {item.screenshots.map((s, i) => (
                  <figure key={s.id} className="screenshot-tile">
                    <img
                      src={assetSrc(s.path)}
                      alt={s.caption || s.filename}
                      loading="lazy"
                      onClick={() => setScreenshotLightbox(i)}
                      title="Click to view full size"
                      style={{ cursor: 'zoom-in' }}
                    />
                    {s.caption && <figcaption className="screenshot-caption-static">{s.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </div>
          )}

          {screenshotLightbox !== null && item.screenshots && (
            <ImageLightbox
              images={item.screenshots.map((s) => ({ src: s.path, caption: s.caption, label: s.filename }))}
              index={screenshotLightbox}
              onIndex={setScreenshotLightbox}
              onClose={() => setScreenshotLightbox(null)}
            />
          )}

          {item.saveFiles && item.saveFiles.length > 0 && (
            <div className="field-group">
              <label>Save files</label>
              <ul className="save-files-list detail">
                {item.saveFiles.map((s) => {
                  const size = s.size < 1024 * 1024
                    ? `${(s.size / 1024).toFixed(1)} KB`
                    : s.size < 1024 * 1024 * 1024
                      ? `${(s.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${(s.size / (1024 * 1024 * 1024)).toFixed(2)} GB`
                  const when = (() => {
                    const d = new Date(s.addedAt)
                    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
                  })()
                  return (
                    <li key={s.id} className="save-files-row">
                      <div className="save-files-meta">
                        <span className="save-files-name" title={s.filename}>{s.filename}</span>
                        <span className="save-files-sub">
                          {size} · {when}
                          {s.note && <> · <em>{s.note}</em></>}
                        </span>
                      </div>
                      <div className="save-files-actions">
                        <button
                          type="button"
                          onClick={() => window.ipcRenderer.invoke('save-file:reveal', s.path)}
                          title="Open folder in file manager"
                        >Open folder</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <DetailReview review={item.gameReview} hasSpoilers={item.hasSpoilers} />
          <DetailNotes notes={item.notes} />
          <DetailHistoryTable label="Replay history" entries={item.rewatches ?? []} />
          <DetailCoverStrip label="Related" entries={relatedEntries} onNavigate={onNavigate} />
          {originalWork && (
            <DetailCoverStrip label="Original work" entries={[{ item: originalWork }]} onNavigate={onNavigate} />
          )}
          <DetailCoverStrip
            label="Derived works"
            entries={derivedWorks.map((d) => ({ item: d, badge: d.gameSource ? getGameSourceLabel(d.gameSource) : undefined }))}
            onNavigate={onNavigate}
          />
          <DetailFranchiseTimeline items={franchiseItems} currentId={item.id} franchise={item.franchise} yearOf={yearOf} onNavigate={onNavigate} />
          <DetailCoverStrip label="Recommendations" entries={recommendedEntries} onNavigate={onNavigate} />
          <CustomFieldsView fields={item.customFields} />
        </div>
      </div>
    </div>
  )
}
