// Anime / Donghua slice of the item editor form. Same extraction
// pattern as MovieEditorSection / GameEditorSection — all state stays
// on App.tsx, this component takes value + setter for every field.

import type {
  Item, RelatedItem, RewatchEntry, Episode,
  AnimeFormat, AnimeSeason, Demographic, AnimeStatus, AiringStatus,
  Weekday, AnimeSource, AgeRating,
} from '../../types'
import {
  ANIME_FORMAT_OPTIONS, ANIME_SEASON_OPTIONS, DEMOGRAPHIC_OPTIONS,
  ANIME_STATUS_OPTIONS, AIRING_STATUS_OPTIONS, WEEKDAY_OPTIONS,
  ANIME_SOURCE_OPTIONS, AGE_RATING_OPTIONS,
} from '../../types'
import { isAnimeLikeCategory } from '../../categories'
import TagEditor from './TagEditor'
import RatingPicker from './RatingPicker'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'
import EpisodeListEditor from './EpisodeListEditor'

type Setter<T> = (updater: T | ((prev: T) => T)) => void

export interface AnimeEditorSectionProps {
  editingId: string | null
  activeCategory: string
  items: Item[]
  relatedCrossLibraryOptions: Item[]
  studios: string[];                       setStudios: Setter<string[]>
  animeDescription: string;                setAnimeDescription: (v: string) => void
  genres: string[];                        setGenres: Setter<string[]>
  animeFormat: AnimeFormat | '';           setAnimeFormat: (v: AnimeFormat | '') => void
  season: AnimeSeason | '';                setSeason: (v: AnimeSeason | '') => void
  seasonYear: string;                      setSeasonYear: (v: string) => void
  demographic: Demographic | '';           setDemographic: (v: Demographic | '') => void
  watchStatus: AnimeStatus;                setWatchStatus: (v: AnimeStatus) => void
  airingStatus: AiringStatus | '';         setAiringStatus: (v: AiringStatus | '') => void
  airingDay: Weekday | '';                 setAiringDay: (v: Weekday | '') => void
  episodesWatched: string;                 setEpisodesWatched: (v: string) => void
  totalEpisodes: string;                   setTotalEpisodes: (v: string) => void
  startDate: string;                       setStartDate: (v: string) => void
  finishedAt: string;                      setFinishedAt: (v: string) => void
  rating: number;                          setRating: (v: number) => void
  alternativeTitles: string[];             setAlternativeTitles: Setter<string[]>
  animeSource: AnimeSource | '';           setAnimeSource: (v: AnimeSource | '') => void
  ageRating: AgeRating | '';               setAgeRating: (v: AgeRating | '') => void
  episodeDuration: string;                 setEpisodeDuration: (v: string) => void
  airedFrom: string;                       setAiredFrom: (v: string) => void
  airedTo: string;                         setAiredTo: (v: string) => void
  favoriteEpisode: string;                 setFavoriteEpisode: (v: string) => void
  favoriteEpisodeNote: string;             setFavoriteEpisodeNote: (v: string) => void
  droppedAtEpisode: string;                setDroppedAtEpisode: (v: string) => void
  droppedReason: string;                   setDroppedReason: (v: string) => void
  animeReview: string;                     setAnimeReview: (v: string) => void
  hasSpoilers: boolean;                    setHasSpoilers: (v: boolean) => void
  franchise: string;                       setFranchise: (v: string) => void
  rewatches: RewatchEntry[];               setRewatches: Setter<RewatchEntry[]>
  relatedItems: RelatedItem[];             setRelatedItems: Setter<RelatedItem[]>
  recommendedItems: string[];              setRecommendedItems: Setter<string[]>
  hasEpisodes: boolean;                    setHasEpisodes: (v: boolean) => void
  episodes: Episode[];                     setEpisodes: Setter<Episode[]>
  yearHandler: (setter: (v: string) => void) => (v: string) => void
  intHandler: (setter: (v: string) => void) => (v: string) => void
}

