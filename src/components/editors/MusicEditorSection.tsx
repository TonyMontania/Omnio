// Music-specific slice of the item editor form.
//
// Extracted from App.tsx to keep that file below the 7k-line mark. All
// state still lives on App — this component is presentational: it takes
// every value + setter it needs as props and mutates via callbacks. That
// means the state ordering, save flow, undo history, tab-visibility
// observer and preview sync all stay identical to pre-refactor. The
// diff on App.tsx is exactly "one big JSX block → one <MusicEditorSection />".
//
// If a future refactor moves the item form into a useReducer, this
// component becomes trivial to migrate: swap the prop bag for
// `state.music` + `dispatch` and drop the individual setters.

import type { AlbumEdition, Item, RelatedItem, MediaOwnership, MusicSource, MusicType, RewatchEntry, SingleCover, Track, VinylCondition } from '../../types'
import { isAlbumLikeMusic, MUSIC_TYPE_OPTIONS, MUSIC_SOURCE_OPTIONS, VINYL_CONDITION_OPTIONS, MEDIA_OWNERSHIP_OPTIONS } from '../../types'
import TagEditor from './TagEditor'
import TrackListEditor from './TrackListEditor'
import RatingPicker from './RatingPicker'
import SingleCoverEditor from './SingleCoverEditor'
import EditionsEditor from './EditionsEditor'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'

type Setter<T> = (updater: T | ((prev: T) => T)) => void

export interface MusicEditorSectionProps {
  // Item context (readonly — set elsewhere in the form)
  title: string
  editingId: string | null
  items: Item[]
  relatedCrossLibraryOptions: Item[]
  // Basic music fields
  artist: string;                       setArtist: (v: string) => void
  alternativeTitles: string[];          setAlternativeTitles: Setter<string[]>
  musicType: MusicType | '';            setMusicType: (v: MusicType | '') => void
  musicSource: MusicSource | '';        setMusicSource: (v: MusicSource | '') => void
  vinylCondition: VinylCondition | ''; setVinylCondition: (v: VinylCondition | '') => void
  mediaOwnership: MediaOwnership | ''; setMediaOwnership: (v: MediaOwnership | '') => void
  discCount: string;                    setDiscCount: (v: string) => void
  producers: string[];                  setProducers: Setter<string[]>
  releaseDate: string;                  setReleaseDate: (v: string) => void
  releaseYear: string;                  setReleaseYear: (v: string) => void
  genres: string[];                     setGenres: Setter<string[]>
  label: string;                        setLabel: (v: string) => void
  consumed: boolean;                    setConsumed: (v: boolean) => void
  hasTracks: boolean;                   setHasTracks: (v: boolean) => void
  tracks: Track[];                      setTracks: Setter<Track[]>
  rating: number;                       setRating: (v: number) => void
  finishedAt: string;                   setFinishedAt: (v: string) => void
  singleCovers: SingleCover[];          setSingleCovers: Setter<SingleCover[]>
  editions: AlbumEdition[];             setEditions: Setter<AlbumEdition[]>
  partOfAlbumId: string;                setPartOfAlbumId: (v: string) => void
  partOfAlbum: string;                  setPartOfAlbum: (v: string) => void
  musicReview: string;                  setMusicReview: (v: string) => void
  hasSpoilers: boolean;                 setHasSpoilers: (v: boolean) => void
  rewatches: RewatchEntry[];            setRewatches: Setter<RewatchEntry[]>
  relatedItems: RelatedItem[];          setRelatedItems: Setter<RelatedItem[]>
  recommendedItems: string[];           setRecommendedItems: Setter<string[]>
  // Shared helper reused across category forms — kept in App for consistency.
  yearHandler: (setter: (v: string) => void) => (v: string) => void
}

