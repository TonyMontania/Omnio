import { useState } from 'react'
import { getOwnershipLabel, getGameStatus, getGameSourceLabel, getAgeRatingLabel, assetSrc } from './types'
import { GameStatusIcon } from './icons'
import type { Item, AnyItem, GameItem, Collection, FranchiseSection, FranchiseGraph } from './types'
import DetailShell, { DetailChips, DetailFacts, DetailSection } from './components/detail/DetailShell'
import ImageLightbox from './components/ImageLightbox'
import { exportItemAsJson } from './utils/files'
import { formatBytes, formatDate, formatDay } from './utils/format'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailFranchiseTimeline from './components/detail/DetailFranchiseTimeline'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import { BasedOnDisplay } from './components/BasedOn'
import DetailNotes from './components/detail/DetailNotes'
import ServiceLogo, { type ServiceName } from './components/ServiceLogo'
import { plural, t } from './i18n'

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
  onOpenCrossLibraryFranchise?: (franchise: string) => void
  franchiseSections?: FranchiseSection[]
  franchiseViewMode?: 'year' | 'sections' | 'graph'
  franchiseGraph?: FranchiseGraph
}

const timelineSortKey = (i: Item) => i.releaseDate || i.releaseYear || ''
const yearOf = (i: Item) => timelineSortKey(i).slice(0, 4)

