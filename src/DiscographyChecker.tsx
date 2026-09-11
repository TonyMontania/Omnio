// MusicBrainz discography completion check.
//
// User types an artist name → we query MB for release-groups of type
// Album (not compilations/live/soundtracks) → cross-reference against
// the user's own library → show a checklist of studio albums the user
// is missing. Clicking a missing album spawns a placeholder item
// pre-filled with title + artist + year so they can fill it in later.

import { useMemo, useState } from 'react'
import type { Item } from './types'

interface Props {
  items: Item[]
  onAddMissing: (rows: { title: string; artist: string; year?: string }[]) => void
  onClose: () => void
}

interface Album {
  id: string
  title: string
  year?: string
  primaryType?: string
  secondaryTypes?: string[]
}

interface MbHit {
  id: string
  title: string
  'primary-type'?: string
  'secondary-types'?: string[]
  'first-release-date'?: string
  'artist-credit'?: { name: string }[]
}

// A studio album is a Release Group whose primary type is "Album" and
// whose secondary types don't include Compilation/Live/Soundtrack/
// Remix/Interview/DJ-mix — MB's own definition of a "regular" studio
// album. Everything else is filtered out.
function isStudioAlbum(hit: MbHit): boolean {
  if (hit['primary-type']?.toLowerCase() !== 'album') return false
  const sec = (hit['secondary-types'] ?? []).map((s) => s.toLowerCase())
  const skip = ['compilation', 'live', 'soundtrack', 'remix', 'interview', 'dj-mix', 'mixtape/street', 'demo']
  return !skip.some((s) => sec.includes(s))
}

function keyOf(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`
}

export default function DiscographyChecker({ items, onAddMissing, onClose }: Props) {
  const [artist, setArtist] = useState('')
  const [albums, setAlbums] = useState<Album[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const musicByKey = useMemo(() => {
    const m = new Set<string>()
    for (const it of items) {
      if (it.categoryId !== 'musica') continue
      m.add(keyOf(it.title, it.artist || ''))
    }
    return m
  }, [items])

  async function search() {
    if (!artist.trim()) return
    setBusy(true); setError(null); setAlbums([])
    try {
      // MB advanced-query grammar — targets studio albums for the exact
      // artist name. `mb:search` runs the standard release-group
      // search endpoint and returns whatever hits fit.
      const query = `artist:"${artist.trim().replace(/"/g, '')}" AND primarytype:album AND status:official`
      const res = await window.ipcRenderer.invoke('mb:search', query) as { ok: boolean; error?: string; result?: MbHit[] }
      if (!res?.ok) { setError(res?.error || 'MusicBrainz request failed'); setBusy(false); return }
      const hits = res.result ?? []
      const filtered = hits
        .filter(isStudioAlbum)
        .filter((h) => h['artist-credit']?.some((a) => a.name.toLowerCase() === artist.trim().toLowerCase()))
      // Dedupe on release-group id in case MB returns variants
      const seen = new Set<string>()
      const unique: Album[] = []
      for (const h of filtered) {
        if (seen.has(h.id)) continue
        seen.add(h.id)
        unique.push({
          id: h.id,
          title: h.title,
          year: h['first-release-date']?.slice(0, 4) || undefined,
          primaryType: h['primary-type'],
          secondaryTypes: h['secondary-types'],
        })
      }
      unique.sort((a, b) => (a.year ?? '').localeCompare(b.year ?? '') || a.title.localeCompare(b.title))
      setAlbums(unique)
      // Pre-select every album the user doesn't have
      const pre = new Set<string>()
      for (const a of unique) if (!musicByKey.has(keyOf(a.title, artist))) pre.add(a.id)
      setSelected(pre)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const have = albums.filter((a) => musicByKey.has(keyOf(a.title, artist)))
  const missing = albums.filter((a) => !musicByKey.has(keyOf(a.title, artist)))

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleAdd = () => {
    const rows: { title: string; artist: string; year?: string }[] = []
    for (const a of missing) {
      if (!selected.has(a.id)) continue
      rows.push({ title: a.title, artist, year: a.year })
    }
    if (rows.length > 0) onAddMissing(rows)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760, width: '94vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>Discography completion</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Enter an artist you already have in your library. We query MusicBrainz for their studio
            discography (no compilations / live / soundtracks) and flag every album you don't have yet.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Artist name (exact match)"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') search() }}
              style={{ flex: 1 }}
            />
            <button type="button" className="secondary-btn" onClick={search} disabled={busy || !artist.trim()}>
              {busy ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p className="save-files-error">{error}</p>}
          {albums.length > 0 && (
            <>
              <div className="importer-summary">
                <span>{albums.length} studio albums</span>
                <span className="importer-new">{have.length} in your library</span>
                <span className="importer-dupe">{missing.length} missing</span>
              </div>
              <div className="importer-table-wrap">
                <table className="importer-table">
                  <thead><tr><th style={{ width: 32 }}></th><th>Album</th><th style={{ width: 70 }}>Year</th><th style={{ width: 110 }}>Status</th></tr></thead>
                  <tbody>
                    {albums.map((a) => {
                      const has = musicByKey.has(keyOf(a.title, artist))
                      return (
                        <tr key={a.id} className={has ? 'dupe' : ''}>
                          <td>{has ? '' : (
                            <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                          )}</td>
                          <td>{a.title}</td>
                          <td>{a.year ?? '—'}</td>
                          <td>{has ? <span className="importer-badge dupe">You have it</span> : <span className="importer-badge new">Missing</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        {missing.length > 0 && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-btn" disabled={selected.size === 0} onClick={handleAdd}>
              Add {selected.size} placeholder{selected.size === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