export default function MusicEditorSection(props: MusicEditorSectionProps) {
  const {
    title, editingId, items, relatedCrossLibraryOptions,
    artist, setArtist,
    alternativeTitles, setAlternativeTitles,
    musicType, setMusicType,
    musicSource, setMusicSource,
    vinylCondition, setVinylCondition,
    mediaOwnership, setMediaOwnership,
    discCount, setDiscCount,
    producers, setProducers,
    releaseDate, setReleaseDate,
    releaseYear, setReleaseYear,
    genres, setGenres,
    label, setLabel,
    consumed, setConsumed,
    hasTracks, setHasTracks,
    tracks, setTracks,
    rating, setRating,
    finishedAt, setFinishedAt,
    singleCovers, setSingleCovers,
    editions, setEditions,
    partOfAlbumId, setPartOfAlbumId,
    partOfAlbum, setPartOfAlbum,
    musicReview, setMusicReview,
    hasSpoilers, setHasSpoilers,
    rewatches, setRewatches,
    relatedItems, setRelatedItems,
    recommendedItems, setRecommendedItems,
    yearHandler,
  } = props

  return (
    <>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Music details</span>
        <span className="form-section-hint">Artist, tracklist, editions, singles</span>
      </div>
      <div className="field-group">
        <label>Artist</label>
        <input value={artist} onChange={(e) => setArtist(e.target.value)} />
      </div>
      <TagEditor
        label="Alternative titles"
        placeholder="Add title (romaji, English…)"
        tags={alternativeTitles}
        onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
        onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-row">
        <div className="field-group">
          <label>Type</label>
          <select value={musicType} onChange={(e) => setMusicType(e.target.value as MusicType | '')}>
            <option value="">Unspecified</option>
            {MUSIC_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Source</label>
          <select value={musicSource} onChange={(e) => setMusicSource(e.target.value as MusicSource | '')}>
            <option value="">Unspecified</option>
            {MUSIC_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Format</label>
          <select value={mediaOwnership} onChange={(e) => {
            const next = e.target.value as MediaOwnership | ''
            setMediaOwnership(next)
            // Purely digital or unset — no discs to count.
            if (next === 'digital' || next === 'neither' || next === '') setDiscCount('')
          }}>
            <option value="">— unspecified</option>
            {MEDIA_OWNERSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {(mediaOwnership === 'physical' || mediaOwnership === 'both') && (
          <div className="field-group">
            <label>Discs</label>
            <input
              value={discCount}
              onChange={(e) => setDiscCount(e.target.value)}
              placeholder="e.g. 1 or 2"
              inputMode="numeric"
            />
          </div>
        )}
      </div>
      <div className="field-group">
        <label>Vinyl condition <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>Goldmine grading scale — leave blank if you don't own a physical copy</span></label>
        <select value={vinylCondition} onChange={(e) => setVinylCondition(e.target.value as VinylCondition | '')}>
          <option value="">— not owned</option>
          {VINYL_CONDITION_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <TagEditor
        label="Producers"
        placeholder="Add producer"
        tags={producers}
        onAdd={(p) => setProducers((prev) => prev.includes(p) ? prev : [...prev, p])}
        onRemove={(i) => setProducers((prev) => prev.filter((_, idx) => idx !== i))}
      />

      {isAlbumLikeMusic(musicType || undefined) ? (
        <>
          <div className="field-group">
            <label>Released</label>
            <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
          </div>
          <TagEditor
            label="Genres"
            placeholder="Add genre"
            tags={genres}
            onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
            onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <div className="field-group">
            <label>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="form-section-header" data-belongs-to="progress">
            <span className="form-section-title">Progress</span>
            <span className="form-section-hint">Listened toggle · tracklist · per-track rating</span>
          </div>
          <div className="field-group">
            <label>Listened?</label>
            <div className="yesno">
              <button type="button" className={consumed ? 'pill active' : 'pill'} onClick={() => {
                setConsumed(true)
                // Album flipped to Listened → cascade the flag onto every
                // track so the tracklist reflects the same state without
                // per-row clicks. Flipping back to "No" leaves the tracks
                // alone (user might want to log individual listens later).
                setTracks((prev) => prev.map((t) => (t.listened ? t : { ...t, listened: true })))
              }}>Listened</button>
              <button type="button" className={!consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(false)}>No</button>
            </div>
          </div>
          <div className="field-group">
            <label>Add tracks?</label>
            <div className="yesno">
              <button type="button" className={hasTracks ? 'pill active' : 'pill'} onClick={() => setHasTracks(true)}>Yes</button>
              <button type="button" className={!hasTracks ? 'pill active' : 'pill'} onClick={() => { setHasTracks(false); setTracks([]) }}>No</button>
            </div>
            {hasTracks && (
              <TrackListEditor
                tracks={tracks}
                mainArtist={artist}
                albumTitle={title}
                discCount={discCount}
                onAdd={(t) => setTracks((prev) => [...prev, { ...t, id: crypto.randomUUID() }])}
                onRemove={(id) => setTracks((prev) => prev.filter((t) => t.id !== id))}
                onToggleFavorite={(id) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)))}
                onRatingChange={(id, r) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, rating: r || undefined } : t)))}
                onArtistChange={(id, a) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, artist: a || undefined } : t)))}
                onFillAllArtist={() => setTracks((prev) => prev.map((t) => ({ ...t, artist })))}
                onToggleListened={(id) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, listened: !t.listened } : t)))}
                onLyricsChange={(id, lyrics) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, lyrics } : t)))}
                onNumberChange={(id, number) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, number } : t)))}
                onNameChange={(id, name) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)))}
                onDurationChange={(id, duration) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, duration } : t)))}
                onDiscChange={(id, disc) => setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, disc: disc || undefined } : t)))}
              />
            )}
          </div>
          <div className="form-section-header" data-belongs-to="overview">
            <span className="form-section-title">Rating &amp; day listened</span>
          </div>
          <div className="field-group">
            <label>Rating</label>
            <RatingPicker value={rating} onChange={setRating} />
          </div>
          <div className="field-group">
            <label>Day listened</label>
            <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
          </div>
          <div className="field-group">
            <label>Single covers</label>
            <p className="hint">Artwork for singles released with their own cover (often before the album).</p>
            <SingleCoverEditor
              singles={singleCovers}
              onAdd={(s) => setSingleCovers((prev) => [...prev, { ...s, id: crypto.randomUUID() }])}
              onRemove={(id) => setSingleCovers((prev) => prev.filter((s) => s.id !== id))}
            />
          </div>
          <div className="field-group">
            <label>Editions</label>
            <p className="hint">Deluxe, Japan, Anniversary… each with its own cover and extra tracks.</p>
            <EditionsEditor editions={editions} mainArtist={artist} onChange={setEditions} />
          </div>
        </>
      ) : (
        <>
          <div className="field-row">
            <div className="field-group">
              <label>Release date</label>
              <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
            </div>
            <div className="field-group">
              <label>Release year</label>
              <input value={releaseYear} onChange={(e) => yearHandler(setReleaseYear)(e.target.value)} inputMode="numeric" maxLength={4} />
            </div>
          </div>
          <div className="field-row">
            <div className="field-group">
              <label>Part of album</label>
              <select
                value={partOfAlbumId}
                onChange={(e) => {
                  const id = e.target.value
                  setPartOfAlbumId(id)
                  // Copy the picked album's title into the free-text
                  // fallback so exports / imports / detail cards
                  // without live resolution still show a label.
                  if (id) {
                    const picked = items.find((i) => i.id === id)
                    if (picked) setPartOfAlbum(picked.title)
                  }
                }}
              >
                <option value="">— none —</option>
                {items
                  .filter((i) => i.categoryId === 'musica' && i.id !== editingId && isAlbumLikeMusic(i.musicType) && (!artist.trim() || (i.artist ?? '').toLowerCase() === artist.trim().toLowerCase()))
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
              <p className="hint">Link this single / EP / OST to the album it was later collected into. Options are filtered to album-like Music entries by the same artist.</p>
            </div>
            <div className="field-group">
              <label>…or free-text</label>
              <input
                value={partOfAlbum}
                onChange={(e) => setPartOfAlbum(e.target.value)}
                placeholder="Album title (used when it isn't in your library)"
              />
            </div>
          </div>
          <div className="form-section-header" data-belongs-to="progress">
            <span className="form-section-title">Progress</span>
            <span className="form-section-hint">Listened toggle · tracklist · per-track rating</span>
          </div>
          <div className="field-group">
            <label>Listened?</label>
            <div className="yesno">
              <button type="button" className={consumed ? 'pill active' : 'pill'} onClick={() => {
                setConsumed(true)
                // Album flipped to Listened → cascade the flag onto every
                // track so the tracklist reflects the same state without
                // per-row clicks. Flipping back to "No" leaves the tracks
                // alone (user might want to log individual listens later).
                setTracks((prev) => prev.map((t) => (t.listened ? t : { ...t, listened: true })))
              }}>Listened</button>
              <button type="button" className={!consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(false)}>No</button>
            </div>
          </div>
          <div className="form-section-header" data-belongs-to="overview">
            <span className="form-section-title">Rating &amp; day listened</span>
          </div>
          <div className="field-group">
            <label>Rating</label>
            <RatingPicker value={rating} onChange={setRating} />
          </div>
          <div className="field-group">
            <label>Completion date</label>
            <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
          </div>
        </>
      )}
      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">Review</span>
        <span className="form-section-hint">Your take · with optional spoiler toggle</span>
      </div>
      <div className="field-group">
        <label>Review</label>
        <textarea value={musicReview} onChange={(e) => setMusicReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
        {musicReview.trim() && (
          <div className="yesno">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
            <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
          </div>
        )}
      </div>
      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">Listen history</span>
      </div>
      <div className="field-group">
        <label>Listen history</label>
        <RewatchListEditor
          rewatches={rewatches}
          onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
          onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
          onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
          onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
        />
      </div>
      <div className="form-section-header" data-belongs-to="related">
        <span className="form-section-title">Related &amp; recommendations</span>
      </div>
      <div className="field-group">
        <label>Related albums</label>
        <RelatedListEditor
          related={relatedItems}
              crossLibrary
              allItems={relatedCrossLibraryOptions}
          options={items.filter((i) => i.categoryId === 'musica' && i.id !== editingId)}
          onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
          onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
          onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
          pickerPlaceholder="Add related album…"
        />
      </div>
      <div className="field-group">
        <label>Recommendations</label>
        <RecommendationsEditor
          ids={recommendedItems}
          options={items.filter((i) => i.categoryId === 'musica' && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder="Add recommended album…"
        />
      </div>
    </>
  )
}
