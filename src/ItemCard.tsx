import type { DragEvent } from 'react'
import { getGameStatus, getCategoryLine, getMusicTypeLabel, getMangaStatus, isMangaLike, getAnimeStatus, getSeriesStatus, getBookStatus, renderMiniMarkdown, assetSrc, DEFAULT_GAME_FIELDS, DEFAULT_MUSIC_FIELDS, DEFAULT_MANGA_FIELDS, DEFAULT_MOVIE_FIELDS, DEFAULT_ANIME_FIELDS, DEFAULT_SERIES_FIELDS, DEFAULT_BOOK_FIELDS, DEFAULT_VN_FIELDS, VN_STATUS_OPTIONS, VN_LENGTH_OPTIONS } from './types'
import { useLongPress } from './utils/useLongPress'
import { GameStatusIcon, MangaStatusIcon, AnimeStatusIcon } from './icons'
import type { AnyItem, GameField, MusicField, MangaField, MovieField, AnimeField, SeriesField, BookField, VnField, MangaStatus } from './types'
import type { LibraryCustomFieldDef } from './types/customFields'
import { displayLibraryCustomValue } from './types/customFields'
import { OMNIO_ITEM_DRAG_TYPE } from './Sidebar'

interface Props {
  item: AnyItem
  layout: 'list' | 'grid' | 'compact'
  onOpen: (item: AnyItem) => void
  onDelete: (item: AnyItem) => void
  onToggleFavorite?: (item: AnyItem) => void
  onContextMenu?: (item: AnyItem, x: number, y: number) => void
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
  bookFields?: Record<BookField, boolean>
  vnFields?: Record<VnField, boolean>
  // Sprint H — library-level custom fields declared in Settings +
  // per-field on/off flags picked by the user for the card view.
  // Only the flagged fields render on the card, everything else stays
  // in the editor as before.
  libraryCustomFields?: LibraryCustomFieldDef[]
  libraryCustomFieldsShown?: Record<string, boolean>
}

