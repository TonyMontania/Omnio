// Books slice of the item editor form. Same extraction pattern as
// MovieEditorSection / GameEditorSection. All state stays on App.tsx;
// this component takes value + setter per field.

import type {
  Item, RelatedItem, RewatchEntry, ChapterNote,
  BookStatus, BookFormat, BookSource, PublicationStatus,
} from '../../types'
import {
  BOOK_STATUS_OPTIONS, BOOK_FORMAT_OPTIONS, BOOK_SOURCE_OPTIONS,
  PUBLICATION_STATUS_OPTIONS,
} from '../../types'
import TagEditor from './TagEditor'
import RatingPicker from './RatingPicker'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'
import ChapterNotesEditor from './ChapterNotesEditor'

type Setter<T> = (updater: T | ((prev: T) => T)) => void

export interface BookEditorSectionProps {
  editingId: string | null
  items: Item[]
  relatedCrossLibraryOptions: Item[]
  bookStatus: BookStatus;                setBookStatus: (v: BookStatus) => void
  mangaAuthors: string[];                setMangaAuthors: Setter<string[]>
  bookFormat: BookFormat | '';           setBookFormat: (v: BookFormat | '') => void
  pubStatus: PublicationStatus | '';     setPubStatus: (v: PublicationStatus | '') => void
  publisher: string;                     setPublisher: (v: string) => void
  isbn: string;                          setIsbn: (v: string) => void
  saga: string;                          setSaga: (v: string) => void
  sagaIndex: string;                     setSagaIndex: (v: string) => void
  bookSource: BookSource | '';           setBookSource: (v: BookSource | '') => void
  translator: string;                    setTranslator: (v: string) => void
  description: string;                   setDescription: (v: string) => void
  pagesRead: string;                     setPagesRead: (v: string) => void
  totalPages: string;                    setTotalPages: (v: string) => void
  startDate: string;                     setStartDate: (v: string) => void
  rating: number;                        setRating: (v: number) => void
  finishedAt: string;                    setFinishedAt: (v: string) => void
  bookReview: string;                    setBookReview: (v: string) => void
  hasSpoilers: boolean;                  setHasSpoilers: (v: boolean) => void
  chapterNotes: ChapterNote[];           setChapterNotes: Setter<ChapterNote[]>
  rewatches: RewatchEntry[];             setRewatches: Setter<RewatchEntry[]>
  franchise: string;                     setFranchise: (v: string) => void
  relatedItems: RelatedItem[];           setRelatedItems: Setter<RelatedItem[]>
  recommendedItems: string[];            setRecommendedItems: Setter<string[]>
}

export default function BookEditorSection(props: BookEditorSectionProps) {
  const {
    editingId, items, relatedCrossLibraryOptions,
    bookStatus, setBookStatus, mangaAuthors, setMangaAuthors,
    bookFormat, setBookFormat, pubStatus, setPubStatus,
    publisher, setPublisher, isbn, setIsbn,
    saga, setSaga, sagaIndex, setSagaIndex,
    bookSource, setBookSource, translator, setTranslator,
    description, setDescription, pagesRead, setPagesRead, totalPages, setTotalPages,
    startDate, setStartDate, rating, setRating, finishedAt, setFinishedAt,
    bookReview, setBookReview, hasSpoilers, setHasSpoilers,
    chapterNotes, setChapterNotes, rewatches, setRewatches,
    franchise, setFranchise, relatedItems, setRelatedItems,
    recommendedItems, setRecommendedItems,
  } = props

  return (
    <>
      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">Reading status</span>
      </div>
      <div className="field-group">
        <label>Status</label>
        <select value={bookStatus} onChange={(e) => setBookStatus(e.target.value as BookStatus)}>
          {BOOK_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Book details</span>
        <span className="form-section-hint">Authors, publisher, series, ISBN, format, source</span>
      </div>
      <TagEditor
        label="Authors"
        tags={mangaAuthors}
        onAdd={(a) => setMangaAuthors((prev) => prev.includes(a) ? prev : [...prev, a])}
        onRemove={(i) => setMangaAuthors((prev) => prev.filter((_, idx) => idx !== i))}
        placeholder="Add author"
      />
      <div className="field-grid two">
        <div className="field-group">
          <label>Format</label>
          <select value={bookFormat} onChange={(e) => setBookFormat(e.target.value as BookFormat | '')}>
            <option value="">—</option>
            {BOOK_FORMAT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Publication status</label>
          <select value={pubStatus} onChange={(e) => setPubStatus(e.target.value as PublicationStatus | '')}>
            <option value="">—</option>
            {PUBLICATION_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Publisher</label>
          <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="e.g. Tor Books" />
        </div>
        <div className="field-group">
          <label>ISBN</label>
          <input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="e.g. 978-0-7653-1178-8" />
        </div>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Series / saga</label>
          <input value={saga} onChange={(e) => setSaga(e.target.value)} placeholder="e.g. The Stormlight Archive" />
        </div>
        <div className="field-group">
          <label>Book # in series</label>
          <input value={sagaIndex} onChange={(e) => setSagaIndex(e.target.value)} placeholder="e.g. Book 1" />
        </div>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Source</label>
          <select value={bookSource} onChange={(e) => setBookSource(e.target.value as BookSource | '')}>
            <option value="">—</option>
            {BOOK_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Translator</label>
          <input value={translator} onChange={(e) => setTranslator(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="field-group">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} placeholder="Book synopsis" />
      </div>

      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">Progress</span>
        <span className="form-section-hint">Pages read / total · start date</span>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Pages read</label>
          <input value={pagesRead} onChange={(e) => setPagesRead(e.target.value.replace(/[^\d]/g, ''))} placeholder="e.g. 120" />
        </div>
        <div className="field-group">
          <label>Total pages</label>
          <input value={totalPages} onChange={(e) => setTotalPages(e.target.value.replace(/[^\d]/g, ''))} placeholder="e.g. 350" />
        </div>
      </div>
      <div className="field-group">
        <label>Started reading</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>

      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">Rating &amp; completion</span>
      </div>
      <div className="field-group">
        <label>Rating</label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>
      <div className="field-group">
        <label>Completion date</label>
        <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
      </div>

      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">Review</span>
        <span className="form-section-hint">Your take · with optional spoiler toggle</span>
      </div>
      <div className="field-group">
        <label>Review</label>
        <textarea value={bookReview} onChange={(e) => setBookReview(e.target.value)} rows={4} placeholder="Your review" />
        {bookReview.trim() && (
          <div className="field-inline">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(!hasSpoilers)}>Contains spoilers</button>
          </div>
        )}
      </div>
      <ChapterNotesEditor entries={chapterNotes} onChange={setChapterNotes} />

      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">Reread history</span>
        <span className="form-section-hint">Log each reread with date + optional rating and notes</span>
      </div>
      <div className="field-group">
        <label>Rereads</label>
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
        <label>Franchise</label>
        <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. Cosmere, Middle-earth…" />
      </div>
      <div className="field-group">
        <label>Related books</label>
        <RelatedListEditor
          related={relatedItems}
          options={items.filter((i) => i.categoryId === 'libros' && i.id !== editingId)}
          crossLibrary
          allItems={relatedCrossLibraryOptions}
          onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
          onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
          onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
          pickerPlaceholder="Add related item… (any library)"
        />
      </div>
      <div className="field-group">
        <label>Recommendations</label>
        <RecommendationsEditor
          ids={recommendedItems}
          options={items.filter((i) => i.categoryId === 'libros' && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder="Add recommended book…"
        />
      </div>
    </>
  )
}
