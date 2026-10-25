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
import { weekdayFromDate } from '../../utils/airing'
import TagEditor from './TagEditor'
import RatingPicker from './RatingPicker'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'
import EpisodeListEditor from './EpisodeListEditor'
import { t } from '../../i18n'

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
        <span className="form-section-title">{t('{value} details', { value: activeCategory === 'donghua' ? t('Donghua') : t('Anime') })}</span>
        <span className="form-section-hint">{t('Studios, format, airing, episodes')}</span>
      </div>
      <TagEditor
        label={t('Studios')}
        placeholder={t('Add studio')}
        tags={studios}
        onAdd={(s) => setStudios((prev) => prev.includes(s) ? prev : [...prev, s])}
        onRemove={(i) => setStudios((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-group">
        <label>{t('Description')}</label>
        <textarea value={animeDescription} onChange={(e) => setAnimeDescription(e.target.value)} rows={3} />
      </div>
      <TagEditor
        label={t('Genres')}
        placeholder={t('Add genre')}
        tags={genres}
        onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
        onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-group">
        <label>{t('Format')}</label>
        <select value={animeFormat} onChange={(e) => setAnimeFormat(e.target.value as AnimeFormat | '')}>
          <option value="">{t('Unspecified')}</option>
          {ANIME_FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>{t('Season aired')}</label>
          <select value={season} onChange={(e) => setSeason(e.target.value as AnimeSeason | '')}>
            <option value="">{t('Unspecified')}</option>
            {ANIME_SEASON_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>{t('Season year')}</label>
          <input value={seasonYear} onChange={(e) => yearHandler(setSeasonYear)(e.target.value)} inputMode="numeric" maxLength={4} placeholder={t('e.g. 2006')} />
        </div>
      </div>
      <div className="field-group">
        <label>{t('Demographic')}</label>
        <select value={demographic} onChange={(e) => setDemographic(e.target.value as Demographic | '')}>
          <option value="">{t('Unspecified')}</option>
          {DEMOGRAPHIC_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>
      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">{t('Progress')}</span>
        <span className="form-section-hint">{t('Watch status · airing · episodes watched · episode list')}</span>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>{t('Watch status')}</label>
          <select value={watchStatus} onChange={(e) => setWatchStatus(e.target.value as AnimeStatus)}>
            {ANIME_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>{t('Airing status')}</label>
          <select value={airingStatus} onChange={(e) => {
            const next = e.target.value as AiringStatus | ''
            setAiringStatus(next)
            if (next === 'airing' && !airingDay) setAiringDay(weekdayFromDate(airedFrom) ?? '')
          }}>
            <option value="">{t('Unknown')}</option>
            {AIRING_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {airingStatus === 'airing' && (
        <div className="field-group">
          <label>{t('Airs on')}{' '}<span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>{t('Simulcast board slots the show into this weekday column')}</span></label>
          <select value={airingDay} onChange={(e) => setAiringDay(e.target.value as Weekday | '')}>
            <option value="">{t('Unknown')}</option>
            {WEEKDAY_OPTIONS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>
      )}
      <div className="field-row">
        <div className="field-group">
          <label>{t('Episodes watched')}</label>
          <input value={episodesWatched} onChange={(e) => intHandler(setEpisodesWatched)(e.target.value)} inputMode="numeric" placeholder={t('e.g. 12')} />
        </div>
        <div className="field-group">
          <label>{t('Total episodes (if known)')}</label>
          <input value={totalEpisodes} onChange={(e) => intHandler(setTotalEpisodes)(e.target.value)} inputMode="numeric" placeholder={t('e.g. 24')} />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>{t('Start date')}</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field-group">
          <label>{t('Finished on')}</label>
          <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
        </div>
      </div>
      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">{t('Rating')}</span>
      </div>
      <div className="field-group">
        <label>{t('Rating')}</label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">{t('Extended identity')}</span>
        <span className="form-section-hint">{t('Alt titles · source · age rating · duration')}</span>
      </div>
      <TagEditor
        label={t('Alternative titles')}
        placeholder={t('Add title (English, Japanese, synonym…)')}
        tags={alternativeTitles}
        onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
        onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-row">
        <div className="field-group">
          <label>{t('Source')}</label>
          <select value={animeSource} onChange={(e) => setAnimeSource(e.target.value as AnimeSource | '')}>
            <option value="">{t('Unspecified')}</option>
            {ANIME_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>{t('Age rating')}</label>
          <select value={ageRating} onChange={(e) => setAgeRating(e.target.value as AgeRating | '')}>
            <option value="">{t('Unspecified')}</option>
            {AGE_RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>{t('Ep. duration (min)')}</label>
          <input value={episodeDuration} onChange={(e) => intHandler(setEpisodeDuration)(e.target.value)} inputMode="numeric" placeholder={t('e.g. 24')} />
        </div>
        <div className="field-group">
          <label>{t('Aired from')}</label>
          <input type="date" value={airedFrom} onChange={(e) => {
            setAiredFrom(e.target.value)
            const day = weekdayFromDate(e.target.value)
            if (day) setAiringDay(day)
          }} />
        </div>
        <div className="field-group">
          <label>{t('Aired to')}</label>
          <input type="date" value={airedTo} onChange={(e) => setAiredTo(e.target.value)} />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>{t('Favorite episode')}</label>
          <input value={favoriteEpisode} onChange={(e) => intHandler(setFavoriteEpisode)(e.target.value)} inputMode="numeric" placeholder={t('e.g. 8')} />
        </div>
        <div className="field-group">
          <label>{t('Favorite ep. note')}</label>
          <input value={favoriteEpisodeNote} onChange={(e) => setFavoriteEpisodeNote(e.target.value)} placeholder={t('Why is it your favorite?')} />
        </div>
      </div>
      {watchStatus === 'dropped' && (
        <div className="field-row">
          <div className="field-group">
            <label>{t('Dropped at ep.')}</label>
            <input value={droppedAtEpisode} onChange={(e) => intHandler(setDroppedAtEpisode)(e.target.value)} inputMode="numeric" placeholder={t('e.g. 5')} />
          </div>
          <div className="field-group">
            <label>{t('Reason')}</label>
            <input value={droppedReason} onChange={(e) => setDroppedReason(e.target.value)} placeholder={t('Why did you drop it?')} />
          </div>
        </div>
      )}
      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">{t('Review')}</span>
        <span className="form-section-hint">{t('Your take · with optional spoiler toggle')}</span>
      </div>
      <div className="field-group">
        <label>{t('Review')}</label>
        <textarea value={animeReview} onChange={(e) => setAnimeReview(e.target.value)} rows={3} placeholder={t('Your review (supports **bold**, *italic*, and "- " lists)')} />
        {animeReview.trim() && (
          <div className="yesno">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>{t('Contains spoilers')}</button>
            <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>{t('No spoilers')}</button>
          </div>
        )}
      </div>
      <div className="field-group">
        <label>{t('Franchise')}</label>
        <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder={t('e.g. Fullmetal Alchemist')} />
      </div>
      <div className="form-section-header" data-belongs-to="related">
        <span className="form-section-title">{t('Related & recommendations')}</span>
      </div>
      <div className="field-group">
        <label>{t('Related anime')}</label>
        <RelatedListEditor
          related={relatedItems}
          crossLibrary
          allItems={relatedCrossLibraryOptions}
          options={items.filter((i) => isAnimeLikeCategory(i.categoryId) && i.id !== editingId)}
          onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
          onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
          onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
          pickerPlaceholder={t('Add related anime…')}
        />
      </div>
      <div className="field-group">
        <label>{t('Recommendations')}</label>
        <RecommendationsEditor
          ids={recommendedItems}
          options={items.filter((i) => isAnimeLikeCategory(i.categoryId) && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder={t('Add recommended anime…')}
        />
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
      <div className="field-group">
        <label>{t('Episode list?')}</label>
        <div className="yesno">
          <button type="button" className={hasEpisodes ? 'pill active' : 'pill'} onClick={() => setHasEpisodes(true)}>{t('Yes')}</button>
          <button type="button" className={!hasEpisodes ? 'pill active' : 'pill'} onClick={() => { setHasEpisodes(false); setEpisodes([]) }}>{t('No')}</button>
        </div>
        {hasEpisodes && (episodes.some((e) => /^[a-z]/i.test(e.number))) && (
          <div className="episode-number-legend">
            <span>{t('Number prefix legend (AniDB):')}</span>
            <code>1, 2, 3…</code>{' '}{t('regular ·')}
            <code>{t('S')}</code>{' '}{t('special / OVA ·')}
            <code>{t('C')}</code>{' '}{t('credits (opening/ending) ·')}
            <code>{t('T')}</code>{' '}{t('trailer / PV ·')}
            <code>{t('P')}</code>{' '}{t('parody ·')}
            <code>{t('O')}</code> other
          </div>
        )}
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
