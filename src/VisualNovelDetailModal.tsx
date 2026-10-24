import { useState } from 'react'
import { assetSrc, vnLangFlag, vnLangLabel, VN_LENGTH_OPTIONS, VN_STATUS_OPTIONS, VN_DEV_STATUS_OPTIONS, VN_STAFF_ROLE_OPTIONS, VN_CHARACTER_ROLE_OPTIONS } from './types'
import type { Item, AnyItem, VnItem, Collection, VnStaffRole } from './types'
import DetailShell, { DetailChips, DetailFacts, DetailSection } from './components/detail/DetailShell'
import { formatDay } from './utils/format'
import { exportItemAsJson } from './utils/files'
import DetailCoverStrip from './components/detail/DetailCoverStrip'
import CustomFieldsView from './components/CustomFieldsView'
import DetailHistoryTable from './components/detail/DetailHistoryTable'
import DetailReview from './components/detail/DetailReview'
import { BasedOnDisplay } from './components/BasedOn'
import DetailNotes from './components/detail/DetailNotes'

interface Props {
  item: VnItem
  groups: Collection[]
  allVns: AnyItem[]
  onClose: () => void
  onEdit: () => void
  onDuplicate: () => void
  onNavigate: (id: string) => void
  allItems?: AnyItem[]
}

const STATUS_LABEL = (v?: string): string => VN_STATUS_OPTIONS.find((s) => s.value === v)?.label ?? ''
const LENGTH_LABEL = (v?: string): string => VN_LENGTH_OPTIONS.find((s) => s.value === v)?.label ?? ''
const DEVSTATUS_LABEL = (v?: string): string => VN_DEV_STATUS_OPTIONS.find((s) => s.value === v)?.label ?? ''
const STAFF_ROLE_LABEL = (v: VnStaffRole): string => VN_STAFF_ROLE_OPTIONS.find((r) => r.value === v)?.label ?? v
const CHAR_ROLE_LABEL = (v: string): string => VN_CHARACTER_ROLE_OPTIONS.find((r) => r.value === v)?.label ?? v

