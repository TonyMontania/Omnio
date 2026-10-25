// Movies-specific slice of the item editor form. Same extraction
// pattern as MusicEditorSection / GameEditorSection — all state stays
// on App.tsx, this component takes value + setter for every field.

import type { Item, MovieSource, RelatedItem, RewatchEntry, WatchLocation } from '../../types'
import { MOVIE_SOURCE_OPTIONS, WATCH_LOCATION_OPTIONS } from '../../types'
import TagEditor from './TagEditor'
import RatingPicker from './RatingPicker'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'
import { t } from '../../i18n'

type Setter<T> = (updater: T | ((prev: T) => T)) => void

export interface MovieEditorSectionProps {
  editingId: string | null
  items: Item[]
  relatedCrossLibraryOptions: Item[]
  directors: string[];                 setDirectors: Setter<string[]>
  writers: string[];                   setWriters: Setter<string[]>
  cast: string[];                      setCast: Setter<string[]>
  productionCompanies: string[];       setProductionCompanies: Setter<string[]>
  distributors: string[];              setDistributors: Setter<string[]>
  movieDescription: string;            setMovieDescription: (v: string) => void
  genres: string[];                    setGenres: Setter<string[]>
  releaseDate: string;                 setReleaseDate: (v: string) => void
  releaseYear: string;                 setReleaseYear: (v: string) => void
  duration: string;                    setDuration: (v: string) => void
  franchise: string;                   setFranchise: (v: string) => void
  consumed: boolean;                   setConsumed: (v: boolean) => void
  timesWatched: string;                setTimesWatched: (v: string) => void
  watchedWhere: WatchLocation | '';    setWatchedWhere: (v: WatchLocation | '') => void
  rating: number;                      setRating: (v: number) => void
  finishedAt: string;                  setFinishedAt: (v: string) => void
  alternativeTitles: string[];         setAlternativeTitles: Setter<string[]>
  movieSource: MovieSource | '';       setMovieSource: (v: MovieSource | '') => void
  contentRating: string;               setContentRating: (v: string) => void
  movieReview: string;                 setMovieReview: (v: string) => void
  hasSpoilers: boolean;                setHasSpoilers: (v: boolean) => void
  rewatches: RewatchEntry[];           setRewatches: Setter<RewatchEntry[]>
  relatedItems: RelatedItem[];         setRelatedItems: Setter<RelatedItem[]>
  recommendedItems: string[];          setRecommendedItems: Setter<string[]>
  yearHandler: (setter: (v: string) => void) => (v: string) => void
  intHandler: (setter: (v: string) => void) => (v: string) => void
}

