// Discogs collection importer → Music library.
//
// Reads a user's Discogs collection (folder 0 = "All") via the public
// API through the discogs:collection IPC proxy. Public collections work
// with just a username; private ones need a Personal Access Token from
// Settings → Developers on discogs.com.
//
// Each release comes back with basic_information (title, artists, year,
// labels, cover_image, formats, genres, styles) plus per-user data
// (rating on a 0-5 scale, date_added). We map to Music items — Omnio's
// title = release title, artist = joined artist names, releaseYear,
// label, genres (merged with styles for the classic Discogs feel).
// Cover URLs are stored as-is (remote); the user can re-fetch via
// MusicBrainz / VGMdb after import if they want on-disk copies.

import { useMemo, useState } from 'react'
import type { Item, MusicType } from './types'

interface Props {
  existingItems: Item[]
  onImport: (result: {
    updates: Map<string, Partial<Item>>
    creates: Item[]
  }) => void
  onClose: () => void
}

// Shape we keep locally after normalizing each Discogs release. Rating on
// the Discogs 0-5 scale maps 1:1 to Omnio's rating field.
type Release = {
  key: string           // `${artistLc}::${titleLc}`
  discogsId: number
  title: string
  artist: string
  year?: string
  label?: string
  genres?: string[]
  formats?: string[]
  coverUrl?: string
  rating?: number
  dateAdded?: string
}

// Discogs artist names can carry disambiguation suffixes like "Radiohead (2)".
// Strip trailing "(N)" so the artist matches how MusicBrainz / AniList /
// the user themselves would write it.
function cleanArtistName(raw: string): string {
  return raw.replace(/\s*\(\d+\)\s*$/, '').trim()
}

function joinArtists(list: { name?: string; join?: string; anv?: string }[] | undefined): string {
  if (!list || list.length === 0) return ''
  const parts: string[] = []
  for (const a of list) {
    const name = cleanArtistName(a.anv || a.name || '')
    if (name) parts.push(name)
    if (a.join && a.join.trim()) parts.push(a.join.trim())
  }
  // Fallback: no artist join annotations, comma-separate.
  if (parts.length === 0) return ''
  const joined = parts.join(' ').replace(/\s+/g, ' ').trim()
  return joined || list.map((a) => cleanArtistName(a.name || '')).filter(Boolean).join(', ')
}

// Guess the Omnio MusicType from Discogs format tags. Discogs uses lots of
// format-specific values ("LP", "Album", "EP", "Single"); we pick the
// closest one Omnio understands and leave 'album' as the safe default.
function inferMusicType(formats: string[] | undefined): MusicType | undefined {
  if (!formats || formats.length === 0) return undefined
  const set = new Set(formats.map((f) => f.toLowerCase()))
  if (set.has('single')) return 'single'
  if (set.has('ep') || set.has('mini-album')) return 'ep'
  if (set.has('compilation')) return 'recopilation'
  if (set.has('lp') || set.has('album')) return 'album'
  return undefined
}

function normalizeRelease(raw: unknown): Release | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const info = r.basic_information as Record<string, unknown> | undefined
  if (!info) return null
  const title = typeof info.title === 'string' ? info.title.trim() : ''
  if (!title) return null
  const artist = joinArtists(info.artists as { name?: string; join?: string; anv?: string }[] | undefined) || 'Unknown Artist'
  const year = typeof info.year === 'number' && info.year > 0 ? String(info.year) : undefined
  const labelArr = info.labels as { name?: string }[] | undefined
  const label = labelArr && labelArr[0]?.name ? labelArr[0].name : undefined
  const genresArr = (info.genres as string[] | undefined) ?? []
  const stylesArr = (info.styles as string[] | undefined) ?? []
  const genres = [...new Set([...genresArr, ...stylesArr])].filter(Boolean)
  const formatsArr = info.formats as { name?: string }[] | undefined
  const formats = formatsArr?.map((f) => f.name || '').filter(Boolean)
  const cover = typeof info.cover_image === 'string' ? info.cover_image : undefined
  const rating = typeof r.rating === 'number' && r.rating > 0 ? r.rating : undefined
  const dateAdded = typeof r.date_added === 'string' ? r.date_added.slice(0, 10) : undefined
  const discogsId = typeof r.id === 'number' ? r.id : (typeof info.id === 'number' ? info.id : 0)
  return {
    key: `${artist.toLowerCase()}::${title.toLowerCase()}`,
    discogsId,
    title,
    artist,
    year,
    label,
    genres: genres.length > 0 ? genres : undefined,
    formats,
    coverUrl: cover,
    rating,
    dateAdded,
  }
}

