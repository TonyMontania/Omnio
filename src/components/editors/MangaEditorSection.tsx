// Manga / Manhwa / Manhua / Western-comics slice of the item editor form.
// Same extraction pattern as MovieEditorSection / GameEditorSection.
// All state stays on App.tsx; this component takes value + setter per field.

import type {
  Item, RelatedItem, RewatchEntry, Chapter, MangaVolume,
  MangaStatus, PublicationStatus, MangaSource, AgeRating, MediaOwnership,
} from '../../types'
import {
  MANGA_STATUS_OPTIONS, PUBLICATION_STATUS_OPTIONS, MANGA_SOURCE_OPTIONS,
  AGE_RATING_OPTIONS, MEDIA_OWNERSHIP_OPTIONS,
} from '../../types'
import { isMangaLike } from '../../types'
import TagEditor from './TagEditor'
import RatingPicker from './RatingPicker'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'
import ChapterListEditor from './ChapterListEditor'
import VolumeCoverEditor from './VolumeCoverEditor'

type Setter<T> = (updater: T | ((prev: T) => T)) => void

export interface MangaEditorSectionProps {
  editingId: string | null
  items: Item[]
  relatedCrossLibraryOptions: Item[]
  mangaAuthors: string[];               setMangaAuthors: Setter<string[]>
  mangaArtists: string[];               setMangaArtists: Setter<string[]>
  mangaDescription: string;             setMangaDescription: (v: string) => void
  genres: string[];                     setGenres: Setter<string[]>
  pubStatus: PublicationStatus | '';    setPubStatus: (v: PublicationStatus | '') => void
  readingStatus: MangaStatus;           setReadingStatus: (v: MangaStatus) => void
  chaptersRead: string;                 setChaptersRead: (v: string) => void
  totalChapters: string;                setTotalChapters: (v: string) => void
  volumesRead: string;                  setVolumesRead: (v: string) => void
  totalVolumesM: string;                setTotalVolumesM: (v: string) => void
  releaseDate: string;                  setReleaseDate: (v: string) => void
  startDate: string;                    setStartDate: (v: string) => void
  finishedAt: string;                   setFinishedAt: (v: string) => void
  rating: number;                       setRating: (v: number) => void
  alternativeTitles: string[];          setAlternativeTitles: Setter<string[]>
  mangaSource: MangaSource | '';        setMangaSource: (v: MangaSource | '') => void
  ageRating: AgeRating | '';            setAgeRating: (v: AgeRating | '') => void
  magazine: string;                     setMagazine: (v: string) => void
  mediaOwnership: MediaOwnership | ''; setMediaOwnership: (v: MediaOwnership | '') => void
  mangadexId: string;                   setMangadexId: (v: string) => void
  mangaReview: string;                  setMangaReview: (v: string) => void
  hasSpoilers: boolean;                 setHasSpoilers: (v: boolean) => void
  rewatches: RewatchEntry[];            setRewatches: Setter<RewatchEntry[]>
  franchise: string;                    setFranchise: (v: string) => void
  relatedItems: RelatedItem[];          setRelatedItems: Setter<RelatedItem[]>
  recommendedItems: string[];           setRecommendedItems: Setter<string[]>
  hasChapters: boolean;                 setHasChapters: (v: boolean) => void
  chapters: Chapter[];                  setChapters: Setter<Chapter[]>
  volumeCovers: MangaVolume[];          setVolumeCovers: Setter<MangaVolume[]>
  intHandler: (setter: (v: string) => void) => (v: string) => void
}