export default function GameDetailModal({ item, groups, allGames, onEdit, onDuplicate, onNavigate, allItems, onOpenCrossLibraryFranchise, franchiseSections, franchiseViewMode, franchiseGraph }: Props) {
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

  const facts: [string, React.ReactNode][] = [
    [t('Developers'), item.devs?.join(', ')],
    [t('Publishers'), item.publishers?.join(', ')],
    [t('Released'), item.releaseDate ? formatDay(item.releaseDate) : item.releaseYear],
    [t('Platforms'), item.platforms?.join(', ')],
    [t('Genres'), item.genres?.join(', ')],
    [t('Franchise'), item.franchise],
    [t('Source'), item.gameSource ? getGameSourceLabel(item.gameSource) : null],
    [t('Ownership'), item.ownership ? getOwnershipLabel(item.ownership) : null],
    [t('Age rating'), item.ageRating ? getAgeRatingLabel(item.ageRating) : null],
    [t('Steam Deck'), item.deckCompat && item.deckCompat !== 'unknown' ? <span className={`deck-chip deck-${item.deckCompat}`} style={{ textTransform: 'capitalize' }}>◆ {item.deckCompat}</span> : null],
    ['ProtonDB', item.protonRating ? <span style={{ textTransform: 'capitalize' }}>{item.protonRating}</span> : null],
    [t('Groups'), groups.length > 0 ? groups.map((g) => g.name).join(', ') : null],
  ]
  const playLogCount = (item.playthroughs?.length ?? 0) + (item.saveFiles?.length ?? 0) + (item.rewatches?.length ?? 0) + (item.purchases?.length ?? 0)
  const relatedCount = relatedEntries.length + recommendedEntries.length + derivedWorks.length + (originalWork ? 1 : 0) + Math.max(0, franchiseItems.length - 1)

  return (
    <DetailShell
      item={item}
      chips={[gs.label, year ? String(year) : null, item.platforms?.[0]]}
      subtitle={item.alternativeTitles && item.alternativeTitles.length > 0 ? item.alternativeTitles.join(' · ') : undefined}
      meta={[item.devs?.join(', '), item.publishers?.join(', ')].filter(Boolean).join(' · ') || undefined}
      stats={[
        [t('Rating'), item.rating ? t('★ {rating}', { rating: item.rating }) : null],
        [t('Time played'), item.playTime ? t('{playTime}h', { playTime: item.playTime }) : null],
        [t('Achievements'), item.achievementsUnlocked || item.achievementsTotal ? t('{achievementsUnlocked} / {achievementsTotal}', { achievementsUnlocked: item.achievementsUnlocked || '0', achievementsTotal: item.achievementsTotal || '?' }) : null],
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
              {item.description && <p className="detail-description">{item.description}</p>}
              <DetailFacts facts={facts} />
              {item.tags && item.tags.length > 0 && <DetailSection title={t('Tags')}><DetailChips values={item.tags} /></DetailSection>}
          {item.storeLinks && item.storeLinks.length > 0 && (
            <div className="field-group">
              <label>{t('Store links')}</label>
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

          {item.bundleContents && item.bundleContents.length > 0 && (
            <div className="field-group">
              <label>{t('Bundle contents')}</label>
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
                  <label>{t('DLC & expansions')}</label>
                  <ul className="tag-list">
                    {item.dlcList.map((d) => (
                      <li key={d.id}><span>{d.name}</span><span className="pill static"><GameStatusIcon value={d.status} /> {getGameStatus(d.status).label}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {item.addonsList && item.addonsList.length > 0 && (
                <div className="field-group">
                  <label>{t('Addons')}</label>
                  <ul className="tag-list">
                    {item.addonsList.map((d) => (
                      <li key={d.id}><span>{d.name}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DetailReview review={item.gameReview} hasSpoilers={item.hasSpoilers} />
          <DetailNotes notes={item.notes} />
              <CustomFieldsView fields={item.customFields} />
            </>
          ),
        },
        {
          id: 'achievements',
          label: t('Achievements'),
          count: item.achievements?.length,
          hidden: !item.achievements || item.achievements.length === 0,
          content: <>
          {item.achievements && item.achievements.length > 0 && (() => {
            const unlocked = item.achievements!.filter((a) => a.unlockedAt).length
            const sorted = [...item.achievements!].sort((a, b) => {
              if (!!a.unlockedAt !== !!b.unlockedAt) return a.unlockedAt ? -1 : 1
              if (a.unlockedAt && b.unlockedAt) return b.unlockedAt.localeCompare(a.unlockedAt)
              return a.name.localeCompare(b.name)
            })
            return (
              <div className="field-group">
                <label>{t('Achievements ({unlocked} / {achievements} unlocked)', { unlocked: unlocked, achievements: item.achievements!.length })}</label>
                <ul className="achievement-list detail">
                  {sorted.map((a) => (
                    <li key={a.id} className={a.unlockedAt ? 'achievement-row unlocked' : 'achievement-row'}>
                      <span className="achievement-toggle-icon">{a.unlockedAt ? '★' : '☆'}</span>
                      <div className="achievement-body">
                        <div className="achievement-name-static">{a.name}</div>
                        {a.description && <div className="achievement-desc-static">{a.description}</div>}
                        {a.unlockedAt && <div className="achievement-date-static">{t('Unlocked {unlockedAt}', { unlockedAt: a.unlockedAt.slice(0, 10) })}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}

        </>,
        },
        {
          id: 'media',
          label: t('Screenshots'),
          count: item.screenshots?.length,
          hidden: !item.screenshots || item.screenshots.length === 0,
          content: <>
          {item.screenshots && item.screenshots.length > 0 && (
            <div className="field-group">
              <label>{t('Screenshots ({screenshots})', { screenshots: item.screenshots.length })}</label>
              <div className="screenshots-grid detail">
                {item.screenshots.map((s, i) => (
                  <figure key={s.id} className="screenshot-tile">
                    <img
                      src={assetSrc(s.path)}
                      alt={s.caption || s.filename}
                      loading="lazy"
                      onClick={() => setScreenshotLightbox(i)}
                      title={t('Click to view full size')}
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

        </>,
        },
        {
          id: 'log',
          label: t('Play log'),
          count: playLogCount,
          hidden: playLogCount === 0,
          content: <>
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
                <label>{plural(item.playthroughs!.length, 'Playthroughs · {n} run{value}', 'Playthroughs · {n} runs{value}', { value: totalHours ? ` ${t('· {totalHours}h', { totalHours: totalHours })}` : '' })}</label>
                <ul className="detail-playthroughs">
                  {item.playthroughs!.map((p, i) => {
                    const summary = [p.character, p.difficulty, p.platform].filter(Boolean).join(' · ')
                    return (
                      <li key={p.id} className="detail-playthrough">
                        <div className="detail-playthrough-head">
                          <span className="detail-playthrough-num">#{i + 1}</span>
                          <span className="detail-playthrough-summary">{summary || t('Run')}</span>
                          {p.hours && <span className="detail-playthrough-hours">{p.hours}</span>}
                          {p.finishedAt && <span className="detail-playthrough-date">{t('Finished {finishedAt}', { finishedAt: p.finishedAt })}</span>}
                          {!p.finishedAt && p.startedAt && <span className="detail-playthrough-date">{t('Started {startedAt}', { startedAt: p.startedAt })}</span>}
                        </div>
                        {p.coop && <div className="detail-playthrough-meta">{t('Co-op / solo: {coop}', { coop: p.coop })}</div>}
                        {p.achievementsHit && p.achievementsHit.length > 0 && (
                          <div className="detail-playthrough-meta">{t('Milestones: {achievementsHit}', { achievementsHit: p.achievementsHit.join(', ') })}</div>
                        )}
                        {p.note && <p className="detail-playthrough-note">{p.note}</p>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })()}

          {item.saveFiles && item.saveFiles.length > 0 && (
            <div className="field-group">
              <label>{t('Save files')}</label>
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
                          title={t('Open folder in file manager')}
                        >{t('Open folder')}</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <DetailHistoryTable label={t('Replay history')} entries={item.rewatches ?? []} />
          {item.purchases && item.purchases.length > 0 && (
            <div className="field-group">
              <label>{plural(item.purchases.length, 'Purchase log · {n} entry', 'Purchase log · {n} entries')}</label>
              <table className="track-table detail-purchase-table">
                <thead>
                  <tr>
                    <th className="col-num">{t('Date')}</th>
                    <th className="col-title">{t('Store')}</th>
                    <th className="col-length">{t('Price')}</th>
                    <th className="col-length">{t('Discount')}</th>
                    <th>{t('Note')}</th>
                    <th className="col-spacer"></th>
                  </tr>
                </thead>
                <tbody>
                  {item.purchases.map((p) => (
                    <tr key={p.id}>
                      <td className="col-num">{p.date ?? '—'}</td>
                      <td className="col-title">{p.storeLabel ?? '—'}</td>
                      <td className="col-length">{p.price ? t('{price}{value}', { price: p.price, value: p.currency ? ` ${t('{currency}', { currency: p.currency })}` : '' }) : '—'}</td>
                      <td className="col-length">{p.discount ?? ''}</td>
                      <td>{p.note ?? ''}</td>
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
          id: 'related',
          label: t('Related'),
          count: relatedCount,
          hidden: relatedCount === 0,
          content: <>
          <DetailCoverStrip label={t('Related')} entries={relatedEntries} onNavigate={onNavigate} />
          {originalWork && (
            <DetailCoverStrip label={t('Original work')} entries={[{ item: originalWork }]} onNavigate={onNavigate} />
          )}
          <DetailCoverStrip
            label={t('Derived works')}
            entries={derivedWorks.map((d) => ({ item: d, badge: d.gameSource ? getGameSourceLabel(d.gameSource) : undefined }))}
            onNavigate={onNavigate}
          />
          <DetailFranchiseTimeline items={franchiseItems} currentId={item.id} franchise={item.franchise} yearOf={yearOf} onNavigate={onNavigate} onOpenCrossLibrary={onOpenCrossLibraryFranchise} sections={franchiseSections} viewMode={franchiseViewMode} graph={franchiseGraph} />
          <DetailCoverStrip label={t('Recommendations')} entries={recommendedEntries} onNavigate={onNavigate} />
        </>,
        },
      ]}
    />
  )
}
