import { useState } from 'react'
import { getOwnershipLabel, getGameStatus, getGameSourceLabel, getAgeRatingLabel, assetSrc } from './types'
import { GameStatusIcon } from './icons'
import type { Item, AnyItem, GameItem, Collection } from './types'
import DetailTopbar from './components/detail/DetailTopbar'
import ImageLightbox from './components/ImageLightbox'
import CoverPlaceholder from './components/CoverPlaceholder'
import { exportItemAsJson } from './utils/files'
import { formatBytes, formatDate } from './utils/format'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailFranchiseTimeline from './components/detail/DetailFranchiseTimeline'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import { BasedOnDisplay } from './components/BasedOn'
import DetailNotes from './components/detail/DetailNotes'
import ServiceLogo, { type ServiceName } from './components/ServiceLogo'

// Store slug (as saved on the Item) → ServiceLogo service key. Both
// enums overlap almost 1:1; only `official` and `other` map to null
// so the link renders with a neutral chevron icon instead of a badge.
const STORE_SLUG_TO_LOGO: Record<string, ServiceName | null> = {
  steam: 'steam', gog: 'gog', epic: 'epic', itch: 'itch',
  humble: 'humble', ubi: 'ubi', ea: 'ea', battlenet: 'battlenet',
  rockstar: 'rockstar', nintendo: 'nintendo', playstation: 'playstation',
  xbox: 'xbox', official: null, other: null,
}