export default function MovieEditorSection(props: MovieEditorSectionProps) {
  const {
    editingId, items, relatedCrossLibraryOptions,
    directors, setDirectors, writers, setWriters, cast, setCast,
    productionCompanies, setProductionCompanies, distributors, setDistributors,
    movieDescription, setMovieDescription, genres, setGenres,
    releaseDate, setReleaseDate, releaseYear, setReleaseYear,
    duration, setDuration, franchise, setFranchise,
    consumed, setConsumed, timesWatched, setTimesWatched,
    watchedWhere, setWatchedWhere, rating, setRating, finishedAt, setFinishedAt,
    alternativeTitles, setAlternativeTitles, movieSource, setMovieSource,
    contentRating, setContentRating, movieReview, setMovieReview,
    hasSpoilers, setHasSpoilers, rewatches, setRewatches,
    relatedItems, setRelatedItems, recommendedItems, setRecommendedItems,
    yearHandler, intHandler,
  } = props

  return (
    <>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">{t('Movie details')}</span>
        <span className="form-section-hint">{t('Cast, crew, franchise')}</span>
      </div>
      <TagEditor label={t('Directors')} placeholder={t('Add director')} tags={directors} onAdd={(d) => setDirectors((prev) => prev.includes(d) ? prev : [...prev, d])} onRemove={(i) => setDirectors((prev) => prev.filter((_, idx) => idx !== i))} />
      <TagEditor label={t('Writers')} placeholder={t('Add writer')} tags={writers} onAdd={(w) => setWriters((prev) => prev.includes(w) ? prev : [...prev, w])} onRemove={(i) => setWriters((prev) => prev.filter((_, idx) => idx !== i))} />
      <TagEditor label={t('Cast')} placeholder={t('Add actor/actress')} tags={cast} onAdd={(c) => setCast((prev) => prev.includes(c) ? prev : [...prev, c])} onRemove={(i) => setCast((prev) => prev.filter((_, idx) => idx !== i))} />
      <TagEditor label={t('Production companies')} placeholder={t('Add production company')} tags={productionCompanies} onAdd={(c) => setProductionCompanies((prev) => prev.includes(c) ? prev : [...prev, c])} onRemove={(i) => setProductionCompanies((prev) => prev.filter((_, idx) => idx !== i))} />
      <TagEditor label={t('Distributed by')} placeholder={t('Add distributor')} tags={distributors} onAdd={(d) => setDistributors((prev) => prev.includes(d) ? prev : [...prev, d])} onRemove={(i) => setDistributors((prev) => prev.filter((_, idx) => idx !== i))} />
      <div className="field-group">
        <label>{t('Description')}</label>
        <textarea value={movieDescription} onChange={(e) => setMovieDescription(e.target.value)} rows={3} />
      </div>
      <TagEditor label={t('Genres')} placeholder={t('Add genre')} tags={genres} onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])} onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))} />
      <div className="field-row">
        <div className="field-group">
          <label>{t('Release date')}</label>
          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
        </div>
        <div className="field-group">
          <label>{t('Release year')}</label>
          <input value={releaseYear} onChange={(e) => yearHandler(setReleaseYear)(e.target.value)} inputMode="numeric" maxLength={4} placeholder={t('e.g. 2023')} />
        </div>
        <div className="field-group">
          <label>{t('Duration (minutes)')}</label>
          <input value={duration} onChange={(e) => intHandler(setDuration)(e.target.value)} inputMode="numeric" placeholder={t('e.g. 120')} />
        </div>
      </div>
      <div className="field-group">
        <label>{t('Franchise / Saga (optional)')}</label>
        <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder={t('e.g. Fast & Furious')} />
      </div>
      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">{t('Progress')}</span>
        <span className="form-section-hint">{t('Watched status · rewatch count')}</span>
      </div>
      <div className="field-group">
        <label>{t('Watched?')}</label>
        <div className="yesno">
          <button type="button" className={consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(true)}>{t('Watched')}</button>
          <button type="button" className={!consumed ? 'pill active' : 'pill'} onClick={() => setConsumed(false)}>{t('No')}</button>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>{t('Times watched (rewatches)')}</label>
          <input value={timesWatched} onChange={(e) => intHandler(setTimesWatched)(e.target.value)} inputMode="numeric" placeholder={t('e.g. 2')} />
        </div>
        <div className="field-group">
          <label>{t('Where watched')}</label>
          <select value={watchedWhere} onChange={(e) => setWatchedWhere(e.target.value as WatchLocation | '')}>
            <option value="">{t('Unspecified')}</option>
            {WATCH_LOCATION_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">{t('Rating & completion')}</span>
      </div>
      <div className="field-group">
        <label>{t('Rating')}</label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>
      <div className="field-group">
        <label>{t('Watched on')}</label>
        <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
      </div>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">{t('Extended identity')}</span>
        <span className="form-section-hint">{t('Alt titles · source · content rating')}</span>
      </div>
      <TagEditor label={t('Alternative titles')} placeholder={t('Add title (original, translated…)')} tags={alternativeTitles} onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])} onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))} />
      <div className="field-row">
        <div className="field-group">
          <label>{t('Source')}</label>
          <select value={movieSource} onChange={(e) => setMovieSource(e.target.value as MovieSource | '')}>
            <option value="">{t('Unspecified')}</option>
            {MOVIE_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>{t('Content rating')}</label>
          <input value={contentRating} onChange={(e) => setContentRating(e.target.value)} placeholder={t('e.g. PG-13, R')} />
        </div>
      </div>
      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">{t('Review')}</span>
        <span className="form-section-hint">{t('Your take on this movie · with optional spoiler toggle')}</span>
      </div>
      <div className="field-group">
        <label>{t('Review')}</label>
        <textarea value={movieReview} onChange={(e) => setMovieReview(e.target.value)} rows={3} placeholder={t('Your review (supports **bold**, *italic*, and "- " lists)')} />
        {movieReview.trim() && (
          <div className="yesno">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>{t('Contains spoilers')}</button>
            <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>{t('No spoilers')}</button>
          </div>
        )}
      </div>
      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">{t('Watch history')}</span>
      </div>
      <div className="field-group">
        <label>{t('Watch history')}</label>
        <RewatchListEditor
          rewatches={rewatches}
          onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
          onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
          onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
          onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
          labels={{ rewatch: t('Rewatched'), started: t('Started watching'), finished: t('Finished watching'), dropped: t('Dropped'), note: t('Note') }}
        />
      </div>
      <div className="form-section-header" data-belongs-to="related">
        <span className="form-section-title">{t('Related & recommendations')}</span>
      </div>
      <div className="field-group">
        <label>{t('Related movies')}</label>
        <RelatedListEditor
          related={relatedItems}
          crossLibrary
          allItems={relatedCrossLibraryOptions}
          options={items.filter((i) => i.categoryId === 'peliculas' && i.id !== editingId)}
          onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
          onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
          onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
          pickerPlaceholder={t('Add related movie…')}
        />
      </div>
      <div className="field-group">
        <label>{t('Recommendations')}</label>
        <RecommendationsEditor
          ids={recommendedItems}
          options={items.filter((i) => i.categoryId === 'peliculas' && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder={t('Add recommended movie…')}
        />
      </div>
    </>
  )
}
