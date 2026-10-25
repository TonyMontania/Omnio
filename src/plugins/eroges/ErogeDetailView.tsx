import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { ErogeItem } from './types'
import { assetUrl, savesList, savesAdd, savesDelete, savesOpenFolder, savesReveal, savesDeleteAll } from './ipc'
import type { SaveInfo } from './ipc'
import { f95CheckVersion, f95GamesByCreator, f95ThreadId, f95ThreadUrl } from './f95Api'
import { cachedLastChanges, cachedThread, isNewerVersion, versionPatchFrom } from './f95Cache'
import type { TagPrefs } from './constants'
import ServiceLogo from '../../components/ServiceLogo'
import { formatBytes, formatDateTime } from '../../utils/format'

interface Props {
  game: ErogeItem
  f95Cookie?: string
  onEdit: () => void
  onDelete: () => void
  onUpdateGame: (patch: Partial<ErogeItem>) => void
  onCacheFields: (patch: Partial<ErogeItem>) => void
  allGames: ErogeItem[]
  onOpenGame: (id: string) => void
  tagPrefs?: TagPrefs
}

interface OtherGameRow {
  key: string
  title: string
  libGame?: ErogeItem
  url?: string
}

type DetailTab = 'overview' | 'saves' | 'links' | 'more'

const OTHER_GAMES_STALE_MS = 7 * 24 * 60 * 60 * 1000

const BACKLOG_LABEL: Record<string, string> = {
  playing: 'Playing', backlog: 'Backlog', played: 'Played',
}
const BTN_COPY_OK = 'Link copied'
const BTN_COPY_FAIL = 'Could not copy'
const BTN_UP_TO_DATE = 'Up to date'

// Render the description string, expanding marker types the F95
// fetcher produces:
//   - `[[SPOILER:title]]…[[/SPOILER]]` → collapsible <details> block
//   - `[[C:color]]…[[/C]]`             → inline colored span
//   - `[[B]]…[[/B]]`                   → <strong>
//   - `[[I]]…[[/I]]`                   → <em>
//   - `[[U]]…[[/U]]`                   → underline span
// All inline markers nest arbitrarily inside each other; the parser
// walks segment-by-segment so a `[[B]][[C:red]]…[[/C]][[/B]]` block
// renders as bold red text.
// Render the inline `[[C:color]]…[[/C]]` markers into <span
// style="color: …">. Nested markers work — the parser walks
// recursively.
function renderColored(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /\[\[C:([^\]]+)\]\]([\s\S]*?)\[\[\/C\]\]/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const color = m[1].trim()
    nodes.push(
      <span key={`${keyBase}-c${key++}`} style={{ color }}>{renderColored(m[2], `${keyBase}-c${key}`)}</span>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function renderDescription(desc: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /\[\[SPOILER:([^\]]*)\]\]([\s\S]*?)\[\[\/SPOILER\]\]/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(desc)) !== null) {
    if (m.index > last) {
      nodes.push(<React.Fragment key={`t${key}`}>{renderColored(desc.slice(last, m.index), `t${key}`)}</React.Fragment>)
    }
    const title = m[1].trim() || 'Spoiler'
    const content = m[2].trim()
    nodes.push(
      <details key={`sp${key}`} className="er-spoiler">
        <summary className="er-spoiler-btn">{title}</summary>
        <div className="er-spoiler-body">{renderColored(content, `sp${key}`)}</div>
      </details>,
    )
    key++
    last = m.index + m[0].length
  }
  if (last < desc.length) {
    nodes.push(<React.Fragment key={`t${key}`}>{renderColored(desc.slice(last), `t${key}`)}</React.Fragment>)
  }
  return nodes
}

