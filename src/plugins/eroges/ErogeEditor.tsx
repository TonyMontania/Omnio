import { useState, useEffect } from 'react'
import type { ErogeItem, ErogeCollection, BacklogStatus, F95Status } from './types'
import { ENGINES, STATUSES, BACKLOG_STATUSES } from './constants'
import { f95Fetch, f95DownloadCover } from './f95Api'
import { ryuuFetch, ryuuDownloadCover } from './ryuuApi'
import { assetSaveFromFile, assetDelete } from './ipc'

interface Props {
  initial?: ErogeItem | null
  collections: ErogeCollection[]
  allGames: ErogeItem[]
  f95Cookie?: string
  onSave: (game: ErogeItem, collectionIds: string[]) => void
  onCancel: () => void
}

// Duplicate lookup: does another game already carry the same F95 /
// Ryuugames URL, or the same DLsite RJ id? Used by the importers so
// the user doesn't blindly re-add a game they already have.
function findDuplicate(
  games: ErogeItem[],
  ownId: string,
  match: { link?: string; ryuugamesUrl?: string; dlsiteId?: string; dlsiteUrl?: string; steamUrl?: string; itchUrl?: string },
): ErogeItem | null {
  const norm = (v: string): string => v.trim().replace(/\/+$/, '').toLowerCase()
  const link = match.link ? norm(match.link) : ''
  const ryuu = match.ryuugamesUrl ? norm(match.ryuugamesUrl) : ''
  const dlUrl = match.dlsiteUrl ? norm(match.dlsiteUrl) : ''
  const steam = match.steamUrl ? norm(match.steamUrl) : ''
  const itch = match.itchUrl ? norm(match.itchUrl) : ''
  const rj = (match.dlsiteId || '').toUpperCase()
  for (const g of games) {
    if (g.id === ownId) continue
    if (link && g.link && norm(g.link) === link) return g
    if (ryuu && g.ryuugamesUrl && norm(g.ryuugamesUrl) === ryuu) return g
    if (dlUrl && g.dlsiteUrl && norm(g.dlsiteUrl) === dlUrl) return g
    if (steam && g.steamUrl && norm(g.steamUrl) === steam) return g
    if (itch && g.itchUrl && norm(g.itchUrl) === itch) return g
    if (rj && g.dlsiteId && g.dlsiteId.toUpperCase() === rj) return g
  }
  return null
}

const empty = (): ErogeItem => ({
  id: crypto.randomUUID(),
  name: '', originalTitle: '', version: '', creator: '', engine: '', vn: false,
  status: '', backlogStatus: '', releaseDate: '', language: '',
  dlsiteId: '', dlsiteUrl: '', steamUrl: '', itchUrl: '', ryuugamesUrl: '',
  link: '', description: '', coverFile: '', favorite: false,
})

