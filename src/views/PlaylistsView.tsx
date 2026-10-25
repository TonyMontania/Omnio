// Cross-library playlists — hub view.
//
// Two nested screens driven by local state:
//   - list mode: every playlist as a cover-collage card; search, sort
//     and "+ New playlist" live in the app's top bar
//   - detail mode: hero header (collage, editable name and description,
//     actions) and the ordered entries, reordered with up/down buttons;
//     more items come from a modal picker.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnyItem } from '../types/entities'
import type { Playlist } from '../types/playlists'
import { playlistAdd, playlistRemove, playlistReorder } from '../types/playlists'
import { CATEGORIES } from '../categories'
import { assetSrc } from '../types'
import type { PluginPageMeta } from '../plugins/registry'
import PageControls from '../components/PageControls'
import { t } from '../i18n'

type Sort = 'recent' | 'alpha' | 'count'
const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: t('Most recent') },
  { value: 'alpha', label: t('Alphabetical') },
  { value: 'count', label: t('Most items') },
]

interface Props {
  playlists: Playlist[]
  items: AnyItem[]
  onChange: (playlists: Playlist[]) => void
  onOpenItem: (item: AnyItem) => void
  setPageMeta: (meta: PluginPageMeta | null) => void
}

const PlaylistGlyph = () => <span className="page-icon-glyph">♪</span>

function Collage({ covers }: { covers: (AnyItem | undefined)[] }) {
  const shown = covers.slice(0, 4)
  return (
    <div className={`playlist-collage n${Math.max(1, shown.length)}`}>
      {shown.length === 0 && <span className="playlist-collage-empty">♪</span>}
      {shown.map((it, i) => (
        <div key={i}>
          {it?.cover ? <img src={assetSrc(it.cover)} alt="" loading="lazy" /> : <span>{(it?.title ?? '?').charAt(0).toUpperCase()}</span>}
        </div>
      ))}
    </div>
  )
}

