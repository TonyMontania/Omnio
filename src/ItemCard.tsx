import type { DragEvent } from 'react'
import { getGameStatus, getCategoryLine, getMusicTypeLabel, getMangaStatus, isMangaLike, getAnimeStatus, getSeriesStatus, renderMiniMarkdown, assetSrc, DEFAULT_GAME_FIELDS, DEFAULT_MUSIC_FIELDS, DEFAULT_MANGA_FIELDS, DEFAULT_MOVIE_FIELDS, DEFAULT_ANIME_FIELDS, DEFAULT_SERIES_FIELDS } from './types'
import { GameStatusIcon, MangaStatusIcon, AnimeStatusIcon } from './icons'
import type { Item, GameField, MusicField, MangaField, MovieField, AnimeField, SeriesField } from './types'

interface Props {
  item: Item
  layout: 'list' | 'grid' | 'compact'
  onOpen: (item: Item) => void
  onDelete: (item: Item) => void
  onToggleSelect?: (id: string) => void
  selected?: boolean
  selectionActive?: boolean
  draggableEnabled?: boolean
  onDragStartItem?: (id: string) => void
  onDropItem?: (id: string) => void
  gameFields?: Record<GameField, boolean>
  musicFields?: Record<MusicField, boolean>
  mangaFields?: Record<MangaField, boolean>
  movieFields?: Record<MovieField, boolean>
  animeFields?: Record<AnimeField, boolean>
  seriesFields?: Record<SeriesField, boolean>
}