export default function MangaEditorSection(props: MangaEditorSectionProps) {
  const {
    editingId, items, relatedCrossLibraryOptions,
    mangaAuthors, setMangaAuthors, mangaArtists, setMangaArtists,
    mangaDescription, setMangaDescription, genres, setGenres,
    pubStatus, setPubStatus, readingStatus, setReadingStatus,
    chaptersRead, setChaptersRead, totalChapters, setTotalChapters,
    volumesRead, setVolumesRead, totalVolumesM, setTotalVolumesM,
    releaseDate, setReleaseDate, startDate, setStartDate, finishedAt, setFinishedAt,
    rating, setRating, alternativeTitles, setAlternativeTitles,
    mangaSource, setMangaSource, ageRating, setAgeRating,
    magazine, setMagazine, mediaOwnership, setMediaOwnership,
    mangadexId, setMangadexId, mangaReview, setMangaReview,
    hasSpoilers, setHasSpoilers, rewatches, setRewatches,
    franchise, setFranchise, relatedItems, setRelatedItems,
    recommendedItems, setRecommendedItems,
    hasChapters, setHasChapters, chapters, setChapters,
    volumeCovers, setVolumeCovers, intHandler,
  } = props

  return (
    <>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Publication details</span>
        <span className="form-section-hint">Authors, artists, chapters, magazine</span>
      </div>
      <TagEditor
        label="Authors"
        placeholder="Add author"
        tags={mangaAuthors}
        onAdd={(a) => setMangaAuthors((prev) => prev.includes(a) ? prev : [...prev, a])}
        onRemove={(i) => setMangaAuthors((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <TagEditor
        label="Artists"
        placeholder="Add artist"
        tags={mangaArtists}
        onAdd={(a) => setMangaArtists((prev) => prev.includes(a) ? prev : [...prev, a])}
        onRemove={(i) => setMangaArtists((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-group">
        <label>Description</label>
        <textarea value={mangaDescription} onChange={(e) => setMangaDescription(e.target.value)} rows={3} />
      </div>
      <TagEditor
        label="Genres"
        placeholder="Add genre"
        tags={genres}
        onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
        onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">Progress</span>
        <span className="form-section-hint">Reading status · chapters / volumes read · chapter list</span>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Publication status</label>
          <select value={pubStatus} onChange={(e) => setPubStatus(e.target.value as PublicationStatus | '')}>
            <option value="">Unknown</option>
            {PUBLICATION_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Reading status</label>
          <select value={readingStatus} onChange={(e) => setReadingStatus(e.target.value as MangaStatus)}>
            {MANGA_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Chapters read</label>
          <input value={chaptersRead} onChange={(e) => intHandler(setChaptersRead)(e.target.value)} inputMode="numeric" placeholder="e.g. 45" />
        </div>
        <div className="field-group">
          <label>Total chapters (if known)</label>
          <input value={totalChapters} onChange={(e) => intHandler(setTotalChapters)(e.target.value)} inputMode="numeric" placeholder="e.g. 120" />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Volumes read</label>
          <input value={volumesRead} onChange={(e) => intHandler(setVolumesRead)(e.target.value)} inputMode="numeric" placeholder="e.g. 5" />
        </div>
        <div className="field-group">
          <label>Total volumes (if known)</label>
          <input value={totalVolumesM} onChange={(e) => intHandler(setTotalVolumesM)(e.target.value)} inputMode="numeric" placeholder="e.g. 14" />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Publication date</label>
          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
        </div>
        <div className="field-group">
          <label>Start date (personal)</label>
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
        <span className="form-section-hint">Alt titles · source · age rating · magazine</span>
      </div>
      <TagEditor
        label="Alternative titles"
        placeholder="Add title (romaji, English, synonym…)"
        tags={alternativeTitles}
        onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
        onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-row">
        <div className="field-group">
          <label>Source</label>
          <select value={mangaSource} onChange={(e) => setMangaSource(e.target.value as MangaSource | '')}>
            <option value="">Unspecified</option>
            {MANGA_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Age rating</label>
          <select value={ageRating} onChange={(e) => setAgeRating(e.target.value as AgeRating | '')}>
            <option value="">Unspecified</option>
            {AGE_RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Magazine / serialization</label>
          <input value={magazine} onChange={(e) => setMagazine(e.target.value)} placeholder="e.g. Weekly Shonen Jump" />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Ownership</label>
          <select value={mediaOwnership} onChange={(e) => setMediaOwnership(e.target.value as MediaOwnership | '')}>
            <option value="">— unspecified</option>
            {MEDIA_OWNERSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>MangaDex ID <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>Enables the "New chapters" link in the detail view</span></label>
          <input value={mangadexId} onChange={(e) => setMangadexId(e.target.value)} placeholder="e.g. a1c7c817-4e59-43b7-9365-09675a149a6f" />
        </div>
      </div>
      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">Review</span>
        <span className="form-section-hint">Your take · with optional spoiler toggle</span>
      </div>
      <div className="field-group">
        <label>Review</label>
        <textarea value={mangaReview} onChange={(e) => setMangaReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
        {mangaReview.trim() && (
          <div className="yesno">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
            <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
          </div>
        )}
      </div>
      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">Read history</span>
      </div>
      <div className="field-group">
        <label>Reread history</label>
        <RewatchListEditor
          rewatches={rewatches}
          onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
          onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
          onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
          onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
        />
      </div>
      <div className="field-group">
        <label>Franchise</label>
        <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Naruto saga" />
      </div>
      <div className="form-section-header" data-belongs-to="related">
        <span className="form-section-title">Related &amp; recommendations</span>
      </div>
      <div className="field-group">
        <label>Related manga</label>
        <RelatedListEditor
          related={relatedItems}
          crossLibrary
          allItems={relatedCrossLibraryOptions}
          options={items.filter((i) => isMangaLike(i.categoryId) && i.id !== editingId)}
          onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
          onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
          onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
          pickerPlaceholder="Add related manga…"
        />
      </div>
      <div className="field-group">
        <label>Recommendations</label>
        <RecommendationsEditor
          ids={recommendedItems}
          options={items.filter((i) => isMangaLike(i.categoryId) && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder="Add recommended manga…"
        />
      </div>
      <div className="field-group">
        <label>Chapter list?</label>
        <div className="yesno">
          <button type="button" className={hasChapters ? 'pill active' : 'pill'} onClick={() => setHasChapters(true)}>Yes</button>
          <button type="button" className={!hasChapters ? 'pill active' : 'pill'} onClick={() => { setHasChapters(false); setChapters([]) }}>No</button>
        </div>
        {hasChapters && (
          <ChapterListEditor
            chapters={chapters}
            onAdd={(c) => setChapters((prev) => [...prev, { ...c, id: crypto.randomUUID() }])}
            onRemove={(id) => setChapters((prev) => prev.filter((c) => c.id !== id))}
            onUpdate={(id, patch) => setChapters((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))}
            onToggleRead={(id) => setChapters((prev) => prev.map((c) => c.id === id ? { ...c, read: !c.read, readDate: !c.read ? new Date().toISOString().slice(0, 10) : c.readDate } : c))}
            onRatingChange={(id, r) => setChapters((prev) => prev.map((c) => c.id === id ? { ...c, rating: r || undefined } : c))}
            onBulkAdd={(count) => setChapters((prev) => {
              const start = prev.length + 1
              const additions: Chapter[] = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), number: String(start + i) }))
              return [...prev, ...additions]
            })}
          />
        )}
      </div>
      <div className="form-section-header" data-belongs-to="media">
        <span className="form-section-title">Volume covers</span>
        <span className="form-section-hint">One cover per volume — gallery</span>
      </div>
      <div className="field-group">
        <label>Volume covers</label>
        <VolumeCoverEditor
          volumes={volumeCovers}
          onAdd={(v) => setVolumeCovers((prev) => [...prev, { ...v, id: crypto.randomUUID() }])}
          onRemove={(id) => setVolumeCovers((prev) => prev.filter((v) => v.id !== id))}
        />
      </div>
    </>
  )
}
