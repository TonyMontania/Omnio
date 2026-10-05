// Main Eroges view. Owns the plugin's persisted state and publishes
// pageMeta (title / count / chips / actions) into Omnio's topnav via
// the `setPageMeta` prop — the plugin thus looks identical to any
// native library page (Games, Anime, etc.) instead of drawing its
// own separate header row.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ErogeItem, ErogeData, BacklogStatus } from './types'
import type { PluginViewProps } from '../registry'
import { SLUG } from './constants'
import { loadData, saveData, savesRenameFolder, assetRename, assetDelete, savesDeleteAll, transcodeStoredAvif } from './ipc'
import { f95CheckVersion } from './f95Api'
import { reportPluginCount } from '../counts'
import ErogeCard from './ErogeCard'
import ErogeRow from './ErogeRow'
import ErogeDetailView from './ErogeDetailView'
import ErogeEditor from './ErogeEditor'
import './eroges.css'

type Tab =
  | { kind: 'all' }
  | { kind: 'backlog'; value: BacklogStatus }
  | { kind: 'updates' }

type Layout = 'grid' | 'list'

const emptyData: ErogeData = { games: [] }

const HeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

export default function ErogesView({ setPageMeta, cardFields }: PluginViewProps) {
  const [data, setData] = useState<ErogeData>(emptyData)
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>({ kind: 'all' })
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'az' | 'creator' | 'status' | 'engine' | 'releaseDate' | 'updated'>('az')
  const [layout, setLayout] = useState<Layout>('grid')
  const [checkingAll, setCheckingAll] = useState<{ done: number; total: number } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)   // 'new' | game.id

  useEffect(() => { void (async () => { setData(await loadData()); setLoaded(true) })() }, [])

  // One-time sweep: covers downloaded before AVIF transcoding existed.
  useEffect(() => {
    if (!loaded) return
    const pending = data.games.filter((g) => g.coverFile && /\.avif$/i.test(g.coverFile))
    if (pending.length === 0) return
    void (async () => {
      for (const g of pending) {
        const res = await transcodeStoredAvif('cover', g.coverFile!)
        if (res.ok && res.filename !== g.coverFile) {
          setData((d) => ({ ...d, games: d.games.map((x) => x.id === g.id ? { ...x, coverFile: res.filename } : x) }))
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])
  useEffect(() => { if (loaded) void saveData(data) }, [data, loaded])
  useEffect(() => { reportPluginCount(SLUG, data.games.length) }, [data.games.length])

  // Reset detail whenever the user navigates away or the game is gone.
  useEffect(() => {
    if (detailId && !data.games.find((g) => g.id === detailId)) setDetailId(null)
  }, [data.games, detailId])

  const counts = useMemo(() => ({
    all: data.games.length,
    playing: data.games.filter((g) => g.backlogStatus === 'playing').length,
    backlog: data.games.filter((g) => g.backlogStatus === 'backlog').length,
    played: data.games.filter((g) => g.backlogStatus === 'played').length,
    updates: data.games.filter((g) => g.updateAvailable).length,
  }), [data.games])

  const tabGames = useMemo(() => {
    if (tab.kind === 'backlog') return data.games.filter((g) => g.backlogStatus === tab.value)
    if (tab.kind === 'updates') return data.games.filter((g) => g.updateAvailable)
    return data.games
  }, [data.games, tab])

  const visible = useMemo(() => {
    let list = tabGames
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q) || (g.creator ?? '').toLowerCase().includes(q))
    }
    const s = [...list]
    if (sort === 'az') s.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'creator') s.sort((a, b) => (a.creator ?? '').localeCompare(b.creator ?? '') || a.name.localeCompare(b.name))
    else if (sort === 'status') s.sort((a, b) => (a.status ?? '').localeCompare(b.status ?? '') || a.name.localeCompare(b.name))
    else if (sort === 'engine') s.sort((a, b) => (a.engine ?? '').localeCompare(b.engine ?? '') || a.name.localeCompare(b.name))
    else if (sort === 'releaseDate') s.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
    else if (sort === 'updated') s.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    return s
  }, [tabGames, search, sort])

  // -- publish pageMeta into Omnio's topnav -----------------------
  const detailGame = detailId ? data.games.find((g) => g.id === detailId) ?? null : null
  useEffect(() => {
    if (detailGame) {
      setPageMeta({
        icon: <HeartIcon />,
        title: detailGame.name,
        onBack: () => setDetailId(null),
      })
      return
    }
    const chips = [
      { key: 'playing', label: 'Playing', count: counts.playing, active: tab.kind === 'backlog' && tab.value === 'playing', onClick: () => { setTab({ kind: 'backlog', value: 'playing' }) } },
      { key: 'backlog', label: 'Backlog', count: counts.backlog, active: tab.kind === 'backlog' && tab.value === 'backlog', onClick: () => { setTab({ kind: 'backlog', value: 'backlog' }) } },
      { key: 'played', label: 'Played', count: counts.played, active: tab.kind === 'backlog' && tab.value === 'played', onClick: () => { setTab({ kind: 'backlog', value: 'played' }) } },
      { key: 'updates', label: 'Updates', count: counts.updates, active: tab.kind === 'updates', onClick: () => { setTab({ kind: 'updates' }) } },
    ]
    // Title changes when a filter chip is active — same pattern as
    // Omnio's board views (click "Playing" → title becomes "Playing"
    // and the count reflects only that subset).
    const activeChip = chips.find((c) => c.active)
    const title = activeChip ? activeChip.label : 'Eroges'
    const onBack = activeChip ? () => setTab({ kind: 'all' }) : undefined
    const actions = (
      <>
        <div className="view-toggle">
          <button className={layout === 'list' ? 'active' : ''} onClick={() => setLayout('list')}>☰ List</button>
          <button className={layout === 'grid' ? 'active' : ''} onClick={() => setLayout('grid')}>▦ Grid</button>
        </div>
        <button className="secondary-btn" onClick={() => setShowSettings(true)} title="Settings (F95 cookies)">⚙</button>
        <button className="secondary-btn" onClick={checkAllUpdates} disabled={!!checkingAll}
          title={`Check updates for the games in ${title} with an F95 link`}>
          {checkingAll ? `Checking ${checkingAll.done}/${checkingAll.total}…` : '↻ Update'}
        </button>
        <button className="add-btn" onClick={() => setEditingId('new')}>+ Add</button>
      </>
    )
    setPageMeta({
      icon: <HeartIcon />, title,
      count: { n: visible.length, unit: visible.length === 1 ? 'item' : 'items' },
      onBack,
      chips,
      actions,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailGame, tab, tabGames, counts, visible.length, setPageMeta, layout, checkingAll])

  // -- mutations ---------------------------------------------------
  function upsertGame(g: ErogeItem) {
    setData((d) => {
      const prev = d.games.find((x) => x.id === g.id)
      const games = prev ? d.games.map((x) => x.id === g.id ? g : x) : [...d.games, g]
      if (prev && prev.name !== g.name) {
        void assetRename('cover', `${prev.name} cover`, `${g.name} cover`).then((newFile) => {
          if (newFile) setData((dd) => ({ ...dd, games: dd.games.map((x) => x.id === g.id ? { ...x, coverFile: newFile } : x) }))
        })
        void savesRenameFolder(prev.name, g.name)
      }
      return { ...d, games }
    })
    setEditingId(null)
  }

  function patchGame(id: string, patch: Partial<ErogeItem>) {
    setData((d) => ({ ...d, games: d.games.map((g) => g.id === id ? { ...g, ...patch, updatedAt: Date.now() } : g) }))
  }

  // Cached lookups aren't user edits — leave updatedAt alone.
  function cacheGameFields(id: string, patch: Partial<ErogeItem>) {
    setData((d) => ({ ...d, games: d.games.map((g) => g.id === id ? { ...g, ...patch } : g) }))
  }

  // Stable callbacks for the grid — passing an inline arrow per card
  // creates a fresh function reference every render and defeats the
  // memoisation on <ErogeCard> / <ErogeRow>. Wrapping in useCallback
  // lets the memo actually short-circuit unchanged rows.
  const openDetail = useCallback((id: string) => setDetailId(id), [])
  const toggleFavorite = useCallback((id: string) => {
    setData((d) => ({ ...d, games: d.games.map((g) => g.id === id ? { ...g, favorite: !g.favorite, updatedAt: Date.now() } : g) }))
  }, [])

  function deleteGame(id: string) {
    const target = data.games.find((g) => g.id === id)
    if (target) {
      const coverBase = `${target.name || 'game'} cover`
      void assetDelete('cover', coverBase)
      void savesDeleteAll(target.name || '')
    }
    setData((d) => ({ ...d, games: d.games.filter((g) => g.id !== id) }))
    setDetailId(null)
  }

  // Check F95 for updates across every game with a matching link.
  //
  // Old behaviour: sequential + 250ms sleep between requests. On a
  // library of 100 games that was ~2.5 minutes of pure wall time
  // (fetch + parse + sleep, ×100). Reasons it was slow:
  //   1. Every request paid its own TLS handshake — the Rust
  //      `net:fetch-text` handler built a fresh reqwest client per
  //      call, so connection pooling was off (the Rust side now uses
  //      the shared client instead — same-host requests reuse TCP).
  //   2. One-at-a-time meant even fast responses stacked latency.
  //   3. The sleep alone burned ~25 s per 100 games.
  //
  // New behaviour: `CONCURRENCY` workers pull from a shared index and
  // apply each patch as soon as it lands (progress bar advances live,
  // "Updates" tab count jumps as they arrive). The 250ms sleep is
  // gone — the parallel cap already spaces things out, and every
  // request now reuses the pooled HTTPS connection. On 100 games this
  // is roughly a 6–8× speedup end-to-end.
  const UPDATE_CHECK_CONCURRENCY = 4
  async function checkAllUpdates() {
    const targets = tabGames.filter((g) => g.link && /f95zone/i.test(g.link))
    if (targets.length === 0) { alert('No games with an F95 link in this view.'); return }
    setCheckingAll({ done: 0, total: targets.length })
    const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase()
    const cookie = data.settings?.f95Cookie
    let nextIdx = 0
    let done = 0

    async function worker() {
      for (;;) {
        const myIdx = nextIdx++
        if (myIdx >= targets.length) return
        const g = targets[myIdx]
        try {
          const res = await f95CheckVersion(g.link!, cookie)
          const different = !!res.version && !!g.version && norm(res.version) !== norm(g.version)
          const patch: Partial<ErogeItem> = {
            latestVersion: res.version || g.latestVersion,
            threadUpdated: res.threadUpdated || g.threadUpdated,
            lastCheckedAt: Date.now(),
            updateAvailable: different,
            status: (res.status as ErogeItem['status']) || g.status,
          }
          // Apply the patch immediately so the "Updates" tab count and
          // any per-card badge react as results stream in. React 18
          // batches these across the microtask boundary between awaits.
          setData((d) => ({ ...d, games: d.games.map((x) => x.id === g.id ? { ...x, ...patch } : x) }))
        } catch { /* silently skip failures — surfacing one toast per
                     failed game would drown the user in noise */ }
        done += 1
        setCheckingAll({ done, total: targets.length })
      }
    }

    const workerCount = Math.min(UPDATE_CHECK_CONCURRENCY, targets.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
    setCheckingAll(null)
  }

  // -- render ------------------------------------------------------
  const editingGame = editingId && editingId !== 'new' ? data.games.find((g) => g.id === editingId) : null

  return (
    <div className="er-view">
      {detailGame ? (
        <ErogeDetailView
          game={detailGame}
          f95Cookie={data.settings?.f95Cookie}
          onEdit={() => setEditingId(detailGame.id)}
          onDelete={() => { if (confirm(`Delete "${detailGame.name}"?`)) deleteGame(detailGame.id) }}
          onUpdateGame={(patch) => patchGame(detailGame.id, patch)}
          onCacheFields={(patch) => cacheGameFields(detailGame.id, patch)}
          allGames={data.games}
          onOpenGame={openDetail}
        />
      ) : (
        <>
          <div className="toolbar">
            <input
              className="search-input"
              placeholder="Search by title... (Ctrl+F)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="az">Alphabetical</option>
              <option value="creator">By creator</option>
              <option value="updated">Most recent</option>
              <option value="status">Status</option>
              <option value="engine">Engine</option>
              <option value="releaseDate">Release date</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="er-empty">No games in this view.</div>
          ) : layout === 'list' ? (
            <div className="er-list">
              {visible.map((g) => (
                <ErogeRow
                  key={g.id}
                  game={g}
                  onOpen={openDetail}
                  onToggleFav={toggleFavorite}
                  cardFields={cardFields}
                />
              ))}
            </div>
          ) : (
            <div className="er-grid">
              {visible.map((g) => (
                <ErogeCard
                  key={g.id}
                  game={g}
                  onOpen={openDetail}
                  onToggleFav={toggleFavorite}
                  cardFields={cardFields}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editingId && (
        <ErogeEditor
          initial={editingGame}
          allGames={data.games}
          f95Cookie={data.settings?.f95Cookie}
          onSave={upsertGame}
          onCancel={() => setEditingId(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          initial={data.settings?.f95Cookie ?? ''}
          onSave={async (cookie) => {
            // Persist the whole data blob synchronously here instead
            // of relying on the debounced save-on-change useEffect —
            // avoids a race where the app is closed before that
            // effect fires and the cookie gets lost.
            //
            // Serialize the cookie as an empty string when cleared,
            // not `undefined`: some JSON round-trips (Tauri IPC,
            // JSON.stringify) drop undefined values entirely, so the
            // stored field would end up missing rather than empty.
            const trimmed = cookie.trim()
            const nextData: ErogeData = {
              ...data,
              settings: { ...data.settings, f95Cookie: trimmed },
            }
            setData(nextData)
            setShowSettings(false)
            try {
              await saveData(nextData)
            } catch (err) {
              alert(`No pude guardar el cookie: ${(err as Error).message}`)
            }
          }}
          onCancel={() => setShowSettings(false)}
        />
      )}


    </div>
  )
}

// -- inline mini modals ------------------------------------------

function SettingsModal({ initial, onSave, onCancel }: {
  initial: string
  onSave: (cookie: string) => void
  onCancel: () => void
}) {
  const [cookie, setCookie] = useState(initial)
  return (
    <div className="er-modal-backdrop" onClick={onCancel}>
      <div className="er-modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <h2>Eroges settings</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>
          F95 hides store links from anonymous visitors. By pasting your session cookies, the importer
          can read the DLsite / Steam links automatically.
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5, margin: '0 0 12px' }}>
          How to get them: on F95 (logged in) → DevTools (F12) → Application → Cookies → f95zone.to.
          Copy the values of <code>xf_user</code> and <code>xf_session</code> and paste them below in this format:
        </p>
        <pre style={{ background: 'var(--bg)', color: 'var(--text-dim)', fontSize: 11, padding: 8, borderRadius: 6, margin: '0 0 12px', overflow: 'auto' }}>xf_user=&lt;value&gt;; xf_session=&lt;value&gt;</pre>
        <label style={{ display: 'block', color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
          Cookie header
          <textarea
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            rows={4}
            placeholder="xf_user=1234%2C....; xf_session=abcdef..."
            style={{
              display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box',
              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 10px', fontFamily: 'var(--font-mono, monospace)',
              fontSize: 12, resize: 'vertical',
            }}
          />
        </label>
        <p style={{ color: 'var(--text-faint)', fontSize: 11, margin: '0 0 12px' }}>
          Saved only in your Omnio data folder (<code>data/plugins/eroges.json</code>). It never leaves your machine.
        </p>
        <div className="er-modal-actions">
          <button className="er-btn" onClick={onCancel}>Cancel</button>
          {initial && <button className="er-btn er-btn-danger" onClick={() => onSave('')}>Clear</button>}
          <button className="er-btn er-btn-primary" onClick={() => onSave(cookie)}>Save</button>
        </div>
      </div>
    </div>
  )
}
