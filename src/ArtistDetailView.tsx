import type { Item, MusicArtist } from './types'
import { assetSrc } from './types'
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

      <div className="content-header artist-content-header">
        <div />
        <div className="view-toggle">
          <button className={layout === 'list' ? 'active' : ''} onClick={() => onSetLayout('list')}>☰ List</button>
          <button className={layout === 'grid' ? 'active' : ''} onClick={() => onSetLayout('grid')}>▦ Grid</button>
          <button className={layout === 'compact' ? 'active' : ''} onClick={() => onSetLayout('compact')}>≡ Compact</button>
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