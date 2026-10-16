import { useState } from 'react'
import type { ErogeItem, BacklogStatus, F95Status } from './types'
import { ENGINES, STATUSES, BACKLOG_STATUSES, BACKLOG_LABELS } from './constants'
import { f95Fetch, f95DownloadCover, f95PageUrl, looksLikeF95Thread, parseF95Page } from './f95Api'
import { ryuuFetch, ryuuDownloadCover } from './ryuuApi'
import { assetSaveDataUrl, assetDelete, assetUrl } from './ipc'
import { fileToDataUrl } from '../../utils/files'
import EditorShell, { type EditorSection } from '../../components/editor-shell/EditorShell'
import { Check, DetailPreview, EditorDialog, Field, ImageSlot, ImportBox, ImportReview, TogglePill, Toggles } from '../../components/editor-shell/parts'
import ErogeCard from './ErogeCard'

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

  async function setCoverFromFile(file: File) {
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
  const progressLabel = game.backlogStatus ? BACKLOG_LABELS[game.backlogStatus] : ''
  const importPlaceholder = 'Paste an F95 or Ryuugames link — or the thread\'s page source (Ctrl+U, Ctrl+A, Ctrl+C) if F95 is blocking'
  const importBox = (large: boolean) => (
    <ImportBox
      value={importText}
      onChange={setImportText}
      onImport={runImport}
      busy={importing}
      status={importStatus}
      placeholder={importPlaceholder}
      large={large}
    />
  )

  const dupDialog = dupPrompt && (
    <EditorDialog
      title="Game already in library"
      width={480}
      onClose={() => setDupPrompt(null)}
      actions={<>
        <button type="button" className="es-btn" onClick={() => setDupPrompt(null)}>Cancel</button>
        <button type="button" className="es-btn" onClick={() => runDupChoice('add')}>Add anyway</button>
        <button type="button" className="es-btn primary" onClick={() => runDupChoice('merge')}>Only add metadata</button>
      </>}
    >
      <p>The link you pasted is already associated with <b style={{ color: 'var(--text)' }}>«{dupPrompt.duplicate.name}»</b>.</p>
      <p><b>Add anyway</b> creates a separate entry and fills its empty fields with whatever the importer returns.</p>
      <p><b>Only add metadata</b> doesn&apos;t create anything: it fills the missing fields of the existing game and discards this one.</p>
    </EditorDialog>
  )

  if (stage === 'import') {
    return (
      <>
        <EditorDialog
          title="Add a game"
          onClose={onCancel}
          actions={<>
            <button type="button" className="es-link" onClick={() => setStage('form')}>Fill it in by hand</button>
            <button type="button" className="es-btn" onClick={onCancel}>Cancel</button>
          </>}
        >
          {importBox(true)}
        </EditorDialog>
        {dupDialog}
      </>
    )
  }

  if (stage === 'review') {
    return (
      <EditorDialog
        title="Review"
        onClose={onCancel}
        actions={<>
          <button type="button" className="es-btn" onClick={() => setStage('form')}>Edit details</button>
          <button type="button" className="es-btn primary" onClick={save}>Save</button>
        </>}
      >
        <ImportReview
          cover={cover}
          title={game.name}
          meta={[game.status, game.vn ? 'VN' : '', game.engine, game.version, game.creator].filter(Boolean).join(' · ')}
          status={importStatus}
          fields={[
            { label: 'Cover', filled: !!game.coverFile },
            { label: 'Creator', filled: !!game.creator },
            { label: 'Version', filled: !!game.version },
            { label: 'Engine', filled: !!game.engine },
            { label: 'Status', filled: !!game.status },
            { label: 'Release date', filled: !!game.releaseDate },
            { label: 'Description', filled: !!game.description },
            { label: 'Tags', filled: !!game.tags?.length },
            { label: 'Store links', filled: !!(game.dlsiteUrl || game.steamUrl || game.itchUrl) },
          ]}
        />
      </EditorDialog>
    )
  }

  const sections: EditorSection[] = [
    {
      id: 'import',
      hint: isEdit ? 'Refresh empty fields from F95 or Ryuugames' : 'Fill the form from F95 or Ryuugames',
      content: importBox(false),
    },
    {
      id: 'basics',
      content: <>
        <Field label="Name" wide><input type="text" required value={game.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Original title" wide><input type="text" value={game.originalTitle ?? ''} onChange={(e) => set('originalTitle', e.target.value)} placeholder="蒼海のレディ・スパイ" /></Field>
        <Field label="Creator"><input type="text" value={game.creator ?? ''} onChange={(e) => set('creator', e.target.value)} /></Field>
        <Field label="Engine">
          <select value={game.engine ?? ''} onChange={(e) => set('engine', e.target.value)}>
            <option value="">—</option>
            {ENGINES.map((en) => <option key={en.label} value={en.label}>{en.label}</option>)}
          </select>
        </Field>
        <Field label="Installed version"><input type="text" value={game.version ?? ''} onChange={(e) => set('version', e.target.value)} placeholder="v0.7" /></Field>
        <Check label="Visual novel" checked={!!game.vn} onChange={(v) => set('vn', v)} />
      </>,
    },
    {
      id: 'progress',
      content: <>
        <Field label="Progress">
          <select value={game.backlogStatus ?? ''} onChange={(e) => set('backlogStatus', e.target.value as BacklogStatus)}>
            <option value="">—</option>
            {BACKLOG_STATUSES.map((s) => <option key={s} value={s}>{BACKLOG_LABELS[s]}</option>)}
          </select>
        </Field>
        <Field label="Finished version">
          <div className="es-inline">
            <input type="text" value={game.finishedVersion ?? ''} onChange={(e) => set('finishedVersion', e.target.value)} placeholder="Last version you finished" />
            {game.version && game.finishedVersion !== game.version && (
              <button type="button" className="es-btn small" onClick={() => set('finishedVersion', game.version)} title="Same as installed">= {game.version}</button>
            )}
          </div>
        </Field>
        <Toggles>
          <TogglePill on={!!game.favorite} icon="★" label="Mark as favorite" onLabel="Favorite" onChange={(v) => set('favorite', v)} />
          <TogglePill on={!!game.archived} icon="⏸" label="Archive" onLabel="Archived — no update checks" onChange={(v) => set('archived', v)} />
        </Toggles>
      </>,
    },
    {
      id: 'details',
      label: 'Release',
      content: <>
        <Field label="Development status">
          <select value={game.status ?? ''} onChange={(e) => set('status', e.target.value as F95Status)}>
            <option value="">—</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Release date"><input type="text" value={game.releaseDate ?? ''} onChange={(e) => set('releaseDate', e.target.value)} placeholder="2024-06-02" /></Field>
        <Field label="Language" wide><input type="text" value={game.language ?? ''} onChange={(e) => set('language', e.target.value)} placeholder="Japanese, English" /></Field>
      </>,
    },
    {
      id: 'media',
      content: <ImageSlot label="Cover" src={cover} shape="wide" onFile={setCoverFromFile} onRemove={removeCover} />,
    },
    {
      id: 'notes',
      label: 'Description & tags',
      content: <>
        <Field label="Tags" wide hint="comma separated">
          <input type="text" value={(game.tags ?? []).join(', ')} placeholder="Filled from F95"
            onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
        </Field>
        <Field label="Description" wide>
          <textarea rows={7} value={game.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Your notes or the fetched description" />
        </Field>
      </>,
    },
    {
      id: 'links',
      content: <>
        <Field label="F95 thread" wide><input type="text" value={game.link ?? ''} onChange={(e) => set('link', e.target.value)} placeholder="https://f95zone.to/threads/…" /></Field>
        <Field label="Ryuugames" wide><input type="text" value={game.ryuugamesUrl ?? ''} onChange={(e) => set('ryuugamesUrl', e.target.value)} placeholder="https://www.ryuugames.com/…" /></Field>
        <Field label="DLsite ID"><input type="text" value={game.dlsiteId ?? ''} onChange={(e) => set('dlsiteId', e.target.value)} placeholder="RJ01234567" /></Field>
        <Field label="DLsite page"><input type="text" value={game.dlsiteUrl ?? ''} onChange={(e) => set('dlsiteUrl', e.target.value)} placeholder="https://www.dlsite.com/…" /></Field>
        <Field label="Steam"><input type="text" value={game.steamUrl ?? ''} onChange={(e) => set('steamUrl', e.target.value)} placeholder="https://store.steampowered.com/app/…" /></Field>
        <Field label="itch.io"><input type="text" value={game.itchUrl ?? ''} onChange={(e) => set('itchUrl', e.target.value)} placeholder="https://creator.itch.io/game" /></Field>
      </>,
    },
  ]

  return (
    <>
      <EditorShell
        title={isEdit ? 'Edit game' : 'New game'}
        preview={{
          card: <ErogeCard game={game} onOpen={noop} onToggleFav={noop} />,
          detail: (
            <DetailPreview
              banner={cover}
              title={game.name}
              subtitle={game.originalTitle}
              chips={[game.status, progressLabel, game.vn ? 'VN' : ''].filter(Boolean) as string[]}
              facts={[
                ['Creator', game.creator],
                ['Engine', game.engine],
                ['Version', game.version],
                ['Finished', game.finishedVersion],
                ['Released', game.releaseDate],
                ['Language', game.language],
              ]}
              description={game.description}
            />
          ),
        }}
        previewNote={initial?.createdAt ? `Added ${new Date(initial.createdAt).toLocaleDateString()}` : undefined}
        sections={sections}
        onCancel={onCancel}
        onSubmit={save}
      />
      {dupDialog}
    </>
  )
}

const noop = () => { /* preview only */ }
