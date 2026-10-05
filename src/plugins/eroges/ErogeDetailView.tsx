import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { ErogeItem } from './types'
import { assetUrl, savesList, savesAdd, savesDelete, savesOpenFolder, savesReveal, savesDeleteAll } from './ipc'
import type { SaveInfo } from './ipc'
import { f95CheckVersion, f95GamesByCreator, f95ThreadId, f95ThreadUrl } from './f95Api'
import { engineClass } from './constants'
import ServiceLogo from '../../components/ServiceLogo'

interface Props {
  game: ErogeItem
  f95Cookie?: string
  onEdit: () => void
  onDelete: () => void
  onUpdateGame: (patch: Partial<ErogeItem>) => void
  onCacheFields: (patch: Partial<ErogeItem>) => void
  allGames: ErogeItem[]
  onOpenGame: (id: string) => void
}

interface OtherGameRow {
  key: string
  title: string
  libGame?: ErogeItem
  url?: string
}

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

export default function ErogeDetailView({ game, f95Cookie, onEdit, onDelete, onUpdateGame, onCacheFields, allGames, onOpenGame }: Props) {
  const [saves, setSaves] = useState<SaveInfo[]>([])
  const [checking, setChecking] = useState(false)
  const [flash, setFlash] = useState('')
  const [loadingOthers, setLoadingOthers] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const refreshSaves = useCallback(async () => { setSaves(await savesList(game.name)) }, [game.name])
  useEffect(() => { void refreshSaves() }, [refreshSaves])

  useEffect(() => {
    rootRef.current?.closest('.er-view')?.scrollTo({ top: 0 })
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
    try {
      const res = await f95CheckVersion(game.link, f95Cookie)
      const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase()
      const different = !!res.version && !!game.version && norm(res.version) !== norm(game.version)
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

  return (
    <div className="er-detail" ref={rootRef}>
      <div className="er-detail-head">
        {game.vn && <span className="er-tag eng-vn">VN</span>}
        {game.engine && <span className={`er-tag eng-${engineClass(game.engine)}`}>{game.engine}</span>}
        {game.status && <span className={`er-tag st-${game.status.toLowerCase()}`}>{game.status}</span>}
        <div className="er-detail-title">
          {game.name}
          {game.version && <span className="er-detail-version">[{game.version}]</span>}
          {game.originalTitle && <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 400, marginTop: 2 }}>{game.originalTitle}</div>}
        </div>
        <div className="er-detail-actions">
          {game.link && <button className="er-btn" onClick={copyLink}>Copy F95</button>}
          {isF95 && <button className="er-btn" onClick={checkUpdate} disabled={checking}>{checking ? 'Checking…' : 'Check update'}</button>}
          <button className="er-btn" onClick={onEdit}>Edit</button>
          <button className="er-btn er-btn-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div className="er-detail-cover-wrap">
        {cover
          ? <img className="er-detail-cover" src={cover} alt="cover" />
          : <div className="er-detail-nocover">No cover</div>}
      </div>

      <div className="er-detail-meta">
        {game.creator && <span><b>Creator:</b>{game.creator}</span>}
        {game.releaseDate && <span><b>Date:</b>{game.releaseDate}</span>}
        {game.language && <span><b>Language:</b>{game.language}</span>}
        {game.backlogStatus && <span><b>Progress:</b>{BACKLOG_LABEL[game.backlogStatus]}</span>}
        {game.dlsiteId && <span><b>DLSITE:</b>{game.dlsiteId}</span>}
        {game.threadUpdated && <span><b>Thread updated:</b>{game.threadUpdated}</span>}
        {game.favorite && <span style={{ color: 'var(--accent)' }}>★ Favorite</span>}
      </div>

      {(game.latestVersion || game.lastCheckedAt) && (
        <div className={`er-update-info ${game.updateAvailable ? 'has-update' : ''}`}>
          {game.updateAvailable
            ? <>New version available: <b>{game.latestVersion}</b> (you have <b>{game.version || '—'}</b>) </>
            : <>You're on the latest version ({game.latestVersion || game.version || '—'})</>}
          {game.lastCheckedAt && <span className="er-uc-when">— checked {new Date(game.lastCheckedAt).toLocaleString()}</span>}
        </div>
      )}

      {flash && <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{flash}</div>}

      {game.description && (
        <div className="er-detail-desc">{renderDescription(game.description)}</div>
      )}

      {(game.link || game.dlsiteUrl || game.steamUrl || game.itchUrl || game.ryuugamesUrl) && (
        <div className="er-links">
          {game.link && (
            <a href={game.link} target="_blank" rel="noreferrer" className="er-link">
              <span className="er-link-icon" title="F95Zone" aria-hidden="true"><ServiceLogo service="f95" size={22} /></span>
              <span className="er-link-url">{game.link}</span>
            </a>
          )}
          {game.dlsiteUrl && (
            <a href={game.dlsiteUrl} target="_blank" rel="noreferrer" className="er-link">
              <span className="er-link-icon" title="DLsite" aria-hidden="true"><ServiceLogo service="dlsite" size={22} /></span>
              <span className="er-link-url">{game.dlsiteUrl}</span>
            </a>
          )}
          {game.steamUrl && (
            <a href={game.steamUrl} target="_blank" rel="noreferrer" className="er-link">
              <span className="er-link-icon" title="Steam" aria-hidden="true"><ServiceLogo service="steam" size={22} /></span>
              <span className="er-link-url">{game.steamUrl}</span>
            </a>
          )}
          {game.itchUrl && (
            <a href={game.itchUrl} target="_blank" rel="noreferrer" className="er-link">
              <span className="er-link-icon" title="itch.io" aria-hidden="true"><ServiceLogo service="itch" size={22} /></span>
              <span className="er-link-url">{game.itchUrl}</span>
            </a>
          )}
          {game.ryuugamesUrl && (
            <a href={game.ryuugamesUrl} target="_blank" rel="noreferrer" className="er-link">
              <span className="er-link-icon" title="Ryuugames" aria-hidden="true"><ServiceLogo service="ryuugames" size={22} /></span>
              <span className="er-link-url">{game.ryuugamesUrl}</span>
            </a>
          )}
        </div>
      )}

      {(otherGames.length > 0 || loadingOthers) && (
        <div className="er-other-games">
          <h3>
            More from {creatorName || game.creator}
            {otherGames.length > 0 && <span className="er-other-count">{otherGames.length}</span>}
          </h3>
          {otherGames.length === 0 ? (
            <div className="er-other-hint">Looking up other games on F95…</div>
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
          )}
        </div>
      )}

      <div className="er-detail-saves">
        <div className="er-saves-header">
          <h3>Savefiles ({saves.length})</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="er-btn er-btn-sm" onClick={async () => { await savesAdd(game.name); refreshSaves() }}>+ Add</button>
            <button className="er-btn er-btn-sm" onClick={() => savesOpenFolder(game.name)}>Open folder</button>
            {saves.length > 0 && <button className="er-btn er-btn-sm er-btn-danger" onClick={async () => { if (confirm('Delete all saves?')) { await savesDeleteAll(game.name); refreshSaves() } }}>Delete all</button>}
          </div>
        </div>
        <div className="er-saves-list">
          {saves.length === 0 && <div className="er-saves-empty">No saves stored.</div>}
          {saves.map((s) => (
            <div key={s.name} className="er-save-row">
              <span className="er-save-name" title={s.name}>{s.name}</span>
              <div className="er-save-actions">
                <button className="er-btn er-btn-sm" onClick={() => savesReveal(game.name, s.name)}>View</button>
                <button className="er-btn er-btn-sm er-btn-danger" onClick={async () => { if (confirm(`Delete ${s.name}?`)) { await savesDelete(game.name, s.name); refreshSaves() } }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