function findExisting(existing: Item[], artist: string, title: string): Item | undefined {
  const aLc = artist.toLowerCase()
  const tLc = title.toLowerCase()
  for (const it of existing) {
    if (it.categoryId !== 'musica') continue
    if (it.title.toLowerCase() !== tLc) continue
    if ((it.artist ?? '').toLowerCase() === aLc) return it
  }
  return undefined
}

type Action = 'apply' | 'create' | 'skip'

export default function DiscogsImporter({ existingItems, onImport, onClose }: Props) {
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [releases, setReleases] = useState<Release[]>([])
  const [truncated, setTruncated] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actions, setActions] = useState<Record<string, Action>>({})

  const matches = useMemo(() => {
    const map = new Map<string, Item | undefined>()
    for (const r of releases) map.set(r.key, findExisting(existingItems, r.artist, r.title))
    return map
  }, [releases, existingItems])

  const handleFetch = async () => {
    if (!username.trim()) { setError('Enter a Discogs username.'); return }
    setError(null)
    setBusy(true)
    try {
      const res = await window.ipcRenderer.invoke('discogs:collection', username.trim(), token.trim() || undefined) as
        | { ok: true; data: { releases: unknown[]; truncated: boolean; totalPages: number } }
        | { ok: false; error: string }
      if (!res.ok) { setError(res.error); setBusy(false); return }
      const normalized = res.data.releases
        .map((r) => normalizeRelease(r))
        .filter((r): r is Release => !!r)
      // Dedupe by (artist, title) across the release list itself — users
      // often have multiple pressings of the same album; Omnio tracks
      // albums, not pressings.
      const byKey = new Map<string, Release>()
      for (const r of normalized) {
        const prev = byKey.get(r.key)
        // Prefer entries with cover / rating / year over emptier duplicates.
        if (!prev) byKey.set(r.key, r)
        else {
          const better: Release = {
            ...prev,
            coverUrl: prev.coverUrl ?? r.coverUrl,
            rating: prev.rating ?? r.rating,
            year: prev.year ?? r.year,
            label: prev.label ?? r.label,
            genres: prev.genres ?? r.genres,
            formats: prev.formats ?? r.formats,
          }
          byKey.set(r.key, better)
        }
      }
      const unique = Array.from(byKey.values()).sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title))
      setReleases(unique)
      setTruncated(res.data.truncated)
      setTotalPages(res.data.totalPages)
      // Default: apply when the library matches, create otherwise.
      const init: Record<string, Action> = {}
      for (const r of unique) init[r.key] = findExisting(existingItems, r.artist, r.title) ? 'apply' : 'create'
      setActions(init)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const setAction = (k: string, a: Action) => setActions((s) => ({ ...s, [k]: a }))

  const summary = useMemo(() => {
    let toApply = 0, toCreate = 0
    for (const r of releases) {
      const a = actions[r.key]
      if (a === 'apply') toApply++; else if (a === 'create') toCreate++
    }
    return { toApply, toCreate }
  }, [releases, actions])

  const handleImport = () => {
    const updates = new Map<string, Partial<Item>>()
    const creates: Item[] = []
    const now = Date.now()
    for (const r of releases) {
      const a = actions[r.key]
      if (a === 'skip') continue
      if (a === 'apply') {
        const match = matches.get(r.key)
        if (!match) continue
        // Enrich the existing item without overwriting user-authored fields.
        // Only fill blanks; the user's ratings, genres, cover stay.
        const patch: Partial<Item> = {}
        if (!match.cover && r.coverUrl) patch.cover = r.coverUrl
        if (!match.releaseYear && r.year) patch.releaseYear = r.year
        if (!match.label && r.label) patch.label = r.label
        if (!match.rating && r.rating) patch.rating = r.rating
        if ((match.genres?.length ?? 0) === 0 && r.genres) patch.genres = r.genres
        if (!match.musicType) {
          const guess = inferMusicType(r.formats)
          if (guess) patch.musicType = guess
        }
        if (Object.keys(patch).length > 0) updates.set(match.id, patch)
      } else if (a === 'create') {
        creates.push({
          id: crypto.randomUUID(),
          categoryId: 'musica',
          title: r.title,
          artist: r.artist,
          releaseYear: r.year,
          label: r.label,
          rating: r.rating,
          genres: r.genres,
          cover: r.coverUrl,
          musicType: inferMusicType(r.formats),
          createdAt: now,
        })
      }
    }
    onImport({ updates, creates })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel discogs-importer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, width: '95vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Import from Discogs</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Reads your Discogs collection (folder 0 — "All"). Public collections work with just your
            username. Private collections need a <b>Personal Access Token</b> from
            <b> discogs.com/settings/developers</b> (click "Generate new token", paste it below).
            Cover URLs stay remote — re-fetch on-disk copies later via MusicBrainz / VGMdb if you
            want them portable.
          </p>

          <div className="discogs-creds">
            <label>
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-discogs-username"
                onKeyDown={(e) => { if (e.key === 'Enter') handleFetch() }}
              />
            </label>
            <label>
              <span>Personal Access Token <em>(optional, needed for private)</em></span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="XxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx"
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') handleFetch() }}
              />
            </label>
            <button type="button" className="importer-file-btn" onClick={handleFetch} disabled={busy || !username.trim()}>
              {busy ? 'Fetching…' : releases.length > 0 ? 'Re-fetch' : 'Fetch collection'}
            </button>
          </div>

          {error && <p className="save-files-error">{error}</p>}
          {truncated && <p className="hint" style={{ color: 'var(--text-dim)' }}>Collection truncated at 2 000 releases ({totalPages} pages total on Discogs).</p>}

          {releases.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{releases.length} unique release{releases.length === 1 ? '' : 's'}</span>
                <span className="importer-new">{summary.toCreate} to create</span>
                <span className="importer-dupe">{summary.toApply} to apply</span>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead>
                    <tr>
                      <th>Album</th>
                      <th>Artist</th>
                      <th style={{ width: 60 }}>Year</th>
                      <th style={{ width: 60 }}>Rating</th>
                      <th style={{ width: 100 }}>Format</th>
                      <th style={{ width: 170 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releases.map((r) => {
                      const match = matches.get(r.key)
                      const action = actions[r.key] ?? 'skip'
                      return (
                        <tr key={`${r.discogsId}-${r.key}`} className={!match ? 'dupe' : ''}>
                          <td>{r.title}</td>
                          <td>{r.artist}</td>
                          <td>{r.year ?? '—'}</td>
                          <td>{r.rating ?? '—'}</td>
                          <td>{r.formats?.join(', ') ?? '—'}</td>
                          <td>
                            <select value={action} onChange={(e) => setAction(r.key, e.target.value as Action)}>
                              {match && <option value="apply">Apply to existing</option>}
                              <option value="create">Create in Music</option>
                              <option value="skip">Skip</option>
                            </select>
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
        {releases.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="primary-btn"
              disabled={summary.toApply + summary.toCreate === 0}
              onClick={handleImport}
            >
              Apply to {summary.toApply + summary.toCreate} release{summary.toApply + summary.toCreate === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