export default function ErogeDetailView({ game, f95Cookie, onEdit, onDelete, onUpdateGame, onCacheFields, allGames, onOpenGame, tagPrefs }: Props) {
  const [saves, setSaves] = useState<SaveInfo[]>([])
  const [checking, setChecking] = useState(false)
  const [flash, setFlash] = useState('')
  const [loadingOthers, setLoadingOthers] = useState(false)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const refreshSaves = useCallback(async () => { setSaves(await savesList(game.name)) }, [game.name])
  useEffect(() => { void refreshSaves() }, [refreshSaves])

  useEffect(() => {
    rootRef.current?.closest('.er-view')?.scrollTo({ top: 0 })
    setTab('overview')
    setMenuOpen(false)
  }, [game.id])

  const cover = game.coverFile ? assetUrl('cover', game.coverFile) : null
  const isF95 = !!game.link && /f95zone/i.test(game.link)

  const creatorName = (game.otherGamesCreator || game.creator || '').trim()
  const shouldLookup = !!creatorName && (isF95 || !!game.otherGamesCreator)

  useEffect(() => {
    if (!shouldLookup) return
    if (game.otherGamesFetchedAt && Date.now() - game.otherGamesFetchedAt < OTHER_GAMES_STALE_MS) return
    let cancelled = false
    setLoadingOthers(true)
    f95GamesByCreator(creatorName)
      .then((list) => { if (!cancelled) onCacheFields({ otherGames: list, otherGamesFetchedAt: Date.now() }) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingOthers(false) })
    return () => { cancelled = true; setLoadingOthers(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id, creatorName, shouldLookup, game.otherGamesFetchedAt])

  const otherGames = useMemo<OtherGameRow[]>(() => {
    const selfThread = f95ThreadId(game.link)
    const libByThread = new Map<number, ErogeItem>()
    for (const g of allGames) {
      const id = f95ThreadId(g.link)
      if (id) libByThread.set(id, g)
    }
    const rows: OtherGameRow[] = []
    const seenThreads = new Set<number>()
    const seenGames = new Set<string>([game.id])
    for (const o of [...(game.otherGames ?? []), ...(game.otherGamesFromPost ?? [])]) {
      if (o.threadId === selfThread || seenThreads.has(o.threadId)) continue
      seenThreads.add(o.threadId)
      const lib = libByThread.get(o.threadId)
      if (lib && seenGames.has(lib.id)) continue
      if (lib) seenGames.add(lib.id)
      rows.push({ key: `t${o.threadId}`, title: lib?.name ?? o.title, libGame: lib, url: f95ThreadUrl(o.threadId) })
    }
    const creatorKey = (game.creator ?? '').trim().toLowerCase()
    if (creatorKey) {
      for (const g of allGames) {
        if (seenGames.has(g.id) || (g.creator ?? '').trim().toLowerCase() !== creatorKey) continue
        seenGames.add(g.id)
        rows.push({ key: `g${g.id}`, title: g.name, libGame: g })
      }
    }
    return rows.sort((a, b) => Number(!!b.libGame) - Number(!!a.libGame) || a.title.localeCompare(b.title))
  }, [game.id, game.link, game.creator, game.otherGames, game.otherGamesFromPost, allGames])

  async function copyLink() {
    if (!game.link) return
    try { await navigator.clipboard.writeText(game.link); setFlash(BTN_COPY_OK) }
    catch { setFlash(BTN_COPY_FAIL) }
  }

  async function checkUpdate() {
    if (!game.link) return
    setChecking(true); setFlash('')
    const threadId = f95ThreadId(game.link)
    try {
      const lastChange = threadId ? (await cachedLastChanges([threadId])).get(threadId) : undefined
      const thread = threadId && lastChange ? await cachedThread(threadId, lastChange) : null
      if (thread && lastChange) {
        const patch = versionPatchFrom(game, thread, lastChange)
        onUpdateGame(patch as Partial<ErogeItem>)
        setFlash(patch.updateAvailable ? `New version: ${thread.version}` : BTN_UP_TO_DATE)
        setChecking(false)
        return
      }
    } catch {
      // Cache unreachable: read the thread directly below.
    }
    try {
      const res = await f95CheckVersion(game.link, f95Cookie)
      const different = isNewerVersion(res.version, game.version)
      onUpdateGame({
        latestVersion: res.version || game.latestVersion,
        threadUpdated: res.threadUpdated || game.threadUpdated,
        lastCheckedAt: Date.now(),
        updateAvailable: different,
        status: (res.status as ErogeItem['status']) || game.status,
      })
      setFlash(different ? `New version: ${res.version}` : BTN_UP_TO_DATE)
    } catch (err) {
      setFlash(`Error: ${(err as Error).message}`)
    }
    setChecking(false)
  }

  const links = [
    { url: game.link, service: 'f95' as const, label: 'F95Zone' },
    { url: game.dlsiteUrl, service: 'dlsite' as const, label: 'DLsite' },
    { url: game.steamUrl, service: 'steam' as const, label: 'Steam' },
    { url: game.itchUrl, service: 'itch' as const, label: 'itch.io' },
    { url: game.ryuugamesUrl, service: 'ryuugames' as const, label: 'Ryuugames' },
  ].filter((l) => !!l.url) as { url: string; service: 'f95' | 'dlsite' | 'steam' | 'itch' | 'ryuugames'; label: string }[]

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'saves', label: 'Saves', count: saves.length },
    ...(links.length > 0 ? [{ id: 'links' as const, label: 'Links', count: links.length }] : []),
    ...(otherGames.length > 0 || loadingOthers ? [{ id: 'more' as const, label: `More from ${creatorName || game.creator}`, count: otherGames.length }] : []),
  ]
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'overview'
  const hasUpdate = !!game.updateAvailable && !game.archived
  const facts = [
    game.backlogStatus ? { label: 'Progress', value: BACKLOG_LABEL[game.backlogStatus] } : null,
    game.version ? { label: 'Installed', value: game.version } : null,
    game.finishedVersion ? { label: 'Finished', value: game.finishedVersion } : null,
    game.latestVersion ? { label: 'Latest', value: game.latestVersion } : null,
    game.releaseDate ? { label: 'Released', value: game.releaseDate } : null,
    game.threadUpdated ? { label: 'Thread updated', value: game.threadUpdated } : null,
    game.language ? { label: 'Language', value: game.language } : null,
    game.dlsiteId ? { label: 'DLsite', value: game.dlsiteId } : null,
  ].filter((f): f is { label: string; value: string } => f !== null)

  const menu: { label: string; onClick: () => void; danger?: boolean }[] = [
    { label: game.favorite ? 'Remove from favorites' : 'Add to favorites', onClick: () => onUpdateGame({ favorite: !game.favorite }) },
    ...(game.link ? [
      { label: 'Copy F95 link', onClick: () => void copyLink() },
      { label: 'Open on F95Zone', onClick: () => window.open(game.link, '_blank', 'noreferrer') },
    ] : []),
    { label: game.archived ? 'Unarchive' : 'Archive (skip update checks)', onClick: () => onUpdateGame({ archived: !game.archived }) },
    { label: 'Delete', onClick: onDelete, danger: true },
  ]

  return (
    <div className="er-detail" ref={rootRef}>
      <header className="er-hero">
        <div className="er-hero-stage">
          {cover && <img className="er-hero-bg" src={cover} alt="" aria-hidden />}
          {cover
            ? <img className="er-hero-image zoomable" src={cover} alt={game.name} data-zoom-label="Cover" title="Click to view full size" />
            : <span className="er-hero-nocover">No cover</span>}
        </div>
        <div className="er-hero-body">
          <div className="er-hero-info">
            <div className="er-hero-chips">
              {game.status && <span className={`er-chip st-${game.status.toLowerCase()}`}>{game.status}</span>}
              {game.vn && <span className="er-chip">VN</span>}
              {game.favorite && <span className="er-chip fav">★ Favorite</span>}
              {game.archived && <span className="er-chip">Archived</span>}
              {hasUpdate && <span className="er-chip update">{game.latestVersion ? `${game.latestVersion} available` : 'Update available'}</span>}
            </div>
            <h1 className="er-hero-title">{game.name}</h1>
            {game.originalTitle && <div className="er-hero-original">{game.originalTitle}</div>}
            <div className="er-hero-meta">{[game.creator, game.engine, game.version].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="er-hero-actions">
              {isF95 && (
                <button className="er-btn er-btn-primary" onClick={checkUpdate} disabled={checking}>
                  {checking ? 'Checking…' : 'Check update'}
                </button>
              )}
              <button className="er-btn" onClick={onEdit}>Edit</button>
              <div className="er-menu-wrap">
                <button className="er-btn er-btn-icon" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>⋯</button>
                {menuOpen && (
                  <div className="er-menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                    {menu.map((m) => (
                      <button key={m.label} role="menuitem" className={m.danger ? 'danger' : ''} onClick={() => { setMenuOpen(false); m.onClick() }}>{m.label}</button>
                    ))}
                  </div>
                )}
              </div>
              {flash && <span className="er-hero-flash">{flash}</span>}
          </div>
        </div>
      </header>

      <nav className="er-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={activeTab === t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}{!!t.count && <span className="er-tab-count">{t.count}</span>}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <div className="er-overview">
          {facts.length > 0 && (
            <dl className="er-facts">
              {facts.map((f) => (
                <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>
              ))}
            </dl>
          )}
          {game.lastCheckedAt && (
            <p className="er-checked">
              {hasUpdate
                ? <>Version <b>{game.latestVersion}</b> is out. You have {game.version || 'no version set'}.</>
                : <>Up to date.</>}
              {' '}Checked {new Date(game.lastCheckedAt).toLocaleString()}.
            </p>
          )}
          {game.tags && game.tags.length > 0 && (
            <div className="er-detail-tags">
              {game.tags.map((t) => {
                const key = t.toLowerCase()
                const cls = tagPrefs?.avoided.has(key) ? 'avoided' : tagPrefs?.preferred.has(key) ? 'liked' : ''
                return <span key={t} className={`er-detail-tag ${cls}`}>{t}</span>
              })}
            </div>
          )}
          {game.description
            ? <div className="er-detail-desc">{renderDescription(game.description)}</div>
            : <p className="er-empty-note">No description yet. Import from F95 or add one in Edit.</p>}
        </div>
      )}

      {activeTab === 'saves' && (
        <div className="er-panel">
          {saves.length === 0 ? (
            <div className="er-saves-empty">
              <span className="er-saves-empty-icon" aria-hidden>💾</span>
              <p>No saves stored yet. Keep copies of your save files here, in a folder that's only for this game.</p>
              <div className="er-panel-actions">
                <button className="er-btn er-btn-primary" onClick={async () => { await savesAdd(game.name); refreshSaves() }}>+ Add save files</button>
                <button className="er-btn" onClick={() => savesOpenFolder(game.name)}>Open folder</button>
              </div>
            </div>
          ) : (
            <>
              <div className="er-panel-head">
                <span>{saves.length} save{saves.length === 1 ? '' : 's'} · {formatBytes(saves.reduce((n, x) => n + x.size, 0))}</span>
                <div className="er-panel-actions">
                  <button className="er-btn er-btn-sm er-btn-primary" onClick={async () => { await savesAdd(game.name); refreshSaves() }}>+ Add</button>
                  <button className="er-btn er-btn-sm" onClick={() => savesOpenFolder(game.name)}>Open folder</button>
                  <button className="er-btn er-btn-sm er-btn-danger" onClick={async () => { if (confirm('Delete all saves?')) { await savesDeleteAll(game.name); refreshSaves() } }}>Delete all</button>
                </div>
              </div>
              {saves.map((s) => (
                <div key={s.name} className="er-save-row">
                  <span className="er-save-icon" aria-hidden>▤</span>
                  <div className="er-save-main">
                    <span className="er-save-name" title={s.name}>{s.name}</span>
                    <span className="er-save-sub">{formatBytes(s.size)} · {formatDateTime(new Date(s.mtime).toISOString())}</span>
                  </div>
                  <div className="er-save-actions">
                    <button className="er-btn er-btn-sm" onClick={() => savesReveal(game.name, s.name)}>View</button>
                    <button className="er-btn er-btn-sm er-btn-danger" aria-label={`Delete ${s.name}`} onClick={async () => { if (confirm(`Delete ${s.name}?`)) { await savesDelete(game.name, s.name); refreshSaves() } }}>×</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === 'links' && (
        <div className="er-panel">
          {links.map((l) => (
            <a key={l.service} href={l.url} target="_blank" rel="noreferrer" className="er-link">
              <span className="er-link-icon" aria-hidden="true"><ServiceLogo service={l.service} size={22} /></span>
              <span className="er-link-label">{l.label}</span>
              <span className="er-link-url">{l.url}</span>
            </a>
          ))}
        </div>
      )}

      {activeTab === 'more' && (
        otherGames.length === 0 ? (
          <p className="er-empty-note">Looking up other games on F95…</p>
        ) : (
          <div className="er-other-grid">
            {otherGames.map((row) => row.libGame ? (
              <button key={row.key} type="button" className="er-card er-other-card" onClick={() => onOpenGame(row.libGame!.id)} title={row.title}>
                <div className="gc-banner">
                  {row.libGame.coverFile
                    ? <img src={assetUrl('cover', row.libGame.coverFile)} alt="" loading="lazy" />
                    : <div className="gc-nocover">No cover</div>}
                </div>
                <div className="gc-info"><div className="gc-name">{row.title}</div></div>
              </button>
            ) : (
              <a key={row.key} className="er-card er-other-card" href={row.url} target="_blank" rel="noreferrer" title={`${row.title} — open on F95Zone`}>
                <div className="gc-banner">
                  <div className="gc-nocover er-other-f95"><ServiceLogo service="f95" size={44} /></div>
                </div>
                <div className="gc-info"><div className="gc-name">{row.title}</div></div>
              </a>
            ))}
          </div>
        )
      )}
    </div>
  )
}
