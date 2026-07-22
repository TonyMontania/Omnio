import { useState } from 'react'
import type { Item, MusicArtist, MusicField } from './types'
import { assetSrc, getBandStatusLabel } from './types'
import ItemCard from './ItemCard'

interface Props {
  artist: MusicArtist
  items: Item[]
  layout: 'list' | 'grid' | 'compact'
  onSetLayout: (l: 'list' | 'grid' | 'compact') => void
  onBack: () => void
  onEdit: () => void
  onOpenItem: (item: Item) => void
  onDeleteItem: (item: Item) => void
  musicFields?: Record<MusicField, boolean>
}

type SortMode = 'recent' | 'alpha' | 'rating' | 'yearDesc' | 'yearAsc' | 'duration'

export default function ArtistDetailView({ artist, items, layout, onSetLayout, onBack, onEdit, onOpenItem, onDeleteItem, musicFields }: Props) {
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('yearDesc')

  const pickYear = (i: Item) => {
    if (i.releaseDate) return new Date(i.releaseDate).getFullYear()
    return parseInt(i.releaseYear || '0', 10) || 0
  }
  const pickDuration = (i: Item) => {
    if (!i.tracks) return 0
    return i.tracks.reduce((a, t) => a + (parseInt(t.duration || '0', 10) || 0), 0)
  }
  const sortedItems = [...items].sort((a, b) => {
    if (sortMode === 'alpha') return a.title.localeCompare(b.title)
    if (sortMode === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (sortMode === 'recent') return b.createdAt - a.createdAt
    if (sortMode === 'yearAsc') return (pickYear(a) || 9999) - (pickYear(b) || 9999)
    if (sortMode === 'duration') return pickDuration(b) - pickDuration(a)
    // yearDesc default
    return pickYear(b) - pickYear(a)
  })

  const ratedItems = items.filter((i) => i.rating)
  const avgRating = ratedItems.length ? (ratedItems.reduce((a, i) => a + (i.rating || 0), 0) / ratedItems.length).toFixed(1) : null

  const activePeriod = [artist.activeFrom, artist.activeTo].some(Boolean)
    ? `${artist.activeFrom || '?'} – ${artist.activeTo || 'present'}`
    : null

  const currentMembers = (artist.members ?? []).filter((m) => !m.former)
  const formerMembers = (artist.members ?? []).filter((m) => m.former)
  const hasInfo = artist.origin || artist.bandStatus || (artist.genres && artist.genres.length > 0)
    || activePeriod || (artist.labels && artist.labels.length > 0) || (artist.members && artist.members.length > 0)

  return (
    <div className="game-page artist-page">
      <div className="game-page-topbar">
        <button className="back-btn wide" onClick={onBack}>← Back</button>
        <div className="game-page-actions">
          <button className="edit-btn" onClick={onEdit}>✎ Edit</button>
        </div>
      </div>

      <div className="artist-banner">
        {artist.bannerImage ? <img src={assetSrc(artist.bannerImage)} alt="" /> : <div className="artist-banner-placeholder" />}
        <div className="banner-fade" />
        <div className="artist-header-row">
          <div className="artist-avatar">
            {artist.photo ? <img src={assetSrc(artist.photo)} alt="" /> : <span>{artist.name.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="artist-header-info">
            <span className="artist-eyebrow">Artist</span>
            <h1>{artist.name}</h1>
            <span className="artist-count">
              {items.length} {items.length === 1 ? 'item' : 'items'} in your library
              {avgRating && ` · ★ ${avgRating} average`}
            </span>
          </div>
        </div>
      </div>

      {hasInfo && (
        <div className="artist-info-grid">
          {artist.origin && (
            <div className="artist-info-block"><h4>Origin</h4><div className="val">{artist.origin}</div></div>
          )}
          {artist.bandStatus && (
            <div className="artist-info-block"><h4>Status</h4><div className="val">{getBandStatusLabel(artist.bandStatus)}</div></div>
          )}
          {activePeriod && (
            <div className="artist-info-block"><h4>Years active</h4><div className="val">{activePeriod}</div></div>
          )}
          {artist.genres && artist.genres.length > 0 && (
            <div className="artist-info-block"><h4>Genres</h4><div className="val">{artist.genres.join(', ')}</div></div>
          )}
          {artist.labels && artist.labels.length > 0 && (
            <div className="artist-info-block"><h4>Labels</h4><div className="val">{artist.labels.join(', ')}</div></div>
          )}
          {artist.members && artist.members.length > 0 && (
            <div className="artist-info-block" style={{ gridColumn: '1 / -1' }}>
              <h4>Members</h4>
              {currentMembers.length > 0 && (
                <div className="artist-members">
                  {currentMembers.map((m) => (
                    <div key={m.id} className="artist-member-row">
                      <span className="m-name">{m.name}</span>
                      {m.roles.length > 0 && <span className="m-roles">— {m.roles.join(', ')}</span>}
                      {m.joinedIn && <span className="m-period">· {m.joinedIn} – present</span>}
                    </div>
                  ))}
                </div>
              )}
              {formerMembers.length > 0 && (
                <>
                  <div className="artist-members-label">Former members</div>
                  <div className="artist-members">
                    {formerMembers.map((m) => (
                      <div key={m.id} className="artist-member-row former">
                        <span className="m-name">{m.name}</span>
                        {m.roles.length > 0 && <span className="m-roles">— {m.roles.join(', ')}</span>}
                        {(m.joinedIn || m.leftIn) && (
                          <span className="m-period">· {m.joinedIn || '?'} – {m.leftIn || '?'}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="content-header artist-content-header">
        <div />
        <div className="view-toggle">
          <button type="button" className={layout === 'list' ? 'active' : ''} onClick={() => onSetLayout('list')}>☰ List</button>
          <button type="button" className={layout === 'grid' ? 'active' : ''} onClick={() => onSetLayout('grid')}>▦ Grid</button>
          <button type="button" className={layout === 'compact' ? 'active' : ''} onClick={() => onSetLayout('compact')}>≡ Compact</button>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="sort-select" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
          <option value="yearDesc">Release year ↓</option>
          <option value="yearAsc">Release year ↑</option>
          <option value="recent">Most recent</option>
          <option value="alpha">Alphabetical</option>
          <option value="rating">Rating</option>
          <option value="duration">Duration (longest)</option>
        </select>
      </div>

      <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
        {sortedItems.length === 0 && <p className="empty">Nothing from this artist yet.</p>}
        {sortedItems
          .filter((item) => !search.trim() || item.title.toLowerCase().includes(search.trim().toLowerCase()))
          .map((item) => (
            <ItemCard key={item.id} item={item} layout={layout} onOpen={onOpenItem} onDelete={onDeleteItem} musicFields={musicFields} />
          ))}
      </div>
    </div>
  )
}
