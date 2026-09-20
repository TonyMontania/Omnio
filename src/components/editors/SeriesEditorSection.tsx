// Series-specific slice of the item editor form. Same extraction
// pattern as the other *EditorSection components.

import type { Item, RelatedItem, RewatchEntry, Season, SeriesFormat, SeriesStatus, WatchLocation } from '../../types'
import { SERIES_STATUS_OPTIONS, SERIES_FORMAT_OPTIONS, WATCH_LOCATION_OPTIONS } from '../../types'
import TagEditor from './TagEditor'
import RatingPicker from './RatingPicker'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'
import SeasonListEditor from './SeasonListEditor'

type Setter<T> = (updater: T | ((prev: T) => T)) => void

export interface SeriesEditorSectionProps {
  editingId: string | null
  items: Item[]
  relatedCrossLibraryOptions: Item[]
  seriesDescription: string;           setSeriesDescription: (v: string) => void
  directors: string[];                 setDirectors: Setter<string[]>
  showrunners: string[];               setShowrunners: Setter<string[]>
  writers: string[];                   setWriters: Setter<string[]>
  cast: string[];                      setCast: Setter<string[]>
  genres: string[];                    setGenres: Setter<string[]>
  seriesStatus: SeriesStatus;          setSeriesStatus: (v: SeriesStatus) => void
  seriesFormat: SeriesFormat | '';     setSeriesFormat: (v: SeriesFormat | '') => void
  network: string;                     setNetwork: (v: string) => void
  watchedWhere: WatchLocation | '';    setWatchedWhere: (v: WatchLocation | '') => void
  country: string;                     setCountry: (v: string) => void
  language: string;                    setLanguage: (v: string) => void
  contentRating: string;               setContentRating: (v: string) => void
  unitCount: string;                   handleUnitCountChange: (v: string) => void
  totalEpisodes: string;               setTotalEpisodes: (v: string) => void
  episodesWatched: string;             setEpisodesWatched: (v: string) => void
  episodeDuration: string;             setEpisodeDuration: (v: string) => void
  startYear: string;                   setStartYear: (v: string) => void
  endYear: string;                     setEndYear: (v: string) => void
  airedFrom: string;                   setAiredFrom: (v: string) => void
  airedTo: string;                     setAiredTo: (v: string) => void
  startDate: string;                   setStartDate: (v: string) => void
  finishedAt: string;                  setFinishedAt: (v: string) => void
  franchise: string;                   setFranchise: (v: string) => void
  rating: number;                      setRating: (v: number) => void
  seriesReview: string;                setSeriesReview: (v: string) => void
  hasSpoilers: boolean;                setHasSpoilers: (v: boolean) => void
  rewatches: RewatchEntry[];           setRewatches: Setter<RewatchEntry[]>
  relatedItems: RelatedItem[];         setRelatedItems: Setter<RelatedItem[]>
  recommendedItems: string[];          setRecommendedItems: Setter<string[]>
  hasSeasons: boolean;                 setHasSeasons: (v: boolean) => void
  seasons: Season[];                   setSeasons: Setter<Season[]>
  yearHandler: (setter: (v: string) => void) => (v: string) => void
  intHandler: (setter: (v: string) => void) => (v: string) => void
}