export default function ItemCard({ item, layout, onOpen, onDelete, onToggleSelect, selected, selectionActive, draggableEnabled, onDragStartItem, onDropItem, gameFields, musicFields, mangaFields, movieFields, animeFields, seriesFields }: Props) {
  // Shift+click always toggles selection. Once any card is selected,
  // plain clicks also toggle so the user can keep going without holding
  // shift each time (macOS Finder pattern).
  const handleClick = (e: React.MouseEvent) => {
    if (onToggleSelect && (e.shiftKey || selectionActive)) onToggleSelect(item.id)
    else onOpen(item)
  }
  const isGame = item.categoryId === 'videojuegos'
  const isMusic = item.categoryId === 'musica'
  const isManga = isMangaLike(item.categoryId)
  const isMovie = item.categoryId === 'peliculas'
  const isAnime = item.categoryId === 'anime' || item.categoryId === 'donghua'
  const isSeries = item.categoryId === 'series'
  const gf = isGame ? (gameFields ?? DEFAULT_GAME_FIELDS) : null
  const mf = isMusic ? (musicFields ?? DEFAULT_MUSIC_FIELDS) : null
  const mgf = isManga ? (mangaFields ?? DEFAULT_MANGA_FIELDS) : null
  const movf = isMovie ? (movieFields ?? DEFAULT_MOVIE_FIELDS) : null
  const anf = isAnime ? (animeFields ?? DEFAULT_ANIME_FIELDS) : null
  const sf = isSeries ? (seriesFields ?? DEFAULT_SERIES_FIELDS) : null

  const showTitle = isGame ? gf!.title : isMusic ? mf!.title : isManga ? mgf!.title : isMovie ? movf!.title : isAnime ? anf!.title : isSeries ? sf!.title : true
  const showLine = isGame ? gf!.playTime : isManga ? mgf!.chapters : isMovie ? movf!.year : isAnime ? anf!.episodes : isSeries ? sf!.episodes : true
  const showRating = isGame ? gf!.rating : isMusic ? mf!.rating : isMovie ? movf!.rating : isAnime ? anf!.rating : isSeries ? sf!.rating : true
  const showTags = isGame ? gf!.tags : isMusic ? mf!.tags : isMovie ? movf!.tags : isAnime ? anf!.tags : isSeries ? sf!.tags : true
  const gs = isGame && gf!.status ? getGameStatus(item.gameStatus) : null
  const ms = isManga && mgf!.status ? getMangaStatus(item.mangaStatus) : null
  const as = isAnime && anf!.status ? getAnimeStatus(item.watchStatus) : null
  const ss = isSeries && sf!.status ? getSeriesStatus(item.seriesStatus) : null
  const showMovieStatus = isMovie && movf!.status

  const musicYear = item.releaseDate ? new Date(item.releaseDate).getFullYear() : item.releaseYear

  const line = getCategoryLine(item)

  const dragProps = {
    draggable: draggableEnabled,
    onDragStart: () => onDragStartItem?.(item.id),
    onDragOver: (e: DragEvent) => draggableEnabled && e.preventDefault(),
    onDrop: () => onDropItem?.(item.id),
  }

  if (layout === 'compact') {
    return (
      <div className={`item-card compact${selected ? ' selected' : ''}`} onClick={handleClick} {...dragProps}>
        {selected && <span className="card-check" aria-hidden>✓</span>}
        <div className="compact-cover">
          {item.cover ? <img src={assetSrc(item.cover)} alt={item.title} loading="lazy" decoding="async" /> : <div className="cover-placeholder small">{item.title.charAt(0).toUpperCase()}</div>}
        </div>
        {showTitle && <span className="compact-title">{item.title}</span>}
        {isMusic && mf!.artist && item.artist && <span className="compact-line">{item.artist}</span>}
        {!isMusic && showLine && line && <span className="compact-line">{line}</span>}
        {showRating && item.rating ? <span className="rating-badge">★{item.rating}</span> : null}
        <button className="delete compact-delete" onClick={(e) => { e.stopPropagation(); onDelete(item) }}>✕</button>
      </div>
    )
  }

  return (
    <div className={`item-card${selected ? ' selected' : ''}`} onClick={handleClick} {...dragProps}>
      {selected && <span className="card-check" aria-hidden>✓</span>}
      <div className={isMusic ? 'cover-wrap square' : 'cover-wrap'}>
        {item.cover ? (
          <img src={assetSrc(item.cover)} alt={item.title} loading="lazy" decoding="async" />
        ) : (
          <div className="cover-placeholder">{item.title.charAt(0).toUpperCase()}</div>
        )}
      </div>
      <div className="item-info">
        {showTitle && <h3>{item.title}</h3>}
        {gs && <p className="item-status"><GameStatusIcon value={gs.value} /> {gs.label}</p>}
        {ms && <p className="item-status"><MangaStatusIcon value={ms.value} /> {ms.label}</p>}
        {as && <p className="item-status"><AnimeStatusIcon value={as.value} /> {as.label}</p>}
        {ss && <p className="item-status"><AnimeStatusIcon value={ss.value} /> {ss.label}</p>}
        {showMovieStatus && <p className="item-status">{item.consumed ? 'Watched' : 'Not watched'}</p>}

        {isMusic ? (
          <>
            {mf!.artist && item.artist && <p className="item-meta">{item.artist}</p>}
            {(mf!.releaseYear || mf!.type) && (
              <p className="item-time">
                {mf!.releaseYear && musicYear}
                {mf!.releaseYear && mf!.type && item.musicType && ' · '}
                {mf!.type && item.musicType && getMusicTypeLabel(item.musicType)}
              </p>
            )}
          </>
        ) : (
          showLine && line && <p className="item-time">{line}</p>
        )}

        {showRating && item.rating ? <span className="rating-badge">★ {item.rating}</span> : null}
        {layout === 'list' && !isGame && !isMusic && !isMovie && item.notes && (
          <div className="item-notes-md" dangerouslySetInnerHTML={{ __html: renderMiniMarkdown(item.notes) }} />
        )}
        {showTags && item.tags && item.tags.length > 0 && (
          <div className="card-tags">
            {item.tags.map((t) => <span key={t} className="card-tag">{t}</span>)}
          </div>
        )}
      </div>
      <button className="delete" onClick={(e) => { e.stopPropagation(); onDelete(item) }}>✕</button>
    </div>
  )
}