export default function VisualNovelDetailModal({ item, groups, allVns, onEdit, onDuplicate, onNavigate, allItems }: Props) {
  const [revealedScreens, setRevealedScreens] = useState<Set<string>>(new Set())
  const [openScreen, setOpenScreen] = useState<string | null>(null)

  const covers = (item.vnCovers ?? []).filter((c) => c.exhibited !== false)
  const nonMainCovers = covers.filter((c) => !c.main)

  const staffByRole = new Map<VnStaffRole, typeof item.vnStaff>()
  for (const s of item.vnStaff ?? []) {
    const arr = staffByRole.get(s.role) ?? []
    arr.push(s)
    staffByRole.set(s.role, arr)
  }

  // Publishers grouped by lang so the block reads as "🇯🇵 Frontwing · Prototype".
  const pubByLang = new Map<string, typeof item.vnPublishers>()
  for (const p of item.vnPublishers ?? []) {
    const arr = pubByLang.get(p.lang) ?? []
    arr.push(p)
    pubByLang.set(p.lang, arr)
  }

  const relatedEntries = (item.relatedItems ?? [])
    .map((r) => ({ ref: allVns.find((a) => a.id === r.itemId), rel: r }))
    .filter((x) => x.ref)
    .map(({ ref, rel }) => ({ item: ref!, badge: rel.relation }))
  const recommendedEntries = (item.recommendedItems ?? [])
    .map((id) => allVns.find((a) => a.id === id))
    .filter((x): x is Item => !!x)
    .map((it) => ({ item: it }))

  const releaseYearOnly = item.releaseDate ? item.releaseDate.slice(0, 4) : item.releaseYear

  const relatedCount = relatedEntries.length + recommendedEntries.length
  const mediaCount = nonMainCovers.length + (item.vnScreenshots?.length ?? 0)

  return (
    <DetailShell
      item={item}
      chips={[STATUS_LABEL(item.visualNovelStatus), item.nsfw ? '18+' : null, item.vnLength ? LENGTH_LABEL(item.vnLength) : null, releaseYearOnly]}
      subtitle={item.vnAliases && item.vnAliases.length > 0 ? item.vnAliases.join(' · ') : undefined}
      meta={item.devs && item.devs.length > 0 ? item.devs.join(', ') : undefined}
      stats={[
        ['Your rating', item.rating ? `★ ${item.rating}` : null],
        ['VNDB score', item.vnCommunityRating ? `${item.vnCommunityRating} / 10` : null],
        ['Play time', item.playTime || (item.vnLengthHours ? `~${item.vnLengthHours}h` : null)],
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
              {item.vnDescription && <p className="detail-description">{item.vnDescription}</p>}
              <DetailFacts facts={[
                ['Developers', item.devs?.join(', ')],
                ['Released', item.releaseDate ? formatDay(item.releaseDate) : releaseYearOnly],
                ['Development', item.vnDevStatus ? DEVSTATUS_LABEL(item.vnDevStatus) : null],
                ['Length', [item.vnLength ? LENGTH_LABEL(item.vnLength) : '', item.vnLengthHours ? `~${item.vnLengthHours}h` : ''].filter(Boolean).join(' · ')],
                ['Engine', item.vnEngine],
                ['Original language', item.vnOriginalLanguage ? `${vnLangFlag(item.vnOriginalLanguage)} ${vnLangLabel(item.vnOriginalLanguage)}` : null],
                ['Platforms', item.platforms?.join(', ')],
                ['Languages', item.vnLanguages && item.vnLanguages.length > 0 ? item.vnLanguages.map((l) => `${vnLangFlag(l)} ${l}`).join('  ') : null],
                ['Started', item.startDate ? formatDay(item.startDate) : null],
                ['VNDB', item.vndbId],
                ['Groups', groups.length > 0 ? groups.map((g) => g.name).join(', ') : null],
              ]} />
              {item.tags && item.tags.length > 0 && <DetailSection title="Tags"><DetailChips values={item.tags} /></DetailSection>}
          {pubByLang.size > 0 && (
            <div className="field-group">
              <label>Publishers by region</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Array.from(pubByLang.entries()).map(([lang, plist]) => (
                  <div key={lang} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 18, flex: '0 0 auto' }} title={vnLangLabel(lang)}>{vnLangFlag(lang)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', flex: '0 0 90px' }}>{vnLangLabel(lang)}</span>
                    <span style={{ flex: 1 }}>
                      {plist?.map((p, i) => (
                        <span key={p.id}>
                          {i > 0 && <span style={{ color: 'var(--text-faint)' }}> · </span>}
                          <b>{p.name}</b>
                          {p.role === 'developer' && <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 4 }}>(dev)</span>}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.vnEditions && item.vnEditions.length > 0 && (
            <div className="field-group">
              <label>Editions ({item.vnEditions.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {item.vnEditions.map((e) => (
                  <div key={e.id} style={{ display: 'flex', gap: 8, padding: '4px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
                    {e.lang && <span style={{ fontSize: 16 }} title={vnLangLabel(e.lang)}>{vnLangFlag(e.lang)}</span>}
                    <span style={{ flex: 1 }}><b>{e.name}</b>{e.lang && <span style={{ color: 'var(--text-faint)', marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{vnLangLabel(e.lang)}</span>}</span>
                    <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{e.official ? 'official' : 'unofficial'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

              <DetailReview review={item.vnReview} hasSpoilers={item.hasSpoilers} />
              <DetailNotes notes={item.notes} />
              <CustomFieldsView fields={item.customFields} />
            </>
          ),
        },
        {
          id: 'characters',
          label: 'Characters',
          count: item.vnCharacters?.length,
          hidden: !item.vnCharacters || item.vnCharacters.length === 0,
          content: <>
          {item.vnCharacters && item.vnCharacters.length > 0 && (
            <div className="field-group">
              <label>Cast ({item.vnCharacters.length})</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {item.vnCharacters.map((c) => (
                  <div key={c.id} style={{ display: 'flex', gap: 10, padding: 10, background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ flex: '0 0 64px', width: 64, height: 88, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.image ? (
                        <img src={assetSrc(c.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: 'var(--text-faint)', fontSize: 9, textAlign: 'center' }}>—</span>
                      )}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.original && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>{c.original}</div>}
                      <div style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{CHAR_ROLE_LABEL(c.role)}</div>
                      {c.seiyuu && (
                        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                          CV: {c.seiyuu}
                        </div>
                      )}
                      {c.description && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-dim)' }}>{c.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          </>,
        },
        {
          id: 'staff',
          label: 'Staff',
          count: item.vnStaff?.length,
          hidden: !item.vnStaff || item.vnStaff.length === 0,
          content: <>
          {(item.vnStaff && item.vnStaff.length > 0) && (
            <div className="field-group">
              <label>Staff ({item.vnStaff.length})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Array.from(staffByRole.entries()).map(([role, list]) => (
                  <div key={role} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--text-faint)', textTransform: 'uppercase', paddingBottom: 4, borderBottom: '1px solid var(--border-soft)' }}>
                      {STAFF_ROLE_LABEL(role)} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>({list?.length ?? 0})</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
                      {list?.map((s) => (
                        <div key={s.id} style={{ padding: '6px 10px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.name}
                            {s.original && s.original !== s.name && (
                              <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>{s.original}</span>
                            )}
                          </div>
                          {s.note && (
                            <div style={{ color: 'var(--text-dim)', fontSize: 11.5, lineHeight: 1.35 }}>{s.note}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          </>,
        },
        {
          id: 'media',
          label: 'Covers & screenshots',
          count: mediaCount,
          hidden: mediaCount === 0,
          content: <>
          {nonMainCovers.length > 0 && (
            <div className="field-group">
              <label>Covers ({nonMainCovers.length})</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {nonMainCovers.map((c) => (
                  <div key={c.id} style={{ position: 'relative', aspectRatio: '3 / 4', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-soft)' }}>
                    <img src={assetSrc(c.path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {c.lang && (
                      <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 999, fontSize: 14 }} title={vnLangLabel(c.lang)}>{vnLangFlag(c.lang)}</span>
                    )}
                    {c.releaseTitle && (
                      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', padding: '12px 8px 6px', color: '#fff', fontSize: 11, textAlign: 'left' }}>
                        {c.releaseTitle}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.vnScreenshots && item.vnScreenshots.length > 0 && (
            <div className="field-group">
              <label>Screenshots ({item.vnScreenshots.length})</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {item.vnScreenshots.map((s) => {
                  const revealed = revealedScreens.has(s.id)
                  const shouldBlur = s.nsfw && !revealed
                  return (
                    <div key={s.id} style={{ position: 'relative', aspectRatio: '16 / 9', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', cursor: 'pointer' }} onClick={() => {
                      if (shouldBlur) {
                        const next = new Set(revealedScreens)
                        next.add(s.id)
                        setRevealedScreens(next)
                      } else {
                        setOpenScreen(s.path)
                      }
                    }}>
                      <img src={assetSrc(s.path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: shouldBlur ? 'blur(18px)' : 'none' }} />
                      {shouldBlur && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                          Click to reveal · NSFW
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {openScreen && (
                <div
                  onClick={() => setOpenScreen(null)}
                  style={{ position: 'fixed', inset: 0, paddingTop: 'var(--titlebar-h, 0px)', background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                >
                  <img src={assetSrc(openScreen)} alt="" style={{ maxWidth: '95vw', maxHeight: 'calc(95vh - var(--titlebar-h, 0px))' }} />
                </div>
              )}
            </div>
          )}

          </>,
        },
        {
          id: 'history',
          label: 'Replays',
          count: item.rewatches?.length,
          hidden: !item.rewatches || item.rewatches.length === 0,
          content: <DetailHistoryTable label="Replay history" entries={item.rewatches ?? []} />,
        },
        {
          id: 'related',
          label: 'Related',
          count: relatedCount,
          hidden: relatedCount === 0,
          content: (
            <>
              <DetailCoverStrip label="Related" entries={relatedEntries} onNavigate={onNavigate} />
              <DetailCoverStrip label="Recommendations" entries={recommendedEntries} onNavigate={onNavigate} />
            </>
          ),
        },
      ]}
    />
  )
}
