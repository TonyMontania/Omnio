import type { Item, MusicArtist } from './types'
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
}

export default function ArtistDetailView({ artist, items, layout, onSetLayout, onBack, onEdit, onOpenItem, onDeleteItem }: Props) {
  const sortedItems = [...items].sort((a, b) => {
    const da = a.releaseDate ? new Date(a.releaseDate).getTime() : parseInt(a.releaseYear || '0', 10) * 10000000000
    const db = b.releaseDate ? new Date(b.releaseDate).getTime() : parseInt(b.releaseYear || '0', 10) * 10000000000
    return db - da
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

      <div className={layout === 'grid' ? 'list grid' : layout === 'compact' ? 'list compact' : 'list'}>
        {sortedItems.length === 0 && <p className="empty">Nothing from this artist yet.</p>}
        {sortedItems.map((item) => (
          <ItemCard key={item.id} item={item} layout={layout} onOpen={onOpenItem} onDelete={onDeleteItem} />
        ))}
      </div>
    </div>
  )
}