export default function AnimeEditorSection(props: AnimeEditorSectionProps) {
  const {
    editingId, activeCategory, items, relatedCrossLibraryOptions,
    studios, setStudios, animeDescription, setAnimeDescription,
    genres, setGenres, animeFormat, setAnimeFormat,
    season, setSeason, seasonYear, setSeasonYear,
    demographic, setDemographic, watchStatus, setWatchStatus,
    airingStatus, setAiringStatus, airingDay, setAiringDay,
    episodesWatched, setEpisodesWatched, totalEpisodes, setTotalEpisodes,
    startDate, setStartDate, finishedAt, setFinishedAt,
    rating, setRating, alternativeTitles, setAlternativeTitles,
    animeSource, setAnimeSource, ageRating, setAgeRating,
    episodeDuration, setEpisodeDuration, airedFrom, setAiredFrom, airedTo, setAiredTo,
    favoriteEpisode, setFavoriteEpisode, favoriteEpisodeNote, setFavoriteEpisodeNote,
    droppedAtEpisode, setDroppedAtEpisode, droppedReason, setDroppedReason,
    animeReview, setAnimeReview, hasSpoilers, setHasSpoilers,
    franchise, setFranchise, rewatches, setRewatches,
    relatedItems, setRelatedItems, recommendedItems, setRecommendedItems,
    hasEpisodes, setHasEpisodes, episodes, setEpisodes,
    yearHandler, intHandler,
  } = props

  return (
    <>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">{activeCategory === 'donghua' ? 'Donghua' : 'Anime'} details</span>
        <span className="form-section-hint">Studios, format, airing, episodes</span>
      </div>
      <TagEditor
        label="Studios"
        placeholder="Add studio"
        tags={studios}
        onAdd={(s) => setStudios((prev) => prev.includes(s) ? prev : [...prev, s])}
        onRemove={(i) => setStudios((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-group">
        <label>Description</label>
        <textarea value={animeDescription} onChange={(e) => setAnimeDescription(e.target.value)} rows={3} />
      </div>
      <TagEditor
        label="Genres"
        placeholder="Add genre"
        tags={genres}
        onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
        onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-group">
        <label>Format</label>
        <select value={animeFormat} onChange={(e) => setAnimeFormat(e.target.value as AnimeFormat | '')}>
          <option value="">Unspecified</option>
          {ANIME_FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Season aired</label>
          <select value={season} onChange={(e) => setSeason(e.target.value as AnimeSeason | '')}>
            <option value="">Unspecified</option>
            {ANIME_SEASON_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Season year</label>
          <input value={seasonYear} onChange={(e) => yearHandler(setSeasonYear)(e.target.value)} inputMode="numeric" maxLength={4} placeholder="e.g. 2006" />
        </div>
      </div>
      <div className="field-group">
        <label>Demographic</label>
        <select value={demographic} onChange={(e) => setDemographic(e.target.value as Demographic | '')}>
          <option value="">Unspecified</option>
          {DEMOGRAPHIC_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>
      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">Progress</span>
        <span className="form-section-hint">Watch status · airing · episodes watched · episode list</span>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Watch status</label>
          <select value={watchStatus} onChange={(e) => setWatchStatus(e.target.value as AnimeStatus)}>
            {ANIME_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Airing status</label>
          <select value={airingStatus} onChange={(e) => setAiringStatus(e.target.value as AiringStatus | '')}>
            <option value="">Unknown</option>
            {AIRING_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {airingStatus === 'airing' && (
        <div className="field-group">
          <label>Airs on <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>Simulcast board slots the show into this weekday column</span></label>
          <select value={airingDay} onChange={(e) => setAiringDay(e.target.value as Weekday | '')}>
            <option value="">Unknown</option>
            {WEEKDAY_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      )}
      <div className="field-row">
        <div className="field-group">
          <label>Episodes watched</label>
          <input value={episodesWatched} onChange={(e) => intHandler(setEpisodesWatched)(e.target.value)} inputMode="numeric" placeholder="e.g. 12" />
        </div>
        <div className="field-group">
          <label>Total episodes (if known)</label>
          <input value={totalEpisodes} onChange={(e) => intHandler(setTotalEpisodes)(e.target.value)} inputMode="numeric" placeholder="e.g. 24" />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field-group">
          <label>Finished on</label>
          <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
        </div>
      </div>
      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">Rating</span>
      </div>
      <div className="field-group">
        <label>Rating</label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Extended identity</span>
        <span className="form-section-hint">Alt titles · source · age rating · duration</span>
      </div>
      <TagEditor
        label="Alternative titles"
        placeholder="Add title (English, Japanese, synonym…)"
        tags={alternativeTitles}
        onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
        onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-row">
        <div className="field-group">
          <label>Source</label>
          <select value={animeSource} onChange={(e) => setAnimeSource(e.target.value as AnimeSource | '')}>
            <option value="">Unspecified</option>
            {ANIME_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Age rating</label>
          <select value={ageRating} onChange={(e) => setAgeRating(e.target.value as AgeRating | '')}>
            <option value="">Unspecified</option>
            {AGE_RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Ep. duration (min)</label>
          <input value={episodeDuration} onChange={(e) => intHandler(setEpisodeDuration)(e.target.value)} inputMode="numeric" placeholder="e.g. 24" />
        </div>
        <div className="field-group">
          <label>Aired from</label>
          <input type="date" value={airedFrom} onChange={(e) => setAiredFrom(e.target.value)} />
        </div>
        <div className="field-group">
          <label>Aired to</label>
          <input type="date" value={airedTo} onChange={(e) => setAiredTo(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Favorite episode</label>
          <input value={favoriteEpisode} onChange={(e) => intHandler(setFavoriteEpisode)(e.target.value)} inputMode="numeric" placeholder="e.g. 8" />
        </div>
        <div className="field-group">
          <label>Favorite ep. note</label>
          <input value={favoriteEpisodeNote} onChange={(e) => setFavoriteEpisodeNote(e.target.value)} placeholder="Why is it your favorite?" />
        </div>
      </div>
      {watchStatus === 'dropped' && (
        <div className="field-row">
          <div className="field-group">
            <label>Dropped at ep.</label>
            <input value={droppedAtEpisode} onChange={(e) => intHandler(setDroppedAtEpisode)(e.target.value)} inputMode="numeric" placeholder="e.g. 5" />
          </div>
          <div className="field-group">
            <label>Reason</label>
            <input value={droppedReason} onChange={(e) => setDroppedReason(e.target.value)} placeholder="Why did you drop it?" />
          </div>
        </div>
      )}
      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">Review</span>
        <span className="form-section-hint">Your take · with optional spoiler toggle</span>
      </div>
      <div className="field-group">
        <label>Review</label>
        <textarea value={animeReview} onChange={(e) => setAnimeReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
        {animeReview.trim() && (
          <div className="yesno">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
            <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
          </div>
        )}
      </div>
      <div className="field-group">
        <label>Franchise</label>
        <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Fullmetal Alchemist" />
      </div>
      <div className="form-section-header" data-belongs-to="related">
        <span className="form-section-title">Related &amp; recommendations</span>
      </div>
      <div className="field-group">
        <label>Related anime</label>
        <RelatedListEditor
          related={relatedItems}
          crossLibrary
          allItems={relatedCrossLibraryOptions}
          options={items.filter((i) => isAnimeLikeCategory(i.categoryId) && i.id !== editingId)}
          onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
          onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
          onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
          pickerPlaceholder="Add related anime…"
        />
      </div>
      <div className="field-group">
        <label>Recommendations</label>
        <RecommendationsEditor
          ids={recommendedItems}
          options={items.filter((i) => isAnimeLikeCategory(i.categoryId) && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder="Add recommended anime…"
        />
      </div>
      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">Watch history</span>
      </div>
      <div className="field-group">
        <label>Rewatch history</label>
        <RewatchListEditor
          rewatches={rewatches}
          onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
          onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
          onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
          onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
        />
      </div>
      <div className="field-group">
        <label>Episode list?</label>
        <div className="yesno">
          <button type="button" className={hasEpisodes ? 'pill active' : 'pill'} onClick={() => setHasEpisodes(true)}>Yes</button>
          <button type="button" className={!hasEpisodes ? 'pill active' : 'pill'} onClick={() => { setHasEpisodes(false); setEpisodes([]) }}>No</button>
        </div>
        {hasEpisodes && (
          <EpisodeListEditor
            episodes={episodes}
            onAdd={(e) => setEpisodes((prev) => [...prev, { ...e, id: crypto.randomUUID() }])}
            onRemove={(id) => setEpisodes((prev) => prev.filter((e) => e.id !== id))}
            onUpdate={(id, patch) => setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e))}
            onToggleWatched={(id) => setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, watched: !e.watched, watchedDate: !e.watched ? new Date().toISOString().slice(0, 10) : e.watchedDate } : e))}
            onToggleFiller={(id) => setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, filler: !e.filler } : e))}
            onRatingChange={(id, r) => setEpisodes((prev) => prev.map((e) => e.id === id ? { ...e, rating: r || undefined } : e))}
            onBulkAdd={(count) => setEpisodes((prev) => {
              const start = prev.length + 1
              const additions: Episode[] = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), number: String(start + i) }))
              return [...prev, ...additions]
            })}
          />
        )}
      </div>
    </>
  )
}