export default function PlaylistsView({ playlists, items, onChange, onOpenItem, setPageMeta }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const active = useMemo(
    () => (activeId ? playlists.find((p) => p.id === activeId) ?? null : null),
    [activeId, playlists],
  )
  const itemById = useMemo(() => {
    const m = new Map<string, AnyItem>()
    for (const it of items) m.set(it.id, it)
    return m
  }, [items])

  const createPlaylist = (name: string) => {
    const p: Playlist = { id: crypto.randomUUID(), name, entries: [], createdAt: Date.now() }
    onChange([...playlists, p])
    setActiveId(p.id)
  }

  const updateActive = (fn: (p: Playlist) => Playlist) => {
    if (!active) return
    onChange(playlists.map((p) => (p.id === active.id ? fn(p) : p)))
  }

  const deleteActive = () => {
    if (!active) return
    onChange(playlists.filter((p) => p.id !== active.id))
    setActiveId(null)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  useEffect(() => {
    if (active) {
      setPageMeta({ icon: <PlaylistGlyph />, title: t('Playlists'), onBack: () => setActiveId(null) })
      return
    }
    setPageMeta({
      icon: <PlaylistGlyph />,
      title: t('Playlists'),
      count: { n: playlists.length, unit: playlists.length === 1 ? 'playlist' : 'playlists' },
      actions: (
        <PageControls
          search={search}
          onSearch={setSearch}
          searchPlaceholder={t('Search playlists')}
          sort={sort}
          sortOptions={SORTS}
          onSort={setSort}
          create={{ label: t('+ New playlist'), placeholder: t('Playlist name'), onCreate: createPlaylist }}
        />
      ),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, playlists, search, sort, setPageMeta])

  const librariesOf = (p: Playlist) => new Set(p.entries.map((e) => e.categoryId)).size

  if (active) {
    const entries = active.entries
    const libs = librariesOf(active)
    return (
      <div className="content-scroll playlists-view">
        <header className="hero playlist-hero">
          <div className="hero-body">
            <div className="hero-cover square"><Collage covers={entries.map((e) => itemById.get(e.itemId))} /></div>
            <div className="hero-text">
              <div className="hero-chips">
                <span>{t('Playlist')}</span>
                <span>{entries.length} {entries.length === 1 ? 'item' : 'items'}</span>
                {libs > 0 && <span>{libs} {libs === 1 ? 'library' : 'libraries'}</span>}
              </div>
              <input
                className="playlists-title-input"
                value={active.name}
                aria-label={t('Playlist name')}
                onChange={(e) => updateActive((p) => ({ ...p, name: e.target.value, updatedAt: Date.now() }))}
              />
              <textarea
                className="playlists-description"
                placeholder={t('Add a description — what\'s the idea behind this list?')}
                value={active.description ?? ''}
                rows={2}
                onChange={(e) => updateActive((p) => ({ ...p, description: e.target.value, updatedAt: Date.now() }))}
              />
            </div>
            <div className="hero-actions">
              <button type="button" className="add-btn" onClick={() => setPickerOpen(true)}>{t('+ Add items')}</button>
              <div className="pop-wrap" ref={menuRef}>
                <button type="button" className={`icon-btn${menuOpen ? ' on' : ''}`} aria-label={t('More actions')} onClick={() => setMenuOpen((v) => !v)}>⋯</button>
                {menuOpen && (
                  <div className="pop" role="menu">
                    <div className="pop-list">
                      <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); deleteActive() }}>
                        <span className="pop-icon" aria-hidden>✕</span>{t('Delete playlist')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {entries.length === 0 ? (
          <p className="empty">{t('This playlist is empty. Add items with')}{' '}<b>{t('+ Add items')}</b>.</p>
        ) : (
          <ol className="playlists-entries">
            {entries.map((entry, i) => {
              const it = itemById.get(entry.itemId)
              const cat = CATEGORIES.find((c) => c.id === entry.categoryId)?.label ?? entry.categoryId
              return (
                <li key={`${entry.categoryId}:${entry.itemId}`} className="playlists-entry">
                  <span className="playlists-entry-pos">{i + 1}</span>
                  <button className="playlists-entry-cover" onClick={() => it && onOpenItem(it)}>
                    {it?.cover
                      ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                      : <span>{(it?.title ?? '?').charAt(0).toUpperCase()}</span>}
                  </button>
                  <div className="playlists-entry-body">
                    <div className="playlists-entry-title" onClick={() => it && onOpenItem(it)}>
                      {it?.title ?? <em>{t('Item deleted')}</em>}
                    </div>
                    <div className="playlists-entry-meta">{cat}</div>
                  </div>
                  <div className="playlists-entry-actions">
                    <button title={t('Move up')} disabled={i === 0} onClick={() => updateActive((p) => playlistReorder(p, i, i - 1))}>↑</button>
                    <button title={t('Move down')} disabled={i === entries.length - 1} onClick={() => updateActive((p) => playlistReorder(p, i, i + 1))}>↓</button>
                    <button title={t('Remove from playlist')} className="danger" onClick={() => updateActive((p) => playlistRemove(p, entry.categoryId, entry.itemId))}>✕</button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {pickerOpen && (
          <PlaylistItemPicker
            items={items}
            existing={active.entries}
            onClose={() => setPickerOpen(false)}
            onPick={(it) => updateActive((p) => playlistAdd(p, it.categoryId, it.id))}
          />
        )}
      </div>
    )
  }

  const query = search.trim().toLowerCase()
  const shown = playlists
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .sort((a, b) => sort === 'alpha' ? a.name.localeCompare(b.name)
      : sort === 'count' ? b.entries.length - a.entries.length || a.name.localeCompare(b.name)
      : (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))

  return (
    <div className="content-scroll playlists-view">
      {playlists.length === 0 ? (
        <p className="empty">{t('No playlists yet. A playlist is an ordered list that can mix items from every library — a rewatch queue, a study reading list, a soundtrack in the order you like it. Start one with')}{' '}<b>{t('+ New playlist')}</b>.</p>
      ) : shown.length === 0 ? (
        <p className="empty">{t('No playlists match your search.')}</p>
      ) : (
        <div className="playlists-grid">
          {shown.map((p) => {
            const libs = librariesOf(p)
            const line = [`${p.entries.length} ${p.entries.length === 1 ? 'item' : 'items'}`, libs > 1 ? `${libs} libraries` : null].filter(Boolean).join(' · ')
            return (
              <button key={p.id} type="button" className="playlists-card" onClick={() => setActiveId(p.id)}>
                <Collage covers={p.entries.map((e) => itemById.get(e.itemId))} />
                <span className="playlists-card-title">{p.name}</span>
                <span className="playlists-card-line">{line}</span>
                {p.description && <span className="playlists-card-desc">{p.description}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -- Item picker ----------------------------------------------------
//
// Modal shown from a playlist detail's "Add items" button. Lists every
// item across every library with a search box + a category filter,
// and greys out anything already in the playlist so the user sees
// what they've already picked without needing to remember.

interface PickerProps {
  items: AnyItem[]
  existing: { categoryId: string; itemId: string }[]
  onClose: () => void
  onPick: (item: AnyItem) => void
}

function PlaylistItemPicker({ items, existing, onClose, onPick }: PickerProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')

  const existingKeys = useMemo(() => {
    const s = new Set<string>()
    for (const e of existing) s.add(`${e.categoryId}:${e.itemId}`)
    return s
  }, [existing])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      if (category !== 'all' && it.categoryId !== category) return false
      if (q && !it.title.toLowerCase().includes(q)) return false
      return true
    }).slice(0, 200)
  }, [items, search, category])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal playlists-picker" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{t('Add items to playlist')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </header>
        <div className="playlists-picker-tools">
          <input
            autoFocus
            placeholder={t('Search titles…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">{t('Every library')}</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <ul className="playlists-picker-list">
          {filtered.length === 0 && <li className="empty">{t('No matches.')}</li>}
          {filtered.map((it) => {
            const key = `${it.categoryId}:${it.id}`
            const already = existingKeys.has(key)
            return (
              <li
                key={key}
                className={already ? 'picked' : ''}
                onClick={() => { if (!already) onPick(it) }}
              >
                <div className="playlists-picker-cover">
                  {it.cover
                    ? <img src={assetSrc(it.cover)} alt="" loading="lazy" />
                    : <span>{it.title.charAt(0).toUpperCase()}</span>}
                </div>
                <div className="playlists-picker-body">
                  <div className="playlists-picker-title">{it.title}</div>
                  <div className="playlists-picker-cat">{CATEGORIES.find((c) => c.id === it.categoryId)?.label ?? it.categoryId}</div>
                </div>
                {already && <span className="playlists-picker-tag">{t('Added')}</span>}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