interface Props {
  item: GameItem
  groups: Collection[]
  allGames: AnyItem[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
  allItems?: AnyItem[]
}

const timelineSortKey = (i: Item) => i.releaseDate || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

export default function GameDetailModal({ item, groups, allGames, onClose, onEdit, onDuplicate, onNavigate, allItems }: Props) {
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
          <img className="zoomable" src={assetSrc(item.bannerImage)} alt={item.title} data-zoom-label="Banner" />
          <div className="banner-fade" />
        </div>
      )}
      {item.bannerImage && item.logoImage && <img className="game-modal-logo zoomable" src={assetSrc(item.logoImage)} alt={item.title} data-zoom-label="Logo" />}

      <div className="game-modal-body" style={item.bannerImage ? { marginTop: 110 } : undefined}>
        <div className="game-modal-main">
          <div className="game-modal-cover">
            {item.cover ? <img className="zoomable" src={assetSrc(item.cover)} alt={item.title} data-zoom-label="Cover" /> : <div className="cover-preview-placeholder"><CoverPlaceholder categoryId={item.categoryId} /></div>}
          </div>
          <div className="game-modal-info">
            <div className="game-modal-title-row">
              <h1>{item.title} {year && <span className="game-modal-year">({year})</span>}</h1>
              {!item.bannerImage && item.logoImage && <img className="game-modal-logo-inline zoomable" src={assetSrc(item.logoImage)} alt={item.title} data-zoom-label="Logo" />}
            </div>
            {allItems && <BasedOnDisplay itemId={item.id} allItems={allItems} onNavigate={onNavigate} />}
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
                <div className="card-tags">{item.genres.map((g) => <span key={g} className="card-tag">{g}</span>)}</div>
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
            {item.deckCompat && item.deckCompat !== 'unknown' && (
              <div className="field-group">
                <label>Steam Deck</label>
                <div className="pills">
                  <span className={`pill static deck-chip deck-${item.deckCompat}`} style={{ textTransform: 'capitalize' }}>
                    ◆ {item.deckCompat}
                  </span>
                </div>
              </div>
            )}
            {item.protonRating && (
              <div className="field-group">
                <label>ProtonDB</label>
                <div className="pills">
                  <span className="pill static" style={{ textTransform: 'capitalize' }}>{item.protonRating}</span>
                </div>
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
                        ? <img className="zoomable" src={assetSrc(b.cover)} alt={b.name} data-zoom-group={`game-bundle-${item.id}`} data-zoom-label={b.name} />
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
                  const size = formatBytes(s.size)
                  const when = formatDate(s.addedAt)
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
                          onClick={() => window.ipcRenderer.invoke('asset-blob:reveal', s.path)}
                          title="Open folder in file manager"
                        >Open folder</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {item.playthroughs && item.playthroughs.length > 0 && (() => {
            const totalSeconds = item.playthroughs!.reduce((sum, p) => {
              const raw = p.hours ?? ''
              const m = raw.match(/^(\d+(?:\.\d+)?)\s*h/i) || raw.match(/^(\d+(?:\.\d+)?)$/) || raw.match(/^(\d+):(\d+)$/)
              if (!m) return sum
              if (m.length === 3 && m[2] !== undefined) return sum + (parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60)
              return sum + Math.round(parseFloat(m[1]) * 3600)
            }, 0)
            const totalHours = totalSeconds > 0 ? (totalSeconds / 3600).toFixed(1) : null
            return (
              <div className="field-group">
                <label>Playthroughs · {item.playthroughs!.length} run{item.playthroughs!.length === 1 ? '' : 's'}{totalHours ? ` · ${totalHours}h` : ''}</label>
                <ul className="detail-playthroughs">
                  {item.playthroughs!.map((p, i) => {
                    const summary = [p.character, p.difficulty, p.platform].filter(Boolean).join(' · ')
                    return (
                      <li key={p.id} className="detail-playthrough">
                        <div className="detail-playthrough-head">
                          <span className="detail-playthrough-num">#{i + 1}</span>
                          <span className="detail-playthrough-summary">{summary || 'Run'}</span>
                          {p.hours && <span className="detail-playthrough-hours">{p.hours}</span>}
                          {p.finishedAt && <span className="detail-playthrough-date">Finished {p.finishedAt}</span>}
                          {!p.finishedAt && p.startedAt && <span className="detail-playthrough-date">Started {p.startedAt}</span>}
                        </div>
                        {p.coop && <div className="detail-playthrough-meta">Co-op / solo: {p.coop}</div>}
                        {p.achievementsHit && p.achievementsHit.length > 0 && (
                          <div className="detail-playthrough-meta">Milestones: {p.achievementsHit.join(', ')}</div>
                        )}
                        {p.note && <p className="detail-playthrough-note">{p.note}</p>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })()}

          {item.storeLinks && item.storeLinks.length > 0 && (
            <div className="field-group">
              <label>Store links</label>
              <div className="detail-store-links">
                {item.storeLinks.map((s) => {
                  const logoService = STORE_SLUG_TO_LOGO[s.store] ?? null
                  return (
                    <a
                      key={s.id}
                      className="pill static detail-store-link"
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.note || undefined}
                    >
                      {logoService ? <ServiceLogo service={logoService} size={16} /> : <span aria-hidden>↗</span>}
                      <span>{s.store}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {item.purchases && item.purchases.length > 0 && (
            <div className="field-group">
              <label>Purchase log · {item.purchases.length} entr{item.purchases.length === 1 ? 'y' : 'ies'}</label>
              <table className="track-table detail-purchase-table">
                <thead>
                  <tr>
                    <th className="col-num">Date</th>
                    <th className="col-title">Store</th>
                    <th className="col-length">Price</th>
                    <th className="col-length">Discount</th>
                    <th>Note</th>
                    <th className="col-spacer"></th>
                  </tr>
                </thead>
                <tbody>
                  {item.purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="col-num">{p.date ?? '—'}</td>
                      <td className="col-title">{p.storeLabel ?? '—'}</td>
                      <td className="col-length">{p.price ? `${p.price}${p.currency ? ` ${p.currency}` : ''}` : '—'}</td>
                      <td className="col-length">{p.discount ?? ''}</td>
                      <td>{p.note ?? ''}</td>
                      <td className="col-spacer"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