export default function SeriesEditorSection(props: SeriesEditorSectionProps) {
  const {
    editingId, items, relatedCrossLibraryOptions,
    seriesDescription, setSeriesDescription,
    directors, setDirectors, showrunners, setShowrunners, writers, setWriters, cast, setCast, genres, setGenres,
    seriesStatus, setSeriesStatus, seriesFormat, setSeriesFormat,
    network, setNetwork, watchedWhere, setWatchedWhere,
    country, setCountry, language, setLanguage, contentRating, setContentRating,
    unitCount, handleUnitCountChange, totalEpisodes, setTotalEpisodes,
    episodesWatched, setEpisodesWatched, episodeDuration, setEpisodeDuration,
    startYear, setStartYear, endYear, setEndYear,
    airedFrom, setAiredFrom, airedTo, setAiredTo,
    startDate, setStartDate, finishedAt, setFinishedAt,
    franchise, setFranchise, rating, setRating,
    seriesReview, setSeriesReview, hasSpoilers, setHasSpoilers,
    rewatches, setRewatches, relatedItems, setRelatedItems, recommendedItems, setRecommendedItems,
    hasSeasons, setHasSeasons, seasons, setSeasons,
    yearHandler, intHandler,
  } = props

  return (
    <>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Series details</span>
        <span className="form-section-hint">Cast, crew, network, seasons</span>
      </div>
      <div className="field-group">
        <label>Description</label>
        <textarea value={seriesDescription} onChange={(e) => setSeriesDescription(e.target.value)} rows={3} />
      </div>
      <TagEditor label="Directors" placeholder="Add director" tags={directors} onAdd={(d) => setDirectors((prev) => prev.includes(d) ? prev : [...prev, d])} onRemove={(i) => setDirectors((prev) => prev.filter((_, idx) => idx !== i))} />
      <TagEditor label="Showrunners" placeholder="Add showrunner" tags={showrunners} onAdd={(s) => setShowrunners((prev) => prev.includes(s) ? prev : [...prev, s])} onRemove={(i) => setShowrunners((prev) => prev.filter((_, idx) => idx !== i))} />
      <TagEditor label="Writers" placeholder="Add writer" tags={writers} onAdd={(w) => setWriters((prev) => prev.includes(w) ? prev : [...prev, w])} onRemove={(i) => setWriters((prev) => prev.filter((_, idx) => idx !== i))} />
      <TagEditor label="Cast" placeholder="Add actor" tags={cast} onAdd={(c) => setCast((prev) => prev.includes(c) ? prev : [...prev, c])} onRemove={(i) => setCast((prev) => prev.filter((_, idx) => idx !== i))} />
      <TagEditor label="Genres" placeholder="Add genre" tags={genres} onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])} onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))} />
      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">Progress</span>
        <span className="form-section-hint">Watch status · seasons watched · per-episode tracking</span>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Watch status</label>
          <select value={seriesStatus} onChange={(e) => setSeriesStatus(e.target.value as SeriesStatus)}>
            {SERIES_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Format</label>
          <select value={seriesFormat} onChange={(e) => setSeriesFormat(e.target.value as SeriesFormat | '')}>
            <option value="">Unspecified</option>
            {SERIES_FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Network</label>
          <input value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="e.g. HBO, Netflix" />
        </div>
        <div className="field-group">
          <label>Watched where</label>
          <select value={watchedWhere} onChange={(e) => setWatchedWhere(e.target.value as WatchLocation | '')}>
            <option value="">Unspecified</option>
            {WATCH_LOCATION_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Country</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. USA" />
        </div>
        <div className="field-group">
          <label>Language</label>
          <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. English" />
        </div>
        <div className="field-group">
          <label>Content rating</label>
          <input value={contentRating} onChange={(e) => setContentRating(e.target.value)} placeholder="e.g. TV-MA" />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Number of seasons</label>
          <input value={unitCount} onChange={(e) => handleUnitCountChange(e.target.value)} inputMode="numeric" placeholder="e.g. 5" />
        </div>
        <div className="field-group">
          <label>Total episodes</label>
          <input value={totalEpisodes} onChange={(e) => intHandler(setTotalEpisodes)(e.target.value)} inputMode="numeric" placeholder="e.g. 62" />
        </div>
        <div className="field-group">
          <label>Episodes watched</label>
          <input value={episodesWatched} onChange={(e) => intHandler(setEpisodesWatched)(e.target.value)} inputMode="numeric" placeholder="e.g. 40" />
        </div>
        <div className="field-group">
          <label>Ep. duration (min)</label>
          <input value={episodeDuration} onChange={(e) => intHandler(setEpisodeDuration)(e.target.value)} inputMode="numeric" placeholder="e.g. 45" />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>First season year</label>
          <input value={startYear} onChange={(e) => yearHandler(setStartYear)(e.target.value)} inputMode="numeric" maxLength={4} />
        </div>
        <div className="field-group">
          <label>Last season year</label>
          <input value={endYear} onChange={(e) => yearHandler(setEndYear)(e.target.value)} inputMode="numeric" maxLength={4} />
        </div>
      </div>
      <div className="field-row">
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
          <label>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field-group">
          <label>Completion date</label>
          <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
        </div>
      </div>
      <div className="field-group">
        <label>Franchise</label>
        <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Star Trek" />
      </div>
      <div className="form-section-header" data-belongs-to="related">
        <span className="form-section-title">Related &amp; recommendations</span>
      </div>
      <div className="field-group">
        <label>Related series</label>
        <RelatedListEditor
          related={relatedItems}
              crossLibrary
              allItems={relatedCrossLibraryOptions}
          options={items.filter((i) => i.categoryId === 'series' && i.id !== editingId)}
          onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
          onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
          onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
          pickerPlaceholder="Add related series…"
        />
      </div>
      <div className="field-group">
        <label>Recommendations</label>
        <RecommendationsEditor
          ids={recommendedItems}
          options={items.filter((i) => i.categoryId === 'series' && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder="Add recommended series…"
        />
      </div>
      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">Rating</span>
      </div>
      <div className="field-group">
        <label>Rating</label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>
      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">Review</span>
        <span className="form-section-hint">Your take on this series · with optional spoiler toggle</span>
      </div>
      <div className="field-group">
        <label>Review</label>
        <textarea value={seriesReview} onChange={(e) => setSeriesReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
        {seriesReview.trim() && (
          <div className="yesno">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
            <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
          </div>
        )}
      </div>
      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">Watch history</span>
      </div>
      <div className="field-group">
        <label>Watch history</label>
        <RewatchListEditor
          rewatches={rewatches}
          onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
          onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
          onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
          onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
          labels={{ rewatch: 'Rewatched', started: 'Started watching', finished: 'Finished watching', dropped: 'Dropped', note: 'Note' }}
        />
      </div>
      <div className="field-group">
        <label>Season list?</label>
        <div className="yesno">
          <button type="button" className={hasSeasons ? 'pill active' : 'pill'} onClick={() => setHasSeasons(true)}>Yes</button>
          <button type="button" className={!hasSeasons ? 'pill active' : 'pill'} onClick={() => { setHasSeasons(false); setSeasons([]) }}>No</button>
        </div>
        {hasSeasons && (
          <SeasonListEditor
            seasons={seasons}
            onAdd={(s) => setSeasons((prev) => [...prev, { ...s, id: crypto.randomUUID() }])}
            onRemove={(id) => setSeasons((prev) => prev.filter((s) => s.id !== id))}
            onUpdate={(id, patch) => setSeasons((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))}
            onToggleWatched={(id) => setSeasons((prev) => prev.map((s) => s.id === id ? { ...s, watched: !s.watched, watchedDate: !s.watched ? new Date().toISOString().slice(0, 10) : s.watchedDate } : s))}
            onRatingChange={(id, r) => setSeasons((prev) => prev.map((s) => s.id === id ? { ...s, rating: r || undefined } : s))}
            onBulkAdd={(count) => setSeasons((prev) => {
              const start = prev.length + 1
              const additions: Season[] = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), number: String(start + i) }))
              return [...prev, ...additions]
            })}
            onEpisodesChange={(seasonId, eps) => setSeasons((prev) => prev.map((s) => s.id === seasonId ? { ...s, episodes: eps } : s))}
          />
        )}
      </div>
    </>
  )
}