export default function ErogeEditor({ initial, collections, allGames, f95Cookie, onSave, onCancel }: Props) {
  const isEdit = !!initial
  const [game, setGame] = useState<ErogeItem>(initial ? { ...initial } : empty())
  const [f95Url, setF95Url] = useState('')
  const [f95Status, setF95Status] = useState('')
  const [importing, setImporting] = useState(false)
  const [ryuuUrl, setRyuuUrl] = useState('')
  const [ryuuStatus, setRyuuStatus] = useState('')
  const [importingRyuu, setImportingRyuu] = useState(false)
  // When an import matches an existing library entry, we pause and
  // present the user with a choice: create a fresh duplicate, or
  // fold the new metadata into the existing game.
  const [dupPrompt, setDupPrompt] = useState<{
    source: 'f95' | 'ryuu'
    url: string
    duplicate: ErogeItem
  } | null>(null)
  const [selectedColls, setSelectedColls] = useState<string[]>(
    collections.filter((c) => c.itemIds.includes(game.id)).map((c) => c.id),
  )

  useEffect(() => {
    if (initial?.link && !f95Url) setF95Url(initial.link)
    if (initial?.ryuugamesUrl && !ryuuUrl) setRyuuUrl(initial.ryuugamesUrl)
  }, [initial, f95Url, ryuuUrl])

  const set = <K extends keyof ErogeItem>(k: K, v: ErogeItem[K]) => setGame((g) => ({ ...g, [k]: v }))

  // Merge fetched F95 data into a target game object, non-destructive
  // (existing non-empty fields win). Returns the patched game.
  function mergeF95(target: ErogeItem, res: Awaited<ReturnType<typeof f95Fetch>>, url: string): ErogeItem {
    return {
      ...target,
      name: target.name || res.name,
      originalTitle: target.originalTitle || res.originalTitle,
      version: res.version || target.version,
      creator: res.creator || target.creator,
      engine: res.engine || target.engine,
      vn: target.vn || res.vn,
      status: (res.status as F95Status) || target.status,
      releaseDate: res.releaseDate || target.releaseDate,
      language: target.language || res.language,
      description: res.description || target.description,
      dlsiteUrl: target.dlsiteUrl || res.dlsiteUrl,
      dlsiteId: target.dlsiteId || res.dlsiteId,
      steamUrl: target.steamUrl || res.steamUrl,
      itchUrl: target.itchUrl || res.itchUrl,
      link: url,
      latestVersion: res.version || target.latestVersion,
    }
  }

  async function runF95Import(target: ErogeItem, url: string): Promise<{ patched: ErogeItem; res: Awaited<ReturnType<typeof f95Fetch>>; coverDiag?: string } | null> {
    const res = await f95Fetch(url, f95Cookie)
    let patched = mergeF95(target, res, url)
    let coverDiag: string | undefined
    if (!patched.coverFile) {
      const attempts = [res.coverUrl, ...(res.coverFallbacks ?? [])].filter(Boolean)
      if (attempts.length === 0) {
        coverDiag = 'no cover URL found in the post'
      } else {
        setF95Status(`Downloading cover… (0/${attempts.length})`)
        const gameName = res.name || patched.name || 'game'
        const errors: string[] = []
        for (let i = 0; i < attempts.length; i++) {
          setF95Status(`Downloading cover… (${i + 1}/${attempts.length})`)
          const dl = await f95DownloadCover(gameName, attempts[i], f95Cookie)
          if (dl.ok) { patched = { ...patched, coverFile: dl.filename }; break }
          errors.push(dl.error)
        }
        if (!patched.coverFile) {
          coverDiag = `cover could not be downloaded (${attempts.length} attempts): ${errors[0]}`
        }
      }
    }
    return { patched, res, coverDiag }
  }

  async function importFromF95() {
    if (!f95Url.trim()) { setF95Status('Paste a link first'); return }
    const dup = findDuplicate(allGames, game.id, { link: f95Url.trim() })
    if (dup) {
      setDupPrompt({ source: 'f95', url: f95Url.trim(), duplicate: dup })
      return
    }
    await doF95Import('current', f95Url.trim())
  }

  // Actually run the import and either update the current draft (mode
  // = 'current') or merge into an existing library entry and hand it
  // back to the parent via onSave (mode = 'merge:<id>').
  async function doF95Import(mode: 'current' | { mergeInto: ErogeItem }, url: string) {
    setImporting(true); setF95Status('Importing…')
    try {
      const target = mode === 'current' ? game : mode.mergeInto
      const outcome = await runF95Import(target, url)
      if (!outcome) return
      if (mode === 'current') {
        setGame(outcome.patched)
        const post = findDuplicate(allGames, game.id, { dlsiteId: outcome.res.dlsiteId, dlsiteUrl: outcome.res.dlsiteUrl })
        const dupWarn = post ? ` (⚠ already exists as "${post.name}")` : ''
        const coverWarn = outcome.coverDiag ? ` — ${outcome.coverDiag}` : ''
        setF95Status((outcome.res.storeLinksHidden
          ? '✓ Imported — F95 hides store links without login; use Ryuugames for dlsite/steam.'
          : '✓ Imported') + dupWarn + coverWarn)
      } else {
        // Save the merged metadata straight into the existing game
        // and close the editor — the parent already has that game
        // in its list.
        const existingColls = collections.filter((c) => c.itemIds.includes(mode.mergeInto.id)).map((c) => c.id)
        onSave({ ...outcome.patched, updatedAt: Date.now() }, existingColls)
      }
    } catch (err) {
      setF95Status(`Error: ${(err as Error).message}`)
    }
    setImporting(false)
  }

  // An existing description that reads like a scraped SEO title
  // (e.g. "... (RJ01600055) Crack ... Direct Link Download") should
  // be replaced by a freshly-fetched one — the old value came from a
  // previous scraper pass that couldn't find the real DESCRIPTION
  // block and fell back to the OG meta. Legit user text stays intact
  // because it won't match the SEO-junk fingerprint.
  const looksLikeSeoJunk = (s: string | undefined): boolean =>
    !!s && /Direct\s*Link\s*Download|\bRJ\d{6,}\b\s*Crack/i.test(s)

  function mergeRyuu(target: ErogeItem, res: Awaited<ReturnType<typeof ryuuFetch>>, url: string): ErogeItem {
    const nextDescription = looksLikeSeoJunk(target.description)
      ? (res.description || target.description)
      : (target.description || res.description)
    return {
      ...target,
      name: target.name || res.title || target.name,
      originalTitle: target.originalTitle || res.originalTitle,
      language: target.language || res.language,
      creator: target.creator || res.developer,
      releaseDate: target.releaseDate || res.releaseDate,
      description: nextDescription,
      dlsiteUrl: target.dlsiteUrl || res.dlsiteUrl,
      dlsiteId: target.dlsiteId || res.dlsiteId,
      steamUrl: target.steamUrl || res.steamUrl,
      itchUrl: target.itchUrl || res.itchUrl,
      ryuugamesUrl: url,
    }
  }

  async function runRyuuImport(target: ErogeItem, url: string): Promise<{ patched: ErogeItem; res: Awaited<ReturnType<typeof ryuuFetch>> } | null> {
    const res = await ryuuFetch(url)
    let patched = mergeRyuu(target, res, url)
    if (res.coverUrl && !patched.coverFile) {
      setRyuuStatus('Downloading cover…')
      const cover = await ryuuDownloadCover(patched.name || res.title || 'game', res.coverUrl)
      if (cover) patched = { ...patched, coverFile: cover }
    }
    return { patched, res }
  }

  async function importFromRyuu() {
    if (!ryuuUrl.trim()) { setRyuuStatus('Paste a link first'); return }
    const dup = findDuplicate(allGames, game.id, { ryuugamesUrl: ryuuUrl.trim() })
    if (dup) {
      setDupPrompt({ source: 'ryuu', url: ryuuUrl.trim(), duplicate: dup })
      return
    }
    await doRyuuImport('current', ryuuUrl.trim())
  }

  async function doRyuuImport(mode: 'current' | { mergeInto: ErogeItem }, url: string) {
    setImportingRyuu(true); setRyuuStatus('Importing…')
    try {
      const target = mode === 'current' ? game : mode.mergeInto
      const outcome = await runRyuuImport(target, url)
      if (!outcome) return
      if (mode === 'current') {
        setGame(outcome.patched)
        const post = findDuplicate(allGames, game.id, { dlsiteId: outcome.res.dlsiteId, dlsiteUrl: outcome.res.dlsiteUrl })
        setRyuuStatus(post ? `✓ Imported (⚠ already exists as "${post.name}")` : '✓ Imported')
      } else {
        const existingColls = collections.filter((c) => c.itemIds.includes(mode.mergeInto.id)).map((c) => c.id)
        onSave({ ...outcome.patched, updatedAt: Date.now() }, existingColls)
      }
    } catch (err) {
      setRyuuStatus(`Error: ${(err as Error).message}`)
    }
    setImportingRyuu(false)
  }

  async function pickCoverFile() {
    const path = window.prompt('Absolute path to the image file (or leave blank and use the F95 importer):')
    if (!path) return
    const res = await assetSaveFromFile('cover', path, `${game.name || 'game'} cover`)
    if (res.ok) set('coverFile', res.filename)
    else alert(`Error: ${res.error}`)
  }

  async function removeCover() {
    if (game.coverFile) await assetDelete('cover', `${game.name || 'game'} cover`)
    set('coverFile', '')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!game.name.trim()) return
    const now = Date.now()
    onSave({
      ...game,
      name: game.name.trim(),
      updatedAt: now,
      createdAt: game.createdAt || now,
    }, selectedColls)
  }

  const runDupChoice = async (choice: 'add' | 'merge') => {
    if (!dupPrompt) return
    const { source, url, duplicate } = dupPrompt
    setDupPrompt(null)
    if (source === 'f95') {
      await doF95Import(choice === 'add' ? 'current' : { mergeInto: duplicate }, url)
    } else {
      await doRyuuImport(choice === 'add' ? 'current' : { mergeInto: duplicate }, url)
    }
  }

  return (
    <div className="er-modal-backdrop" onClick={onCancel}>
      {dupPrompt && (
        <div className="er-modal-backdrop" onClick={() => setDupPrompt(null)} style={{ zIndex: 1100 }}>
          <div className="er-modal" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <h2>Game already in library</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 8px' }}>
              The link you pasted is already associated with:
            </p>
            <p style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>
              «{dupPrompt.duplicate.name}»
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.5, margin: '0 0 16px' }}>
              <b>Add anyway</b>: creates a separate entry and fills its empty fields with whatever the importer returns.<br/>
              <b>Only add metadata</b>: doesn't create anything — dumps the missing fields onto the existing game and discards the current entry.
            </p>
            <div className="er-modal-actions">
              <button className="er-btn" onClick={() => setDupPrompt(null)}>Cancel</button>
              <button className="er-btn" onClick={() => runDupChoice('add')}>Add anyway</button>
              <button className="er-btn er-btn-primary" onClick={() => runDupChoice('merge')}>Only add metadata</button>
            </div>
          </div>
        </div>
      )}
      <div className="er-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit game' : 'New game'}</h2>
        <div className="er-f95-import">
          <input type="text" placeholder="Paste the F95 link and press Import"
            value={f95Url} onChange={(e) => setF95Url(e.target.value)} />
          <button type="button" className="er-btn" onClick={importFromF95} disabled={importing}>F95</button>
        </div>
        <div className="er-f95-status">{f95Status}</div>
        <div className="er-f95-import">
          <input type="text" placeholder="Paste the Ryuugames link to add metadata"
            value={ryuuUrl} onChange={(e) => setRyuuUrl(e.target.value)} />
          <button type="button" className="er-btn" onClick={importFromRyuu} disabled={importingRyuu}>Ryuugames</button>
        </div>
        <div className="er-f95-status">{ryuuStatus}</div>
        <form onSubmit={submit}>
          <label>Name <input type="text" required value={game.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>Original title <input type="text" value={game.originalTitle ?? ''} onChange={(e) => set('originalTitle', e.target.value)} placeholder="蒼海のレディ・スパイ" /></label>
          <label>Version <input type="text" value={game.version ?? ''} onChange={(e) => set('version', e.target.value)} placeholder="v0.7" /></label>
          <label>Creator <input type="text" value={game.creator ?? ''} onChange={(e) => set('creator', e.target.value)} /></label>
          <label>Language <input type="text" value={game.language ?? ''} onChange={(e) => set('language', e.target.value)} placeholder="Japanese, English" /></label>
          <label>Engine
            <select value={game.engine ?? ''} onChange={(e) => set('engine', e.target.value)}>
              <option value="">-</option>
              {ENGINES.map((e) => <option key={e.label} value={e.label}>{e.label}</option>)}
            </select>
          </label>
          <label className="er-checkbox">
            <input type="checkbox" checked={!!game.vn} onChange={(e) => set('vn', e.target.checked)} /> Visual Novel (VN)
          </label>
          <label>Status
            <select value={game.status ?? ''} onChange={(e) => set('status', e.target.value as F95Status)}>
              <option value="">-</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>My progress
            <select value={game.backlogStatus ?? ''} onChange={(e) => set('backlogStatus', e.target.value as BacklogStatus)}>
              <option value="">-</option>
              {BACKLOG_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Release date (YY/MM/DD) <input type="text" value={game.releaseDate ?? ''} onChange={(e) => set('releaseDate', e.target.value)} placeholder="24/06/02" /></label>
          <label>DLSITE ID <input type="text" value={game.dlsiteId ?? ''} onChange={(e) => set('dlsiteId', e.target.value)} placeholder="RJ01234567" /></label>
          <label>DLSITE URL <input type="text" value={game.dlsiteUrl ?? ''} onChange={(e) => set('dlsiteUrl', e.target.value)} placeholder="https://www.dlsite.com/..." /></label>
          <label>Steam URL <input type="text" value={game.steamUrl ?? ''} onChange={(e) => set('steamUrl', e.target.value)} placeholder="https://store.steampowered.com/app/..." /></label>
          <label>itch.io URL <input type="text" value={game.itchUrl ?? ''} onChange={(e) => set('itchUrl', e.target.value)} placeholder="https://<creator>.itch.io/<game>" /></label>
          <label>Ryuugames URL <input type="text" value={game.ryuugamesUrl ?? ''} onChange={(e) => set('ryuugamesUrl', e.target.value)} placeholder="https://www.ryuugames.com/..." /></label>
          <label>F95 link <input type="text" value={game.link ?? ''} onChange={(e) => set('link', e.target.value)} placeholder="https://f95zone.to/..." /></label>
          <label>Description <textarea rows={5} value={game.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
          <label>Cover
            <div className="er-form-cover">
              <button type="button" className="er-btn" onClick={pickCoverFile}>Choose file</button>
              {game.coverFile && <button type="button" className="er-btn er-btn-danger er-btn-sm" onClick={removeCover}>Remove</button>}
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{game.coverFile || 'No image'}</span>
            </div>
          </label>
          <label className="er-checkbox">
            <input type="checkbox" checked={!!game.favorite} onChange={(e) => set('favorite', e.target.checked)} /> Favorite ★
          </label>
          <div className="er-form-collections">
            <div className="er-fc-label">Add to collections</div>
            <div className="er-fc-list">
              {collections.length === 0 && <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>No collections yet</span>}
              {collections.map((c) => (
                <label key={c.id}>
                  <input type="checkbox"
                    checked={selectedColls.includes(c.id)}
                    onChange={(e) => setSelectedColls((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="er-modal-actions">
            <button type="button" className="er-btn" onClick={onCancel}>Cancel</button>
            <button type="submit" className="er-btn er-btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
