import { useRef, useState } from 'react'
import type { ErogeItem, BacklogStatus, F95Status } from './types'
import { ENGINES, STATUSES, BACKLOG_STATUSES, BACKLOG_LABELS } from './constants'
import { f95Fetch, f95DownloadCover, f95PageUrl, looksLikeF95Thread, parseF95Page } from './f95Api'
import { ryuuFetch, ryuuDownloadCover } from './ryuuApi'
import { assetSaveDataUrl, assetDelete, assetUrl } from './ipc'
import { fileToDataUrl } from '../../utils/files'

interface Props {
  initial?: ErogeItem | null
  allGames: ErogeItem[]
  f95Cookie?: string
  onSave: (game: ErogeItem) => void
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

type Stage = 'import' | 'review' | 'form'

export default function ErogeEditor({ initial, allGames, f95Cookie, onSave, onCancel }: Props) {
  const isEdit = !!initial
  const [game, setGame] = useState<ErogeItem>(initial ? { ...initial } : empty())
  const [stage, setStage] = useState<Stage>(isEdit ? 'form' : 'import')
  const [importText, setImportText] = useState(initial?.link || initial?.ryuugamesUrl || '')
  const [importStatus, setImportStatus] = useState('')
  const [importing, setImporting] = useState(false)
  const setF95Status = setImportStatus
  const setRyuuStatus = setImportStatus
  // When an import matches an existing library entry, we pause and
  // present the user with a choice: create a fresh duplicate, or
  // fold the new metadata into the existing game.
  const [dupPrompt, setDupPrompt] = useState<{
    source: 'f95' | 'ryuu'
    url: string
    html?: string
    duplicate: ErogeItem
  } | null>(null)

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
      otherGamesCreator: res.otherGamesCreator || target.otherGamesCreator,
      otherGamesFromPost: res.otherGamesFromPost.length ? res.otherGamesFromPost : target.otherGamesFromPost,
      otherGamesFetchedAt: undefined,
      tags: res.tags.length ? res.tags : target.tags,
    }
  }

  async function runF95Import(target: ErogeItem, url: string, html?: string): Promise<{ patched: ErogeItem; res: Awaited<ReturnType<typeof f95Fetch>>; coverDiag?: string } | null> {
    const res = html ? parseF95Page(html) : await f95Fetch(url, f95Cookie)
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

  // One box takes an F95 link, a Ryuugames link or a pasted F95 page.
  async function runImport() {
    const text = importText.trim()
    if (!text) return
    if (text.startsWith('<') || /<html|bbWrapper/i.test(text)) {
      if (!looksLikeF95Thread(text)) {
        setImportStatus('That doesn\'t look like an F95 thread page. Copy the whole page source with Ctrl+U, then Ctrl+A and Ctrl+C.')
        return
      }
      const url = f95PageUrl(text) || game.link || ''
      const dup = url ? findDuplicate(allGames, game.id, { link: url }) : null
      if (dup) { setDupPrompt({ source: 'f95', url, html: text, duplicate: dup }); return }
      setImportText(url)
      await doF95Import('current', url, text)
      return
    }
    if (/ryuugames/i.test(text)) {
      const dup = findDuplicate(allGames, game.id, { ryuugamesUrl: text })
      if (dup) { setDupPrompt({ source: 'ryuu', url: text, duplicate: dup }); return }
      await doRyuuImport('current', text)
      return
    }
    if (/f95zone/i.test(text)) {
      const dup = findDuplicate(allGames, game.id, { link: text })
      if (dup) { setDupPrompt({ source: 'f95', url: text, duplicate: dup }); return }
      await doF95Import('current', text)
      return
    }
    setImportStatus('Paste an F95Zone or Ryuugames link, or an F95 thread page.')
  }

  // Actually run the import and either update the current draft (mode
  // = 'current') or merge into an existing library entry and hand it
  // back to the parent via onSave (mode = 'merge:<id>').
  async function doF95Import(mode: 'current' | { mergeInto: ErogeItem }, url: string, html?: string) {
    setImporting(true); setF95Status('Importing…')
    try {
      const target = mode === 'current' ? game : mode.mergeInto
      const outcome = await runF95Import(target, url, html)
      if (!outcome) return
      if (mode === 'current') {
        setGame(outcome.patched)
        if (stage === 'import') setStage('review')
        const post = findDuplicate(allGames, game.id, { dlsiteId: outcome.res.dlsiteId, dlsiteUrl: outcome.res.dlsiteUrl })
        const dupWarn = post ? ` (⚠ already exists as "${post.name}")` : ''
        const coverWarn = outcome.coverDiag ? ` — ${outcome.coverDiag}` : ''
        setF95Status((outcome.res.fromCache
          ? '✓ Imported from F95Checker’s cache — F95Zone is blocking direct requests, so store links and the release date are missing. Use "Paste page" for everything.'
          : outcome.res.storeLinksHidden
            ? '✓ Imported — F95 hides store links without login; use Ryuugames for dlsite/steam.'
            : '✓ Imported') + dupWarn + coverWarn)
      } else {
        // Save the merged metadata straight into the existing game
        // and close the editor — the parent already has that game
        // in its list.
        onSave({ ...outcome.patched, updatedAt: Date.now() })
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

  async function doRyuuImport(mode: 'current' | { mergeInto: ErogeItem }, url: string) {
    setImporting(true); setRyuuStatus('Importing…')
    try {
      const target = mode === 'current' ? game : mode.mergeInto
      const outcome = await runRyuuImport(target, url)
      if (!outcome) return
      if (mode === 'current') {
        setGame(outcome.patched)
        if (stage === 'import') setStage('review')
        const post = findDuplicate(allGames, game.id, { dlsiteId: outcome.res.dlsiteId, dlsiteUrl: outcome.res.dlsiteUrl })
        setRyuuStatus(post ? `✓ Imported (⚠ already exists as "${post.name}")` : '✓ Imported')
      } else {
        onSave({ ...outcome.patched, updatedAt: Date.now() })
      }
    } catch (err) {
      setRyuuStatus(`Error: ${(err as Error).message}`)
    }
    setImporting(false)
  }

  const coverInputRef = useRef<HTMLInputElement>(null)

  async function onCoverFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    const res = await assetSaveDataUrl('cover', dataUrl, `${game.name || 'game'} cover`)
    if (res.ok) set('coverFile', res.filename)
    else alert(`Error: ${res.error}`)
  }

  async function removeCover() {
    if (game.coverFile) await assetDelete('cover', `${game.name || 'game'} cover`)
    set('coverFile', '')
  }

  function save() {
    if (!game.name.trim()) { setStage('form'); return }
    const now = Date.now()
    onSave({
      ...game,
      name: game.name.trim(),
      updatedAt: now,
      createdAt: game.createdAt || now,
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    save()
  }

  const runDupChoice = async (choice: 'add' | 'merge') => {
    if (!dupPrompt) return
    const { source, url, html, duplicate } = dupPrompt
    setDupPrompt(null)
    if (source === 'f95') {
      await doF95Import(choice === 'add' ? 'current' : { mergeInto: duplicate }, url, html)
    } else {
      await doRyuuImport(choice === 'add' ? 'current' : { mergeInto: duplicate }, url)
    }
  }

  const cover = game.coverFile ? assetUrl('cover', game.coverFile) : undefined
  const previewDetails = [game.vn ? 'VN' : '', game.engine, game.version, game.creator].filter(Boolean).join(' · ')
  const reviewFields: { label: string; filled: boolean }[] = [
    { label: 'Cover', filled: !!game.coverFile },
    { label: 'Creator', filled: !!game.creator },
    { label: 'Version', filled: !!game.version },
    { label: 'Engine', filled: !!game.engine },
    { label: 'Status', filled: !!game.status },
    { label: 'Release date', filled: !!game.releaseDate },
    { label: 'Description', filled: !!game.description },
    { label: 'Tags', filled: !!game.tags?.length },
    { label: 'Store links', filled: !!(game.dlsiteUrl || game.steamUrl || game.itchUrl) },
  ]
  const missing = reviewFields.filter((f) => !f.filled).map((f) => f.label)

  const importBox = (
    <div className="er-import">
      <textarea
        rows={stage === 'import' ? 4 : 2}
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="Paste an F95 or Ryuugames link — or the thread's page source (Ctrl+U, Ctrl+A, Ctrl+C) if F95 is blocking"
        autoFocus={stage === 'import'}
      />
      <div className="er-import-actions">
        {importStatus && <span className="er-import-status">{importStatus}</span>}
        <button type="button" className="er-btn er-btn-primary" onClick={runImport} disabled={importing || !importText.trim()}>
          {importing ? 'Importing…' : 'Import'}
        </button>
      </div>
    </div>
  )

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

      {stage === 'import' && (
        <div className="er-modal er-editor-import" onClick={(e) => e.stopPropagation()}>
          <h2>Add a game</h2>
          {importBox}
          <div className="er-modal-actions spread">
            <button type="button" className="er-link-btn" onClick={() => setStage('form')}>Fill it in by hand</button>
            <button type="button" className="er-btn" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div className="er-modal er-editor-import" onClick={(e) => e.stopPropagation()}>
          <h2>Review</h2>
          <div className="er-review">
            <div className="er-review-cover">{cover ? <img src={cover} alt="" /> : <span>No cover</span>}</div>
            <div className="er-review-info">
              <div className="er-review-name">{game.name || 'Untitled'}</div>
              <div className="er-review-meta">{[game.status, previewDetails].filter(Boolean).join(' · ')}</div>
              <div className="er-review-count">
                Imported {reviewFields.length - missing.length} of {reviewFields.length} fields
                {missing.length > 0 && <> · missing {missing.join(', ')}</>}
              </div>
            </div>
          </div>
          {importStatus && <p className="er-import-status">{importStatus}</p>}
          <div className="er-modal-actions">
            <button type="button" className="er-btn" onClick={() => setStage('form')}>Edit details</button>
            <button type="button" className="er-btn er-btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      )}

      {stage === 'form' && (
        <div className="er-modal er-editor" onClick={(e) => e.stopPropagation()}>
          <div className="er-editor-head">
            <h2>{isEdit ? 'Edit game' : 'New game'}</h2>
          </div>
          <form className="er-editor-body" onSubmit={submit}>
            <aside className="er-editor-preview">
              <div className="er-card er-preview-card">
                <div className="gc-banner">
                  {cover ? <img src={cover} alt="" /> : <div className="gc-nocover">No cover</div>}
                  {game.favorite && <span className="gc-fav on" aria-hidden>★</span>}
                </div>
                <div className="gc-info">
                  <div className="gc-name">{game.name || 'Untitled'}</div>
                  <div className="gc-line">
                    {game.status && <span className={`gc-status st-${game.status.toLowerCase()}`}>{game.status}</span>}
                    {previewDetails && <span className="gc-details">{previewDetails}</span>}
                  </div>
                </div>
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onCoverFileChosen} />
              <div className="er-preview-actions">
                <button type="button" className="er-btn er-btn-sm" onClick={() => coverInputRef.current?.click()}>{cover ? 'Change cover' : 'Add cover'}</button>
                {cover && <button type="button" className="er-btn er-btn-sm er-btn-danger" onClick={removeCover}>Remove</button>}
              </div>
            </aside>

            <div className="er-editor-fields">
              <details className="er-group" open={!isEdit && !game.name}>
                <summary>Import or refresh from a link</summary>
                <div className="er-group-grid">
                {importBox}
                </div>
              </details>

              <details className="er-group" open>
                <summary>Basics</summary>
                <div className="er-group-grid">
                <label className="span-2">Name <input type="text" required value={game.name} onChange={(e) => set('name', e.target.value)} /></label>
                <label className="span-2">Original title <input type="text" value={game.originalTitle ?? ''} onChange={(e) => set('originalTitle', e.target.value)} placeholder="蒼海のレディ・スパイ" /></label>
                <label>Creator <input type="text" value={game.creator ?? ''} onChange={(e) => set('creator', e.target.value)} /></label>
                <label>Engine
                  <select value={game.engine ?? ''} onChange={(e) => set('engine', e.target.value)}>
                    <option value="">—</option>
                    {ENGINES.map((en) => <option key={en.label} value={en.label}>{en.label}</option>)}
                  </select>
                </label>
                <label>Installed version <input type="text" value={game.version ?? ''} onChange={(e) => set('version', e.target.value)} placeholder="v0.7" /></label>
                <label className="er-check-field">
                  <input type="checkbox" checked={!!game.vn} onChange={(e) => set('vn', e.target.checked)} /> Visual novel
                </label>
                </div>
              </details>

              <details className="er-group" open>
                <summary>Your progress</summary>
                <div className="er-group-grid">
                <label>Progress
                  <select value={game.backlogStatus ?? ''} onChange={(e) => set('backlogStatus', e.target.value as BacklogStatus)}>
                    <option value="">—</option>
                    {BACKLOG_STATUSES.map((s) => <option key={s} value={s}>{BACKLOG_LABELS[s]}</option>)}
                  </select>
                </label>
                <label>Finished version
                  <div className="er-inline-row">
                    <input type="text" value={game.finishedVersion ?? ''} onChange={(e) => set('finishedVersion', e.target.value)} placeholder="Last version you finished" />
                    {game.version && game.finishedVersion !== game.version && (
                      <button type="button" className="er-btn er-btn-sm" onClick={() => set('finishedVersion', game.version)} title="Same as installed">= {game.version}</button>
                    )}
                  </div>
                </label>
                <div className="span-2 er-toggles">
                  <button type="button" className={`er-toggle-pill${game.favorite ? ' active' : ''}`} onClick={() => set('favorite', !game.favorite)} aria-pressed={!!game.favorite}>
                    <span className="er-toggle-star" aria-hidden>★</span>{game.favorite ? 'Favorite' : 'Mark as favorite'}
                  </button>
                  <button type="button" className={`er-toggle-pill${game.archived ? ' active' : ''}`} onClick={() => set('archived', !game.archived)} aria-pressed={!!game.archived}>
                    <span className="er-toggle-star" aria-hidden>⏸</span>{game.archived ? 'Archived — no update checks' : 'Archive'}
                  </button>
                </div>
                </div>
              </details>

              <details className="er-group" open>
                <summary>Release</summary>
                <div className="er-group-grid">
                <label>Development status
                  <select value={game.status ?? ''} onChange={(e) => set('status', e.target.value as F95Status)}>
                    <option value="">—</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>Release date <input type="text" value={game.releaseDate ?? ''} onChange={(e) => set('releaseDate', e.target.value)} placeholder="2024-06-02" /></label>
                <label className="span-2">Language <input type="text" value={game.language ?? ''} onChange={(e) => set('language', e.target.value)} placeholder="Japanese, English" /></label>
                </div>
              </details>

              <details className="er-group">
                <summary>Links</summary>
                <div className="er-group-grid">
                <label className="span-2">F95 thread <input type="text" value={game.link ?? ''} onChange={(e) => set('link', e.target.value)} placeholder="https://f95zone.to/threads/…" /></label>
                <label className="span-2">Ryuugames <input type="text" value={game.ryuugamesUrl ?? ''} onChange={(e) => set('ryuugamesUrl', e.target.value)} placeholder="https://www.ryuugames.com/…" /></label>
                <label>DLsite ID <input type="text" value={game.dlsiteId ?? ''} onChange={(e) => set('dlsiteId', e.target.value)} placeholder="RJ01234567" /></label>
                <label>DLsite page <input type="text" value={game.dlsiteUrl ?? ''} onChange={(e) => set('dlsiteUrl', e.target.value)} placeholder="https://www.dlsite.com/…" /></label>
                <label>Steam <input type="text" value={game.steamUrl ?? ''} onChange={(e) => set('steamUrl', e.target.value)} placeholder="https://store.steampowered.com/app/…" /></label>
                <label>itch.io <input type="text" value={game.itchUrl ?? ''} onChange={(e) => set('itchUrl', e.target.value)} placeholder="https://creator.itch.io/game" /></label>
                </div>
              </details>

              <details className="er-group" open={!!game.description}>
                <summary>Description and tags</summary>
                <div className="er-group-grid">
                <label className="span-2">Tags
                  <input type="text" value={(game.tags ?? []).join(', ')} placeholder="Filled from F95 — comma separated"
                    onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
                </label>
                <label className="span-2">Description
                  <textarea rows={7} value={game.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Your notes or the fetched description" />
                </label>
                </div>
              </details>
            </div>

            <div className="er-editor-foot">
              <button type="button" className="er-btn" onClick={onCancel}>Cancel</button>
              <button type="submit" className="er-btn er-btn-primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