export default function ItemCard({ item, layout, onOpen, onDelete, onToggleFavorite, onContextMenu, onToggleSelect, selected, selectionActive, draggableEnabled, onDragStartItem, onDropItem, gameFields, musicFields, mangaFields, movieFields, animeFields, seriesFields, bookFields, vnFields, libraryCustomFields, libraryCustomFieldsShown }: Props) {
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onContextMenu) return
    e.preventDefault()
    onContextMenu(item, e.clientX, e.clientY)
  }
  // Touch users get the same menu via long-press (~500ms hold). The hook
  // no-ops for mouse pointers so desktop behavior stays exactly as-is.
  const longPressProps = useLongPress((x, y) => {
    if (onContextMenu) onContextMenu(item, x, y)
  })
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
  const isBook = item.categoryId === 'libros'
  const isVn = item.categoryId === 'visual_novels'
  const gf = isGame ? (gameFields ?? DEFAULT_GAME_FIELDS) : null
  const mf = isMusic ? (musicFields ?? DEFAULT_MUSIC_FIELDS) : null
  const mgf = isManga ? (mangaFields ?? DEFAULT_MANGA_FIELDS) : null
  const movf = isMovie ? (movieFields ?? DEFAULT_MOVIE_FIELDS) : null
  const anf = isAnime ? (animeFields ?? DEFAULT_ANIME_FIELDS) : null
  const sf = isSeries ? (seriesFields ?? DEFAULT_SERIES_FIELDS) : null
  const bf = isBook ? (bookFields ?? DEFAULT_BOOK_FIELDS) : null
  const vf = isVn ? (vnFields ?? DEFAULT_VN_FIELDS) : null

  const showTitle = isGame ? gf!.title : isMusic ? mf!.title : isManga ? mgf!.title : isMovie ? movf!.title : isAnime ? anf!.title : isSeries ? sf!.title : isBook ? bf!.title : isVn ? vf!.title : true
  const showLine = isGame ? gf!.playTime : isManga ? mgf!.chapters : isMovie ? movf!.year : isAnime ? anf!.episodes : isSeries ? sf!.episodes : isBook ? bf!.pages : isVn ? vf!.length : true
  const showRating = isGame ? gf!.rating : isMusic ? mf!.rating : isManga ? mgf!.rating : isMovie ? movf!.rating : isAnime ? anf!.rating : isSeries ? sf!.rating : isBook ? bf!.rating : isVn ? vf!.rating : true
  const showTags = isGame ? gf!.tags : isMusic ? mf!.tags : isManga ? mgf!.tags : isMovie ? movf!.tags : isAnime ? anf!.tags : isSeries ? sf!.tags : isBook ? bf!.tags : isVn ? vf!.tags : true
  const mangaAuthorsList = (item as unknown as { mangaAuthors?: string[] }).mangaAuthors
  const showMangaAuthors = isManga && mgf!.authors && mangaAuthorsList && mangaAuthorsList.length > 0
  const gs = isGame && gf!.status ? getGameStatus(item.gameStatus) : null
  const ms = isManga && mgf!.status ? getMangaStatus(item.mangaStatus) : null
  const as = isAnime && anf!.status ? getAnimeStatus(item.watchStatus) : null
  const ss = isSeries && sf!.status ? getSeriesStatus(item.seriesStatus) : null
  const bs = isBook && bf!.status ? getBookStatus(item.bookStatus) : null
  const vns = isVn && vf!.status ? (VN_STATUS_OPTIONS.find((s) => s.value === (item.visualNovelStatus ?? 'plan_to_play')) ?? null) : null
  const vnLength = isVn && vf!.length && item.vnLength ? (VN_LENGTH_OPTIONS.find((l) => l.value === item.vnLength)?.label ?? null) : null
  const showMovieStatus = isMovie && movf!.status
  const showBookAuthors = isBook && bf!.authors && item.authors && item.authors.length > 0
  const showVnDevs = isVn && item.devs && item.devs.length > 0

  const musicYear = item.releaseDate ? new Date(item.releaseDate).getFullYear() : item.releaseYear

  const line = getCategoryLine(item)

  // Cards are ALWAYS draggable so a user can drag them onto a
  // sidebar library entry (Sprint H — cross-library move). The
  // existing per-collection reorder gesture is still gated by
  // `draggableEnabled`: when true, the drag also stashes the id for
  // the per-card onDrop reorder handler; when false, only the
  // sidebar payload is set so cards can't accidentally drop onto
  // each other in the middle of a non-reorderable sort.
  const dragProps = {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      // Sidebar drop target uses this custom MIME so unrelated
      // dragovers (a random file drag from the OS onto a card) can
      // be ignored.
      e.dataTransfer.setData(OMNIO_ITEM_DRAG_TYPE, item.id)
      e.dataTransfer.effectAllowed = 'move'
      onDragStartItem?.(item.id)
    },
    onDragOver: (e: DragEvent) => draggableEnabled && e.preventDefault(),
    onDrop: () => onDropItem?.(item.id),
  }

  if (layout === 'compact') {
    return (
      <div className={`item-card compact${selected ? ' selected' : ''}`} onClick={handleClick} onContextMenu={handleContextMenu} {...longPressProps} {...dragProps}>
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
    <div className={`item-card${selected ? ' selected' : ''}`} onClick={handleClick} onContextMenu={handleContextMenu} {...longPressProps} {...dragProps}>
      {selected && <span className="card-check" aria-hidden>✓</span>}
      <div className={isMusic ? 'cover-wrap square' : 'cover-wrap'}>
        {item.cover ? (
          <img src={assetSrc(item.cover)} alt={item.title} loading="lazy" decoding="async" />
        ) : (
          <div className="cover-placeholder">{item.title.charAt(0).toUpperCase()}</div>
        )}
        {(() => {
          // Compute a 0-1 progress ratio from whichever pair of "read /
          // total" fields is populated for this item's category. Only
          // renders the bar when both sides parse to positive numbers,
          // so unread items stay clean.
          const pair = (a?: string, b?: string): [number, number] | null => {
            const cur = a ? parseInt(a, 10) : NaN
            const tot = b ? parseInt(b, 10) : NaN
            if (!Number.isFinite(cur) || !Number.isFinite(tot) || tot <= 0) return null
            return [cur, tot]
          }
          const p = pair(item.chaptersRead, item.totalChapters)
            ?? pair(item.episodesWatched, item.totalEpisodes)
            ?? pair(item.pagesRead, item.totalPages)
          if (!p) return null
          const pct = Math.min(100, Math.max(0, (p[0] / p[1]) * 100))
          return (
            <div className="card-progress" title={`${p[0]} / ${p[1]}`}>
              <div className="card-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )
        })()}
      </div>
      <div className="item-info">
        {showTitle && <h3>{item.title}</h3>}
        {gs && <p className="item-status"><GameStatusIcon value={gs.value} /> {gs.label}</p>}
        {ms && <p className="item-status"><MangaStatusIcon value={ms.value} /> {ms.label}</p>}
        {as && <p className="item-status"><AnimeStatusIcon value={as.value} /> {as.label}</p>}
        {ss && <p className="item-status"><AnimeStatusIcon value={ss.value} /> {ss.label}</p>}
        {bs && <p className="item-status"><MangaStatusIcon value={bs.value as MangaStatus} /> {bs.label}</p>}
        {vns && <p className="item-status">{vns.label}</p>}
        {showBookAuthors && <p className="item-meta">{item.authors!.slice(0, 2).join(', ')}</p>}
        {showMangaAuthors && <p className="item-meta">{mangaAuthorsList!.slice(0, 2).join(', ')}</p>}
        {showVnDevs && <p className="item-meta">{item.devs!.slice(0, 2).join(', ')}</p>}
        {vnLength && <p className="item-time">{vnLength}</p>}
        {isVn && vf!.year && item.releaseYear && <p className="item-time">{item.releaseYear}</p>}
        {showMovieStatus && <p className="item-status">{item.consumed ? 'Watched' : 'Not watched'}</p>}
        {(isAnime || isSeries) && item.airingStatus === 'airing' && (
          <p className="airing-chip" title={item.airingDay ? `New episodes on ${item.airingDay}` : 'Currently airing'}>
            <span className="airing-dot" aria-hidden />
            {item.airingDay ? `Airs ${item.airingDay.slice(0, 3)}` : 'Airing'}
          </p>
        )}
        {isGame && item.deckCompat && item.deckCompat !== 'unknown' && (
          <p
            className={`deck-chip deck-${item.deckCompat}`}
            title={`Steam Deck: ${item.deckCompat}`}
          >
            <span aria-hidden style={{ fontSize: 10 }}>◆</span> Deck: {item.deckCompat}
          </p>
        )}
        {isMovie && (() => {
          const explicit = parseInt(item.timesWatched ?? '', 10)
          const logged = item.viewings?.length ?? 0
          const total = Number.isFinite(explicit) ? Math.max(explicit, logged) : logged
          if (total <= 1) return null
          return <p className="movie-times-chip" title={`${total} viewings`}>× {total} watched</p>
        })()}
        {isManga && item.bookmarkChapter && (
          <p className="manga-bookmark-chip" title={item.bookmarkNote || `Bookmark at ${item.bookmarkChapter}`}>
            ⌘ Ch. {item.bookmarkChapter}
          </p>
        )}

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
        {libraryCustomFields && libraryCustomFields.length > 0 && libraryCustomFieldsShown && (
          <div className="card-custom-fields">
            {libraryCustomFields.map((def) => {
              if (!libraryCustomFieldsShown[def.id]) return null
              const v = item.libraryCustomFieldValues?.[def.id]
              if (v == null || v === '') return null
              return (
                <span key={def.id} className="card-custom-field" title={`${def.name}: ${displayLibraryCustomValue(def, v)}`}>
                  <span className="card-custom-field-key">{def.name}</span>
                  <span className="card-custom-field-val">{displayLibraryCustomValue(def, v)}</span>
                </span>
              )
            })}
          </div>
        )}
      </div>
      {onToggleFavorite && (
        <button
          type="button"
          className={item.favorite ? 'card-fav on' : 'card-fav'}
          title={item.favorite ? 'Favorited (click to remove)' : 'Mark as favorite'}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(item) }}
        >★</button>
      )}
      <button className="delete" onClick={(e) => { e.stopPropagation(); onDelete(item) }}>✕</button>
    </div>
  )
}