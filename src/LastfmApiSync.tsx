// Last.fm Sync (API mode).
//
// Alternative to the CSV-based LastfmImporter: no export tool needed,
// just an API key + username in Settings. Calls `user.getTopAlbums`
// and matches results against the Music library by artist + title.
// Accepting a match marks the album as consumed and appends a note
// entry to its History log with the playcount and today's date.
//
// Never overwrites an existing "Last.fm" note on the same album —
// re-runs skip already-synced items so playcounts don't compound.

import { useMemo, useState } from 'react'
import type { Item, RewatchEntry } from './types'
import { assetSrc } from './types'

interface Props {
  existingItems: Item[]
  apiKey: string
  username: string
  onPatch: (patches: { id: string; consumed: true; rewatches: RewatchEntry[] }[]) => void
  onClose: () => void
}

type Period = 'overall' | '7day' | '1month' | '3month' | '6month' | '12month'

interface RawTopAlbum {
  name: string
  playcount: string
  artist?: { name?: string }
  image?: { size?: string; '#text'?: string }[]
  url?: string
}

interface Row {
  key: string
  rank: number
  artist: string
  album: string
  playcount: number
  imageUrl?: string
  matchedId?: string
}

function normalize(s: string): string {
  return s.toLowerCase()
    // Strip common bracket suffixes ("[Deluxe]", "(Remastered 2022)")
    // so a scrobbled Deluxe Edition matches the plain library entry.
    .replace(/[\[(][^)\]]{1,30}[\])]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function findMatch(existing: Item[], artist: string, album: string): Item | undefined {
  const artistN = normalize(artist)
  const albumN = normalize(album)
  const musicItems = existing.filter((i) => i.categoryId === 'musica')
  const exact = musicItems.find((m) => normalize(m.artist ?? '') === artistN && normalize(m.title) === albumN)
  if (exact) return exact
  const artistMatches = musicItems.filter((m) => normalize(m.artist ?? '') === artistN)
  return artistMatches.find((m) => {
    const t = normalize(m.title)
    return t.includes(albumN) || albumN.includes(t)
  })
}

function pickImage(images?: { size?: string; '#text'?: string }[]): string | undefined {
  if (!images) return undefined
  const preferred = images.find((i) => i.size === 'large' || i.size === 'medium')
  const chosen = preferred ?? images[images.length - 1]
  const url = chosen?.['#text']?.trim()
  return url && url.length > 10 ? url : undefined
}

const PERIOD_LABELS: Record<Period, string> = {
  overall: 'Overall (all time)',
  '7day': 'Last 7 days',
  '1month': 'Last month',
  '3month': 'Last 3 months',
  '6month': 'Last 6 months',
  '12month': 'Last 12 months',
}

export default function LastfmApiSync({ existingItems, apiKey, username, onPatch, onClose }: Props) {
  const [period, setPeriod] = useState<Period>('overall')
  const [limit, setLimit] = useState<number>(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const musicById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const it of existingItems) if (it.categoryId === 'musica') m.set(it.id, it)
    return m
  }, [existingItems])

  const fetchAndMatch = async () => {
    if (!apiKey.trim() || !username.trim()) {
      setError('Set your Last.fm API key and username in Settings first.')
      return
    }
    setLoading(true); setError(null); setRows([])
    try {
      const res = await window.ipcRenderer.invoke('lastfm:top_albums', apiKey.trim(), username.trim(), limit, period) as
        | { ok: true; data: { topalbums?: { album?: RawTopAlbum[] } } }
        | { ok: false; error: string }
      if (!res?.ok) { setError(res?.error ?? 'Fetch failed'); return }
      const raw = res.data.topalbums?.album ?? []
      const parsed: Row[] = raw.map((a, i) => {
        const artistName = a.artist?.name ?? ''
        const albumName = a.name
        const match = findMatch(existingItems, artistName, albumName)
        return {
          key: crypto.randomUUID(),
          rank: i + 1,
          artist: artistName,
          album: albumName,
          playcount: parseInt(a.playcount ?? '0', 10) || 0,
          imageUrl: pickImage(a.image),
          matchedId: match?.id,
        }
      }).filter((r) => r.artist && r.album)
      setRows(parsed)
      setSelected(new Set(parsed.filter((r) => r.matchedId).map((r) => r.key)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const setMatch = (key: string, id: string) => setRows((rs) => rs.map((r) => r.key === key ? { ...r, matchedId: id || undefined } : r))
  const matchedCount = useMemo(() => rows.filter((r) => r.matchedId).length, [rows])

  const handleImport = () => {
    const today = new Date().toISOString().slice(0, 10)
    const patches: { id: string; consumed: true; rewatches: RewatchEntry[] }[] = []
    const seen = new Set<string>()
    for (const r of rows) {
      if (!selected.has(r.key) || !r.matchedId) continue
      if (seen.has(r.matchedId)) continue
      seen.add(r.matchedId)
      const existing = musicById.get(r.matchedId)
      if (!existing) continue
      const existingLog = existing.rewatches ?? []
      const alreadyLogged = existingLog.some((e) => (e.notes ?? '').includes('Last.fm'))
      if (alreadyLogged) continue
      const entry: RewatchEntry = {
        id: crypto.randomUUID(),
        date: today,
        kind: 'note',
        notes: `${r.playcount} plays on Last.fm (${PERIOD_LABELS[period]})`,
      }
      patches.push({
        id: r.matchedId,
        consumed: true,
        rewatches: [...existingLog, entry],
      })
    }
    if (patches.length > 0) onPatch(patches)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '94vw', maxHeight: '86vh' }}>
        <div className="modal-header">
          <h2>Sync from Last.fm</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Pulls your top-scrobbled albums for the selected period and matches them against your Music library
            by artist + title. Accepting a match marks the album as <em>listened</em> and appends a note entry to its
            history log with the playcount and today's date. Nothing on Last.fm is touched.
          </p>

          <div className="importer-summary" style={{ marginTop: 4 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>Period</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                  <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>Limit</span>
              <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
                {[25, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className="secondary-btn" onClick={fetchAndMatch} disabled={loading}>
              {loading ? 'Fetching…' : 'Fetch top albums'}
            </button>
          </div>

          {error && <p className="save-files-error">{error}</p>}

          {rows.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{rows.length} albums</span>
                <span className="importer-new">{matchedCount} matched</span>
                <span className="importer-dupe">{rows.length - matchedCount} unmatched</span>
                <div className="importer-select-actions">
                  <button type="button" onClick={() => setSelected(new Set(rows.filter((r) => r.matchedId).map((r) => r.key)))}>Select matched</button>
                  <button type="button" onClick={() => setSelected(new Set())}>Select none</button>
                </div>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th style={{ width: 40 }}>#</th>
                      <th style={{ width: 44 }}></th>
                      <th>Artist — Album</th>
                      <th style={{ width: 80 }}>Plays</th>
                      <th>Library match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const match = r.matchedId ? musicById.get(r.matchedId) : undefined
                      return (
                        <tr key={r.key} className={match ? '' : 'dupe'}>
                          <td><input type="checkbox" checked={selected.has(r.key)} disabled={!r.matchedId} onChange={() => toggle(r.key)} /></td>
                          <td>{r.rank}</td>
                          <td>
                            {r.imageUrl
                              ? <img src={r.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: 3, display: 'block', objectFit: 'cover' }} />
                              : <span style={{ width: 34, height: 34, background: 'var(--surface-2)', display: 'inline-block', borderRadius: 3 }} />}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.album}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{r.artist}</div>
                          </td>
                          <td><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{r.playcount}</span></td>
                          <td>
                            <select value={r.matchedId ?? ''} onChange={(e) => setMatch(r.key, e.target.value)}>
                              <option value="">— no match —</option>
                              {Array.from(musicById.values()).map((m) => (
                                <option key={m.id} value={m.id}>{m.artist ? `${m.artist} — ${m.title}` : m.title}</option>
                              ))}
                            </select>
                            {match?.cover && <img src={assetSrc(match.cover)} alt="" style={{ width: 20, height: 20, marginLeft: 6, borderRadius: 2, verticalAlign: 'middle', objectFit: 'cover' }} />}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {rows.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-btn" disabled={selected.size === 0} onClick={handleImport}>
              Patch {selected.size} album{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
