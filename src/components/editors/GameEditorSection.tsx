// Games-specific slice of the item editor form. Same extraction pattern
// as MusicEditorSection — all state stays on App.tsx, this component
// takes value + setter for every field it renders. See that file's
// header comment for the design rationale.

import type { AgeRating, DlcEntry, BundleGame, GameSource, GameStatus, Item, Ownership, Platform, RelatedItem, RewatchEntry, SaveFile, Achievement, Screenshot } from '../../types'
import { OWNERSHIP_OPTIONS, GAME_STATUS_OPTIONS, GAME_SOURCE_OPTIONS, AGE_RATING_OPTIONS } from '../../types'
import TagEditor from './TagEditor'
import PlatformEditor from './PlatformEditor'
import RatingPicker from './RatingPicker'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'
import GameSubItems from './GameSubItems'
import BundleGamesEditor from './BundleGamesEditor'
import PcgwSavePaths from './PcgwSavePaths'
import SaveFilesEditor from './SaveFilesEditor'
import AchievementListEditor from './AchievementListEditor'
import ScreenshotsGallery from './ScreenshotsGallery'
import AnimeItemPicker from './AnimeItemPicker'

type Setter<T> = (updater: T | ((prev: T) => T)) => void

export interface GameEditorSectionProps {
  title: string
  editingId: string | null
  items: Item[]
  activeCategory: string
  relatedCrossLibraryOptions: Item[]
  devs: string[];                       setDevs: Setter<string[]>
  publishers: string[];                 setPublishers: Setter<string[]>
  achievementsUnlocked: string;         setAchievementsUnlocked: (v: string) => void
  achievementsTotal: string;            setAchievementsTotal: (v: string) => void
  releaseDate: string;                  setReleaseDate: (v: string) => void
  description: string;                  setDescription: (v: string) => void
  platforms: Platform[];                setPlatforms: Setter<Platform[]>
  ownership: Ownership | '';            setOwnership: (v: Ownership | '') => void
  gameStatus: GameStatus;               setGameStatus: (v: GameStatus) => void
  playTime: string;                     handlePlayTimeChange: (v: string) => void
  hasDlc: boolean;                      setHasDlc: (v: boolean) => void
  dlcList: DlcEntry[];                  setDlcList: Setter<DlcEntry[]>
  hasAddons: boolean;                   setHasAddons: (v: boolean) => void
  addonsList: DlcEntry[];               setAddonsList: Setter<DlcEntry[]>
  isBundle: boolean;                    setIsBundle: (v: boolean) => void
  bundleContents: BundleGame[];         setBundleContents: Setter<BundleGame[]>
  setBundleSgdbFor: (v: { entryId: string; title: string } | null) => void
  pcgwPage: string | undefined;         setPcgwPage: (v: string | undefined) => void
  saveFiles: SaveFile[];                setSaveFiles: Setter<SaveFile[]>
  achievementsList: Achievement[];      setAchievementsList: Setter<Achievement[]>
  screenshots: Screenshot[];            setScreenshots: Setter<Screenshot[]>
  rating: number;                       setRating: (v: number) => void
  finishedAt: string;                   setFinishedAt: (v: string) => void
  alternativeTitles: string[];          setAlternativeTitles: Setter<string[]>
  genres: string[];                     setGenres: Setter<string[]>
  gameSource: GameSource | '';          setGameSource: (v: GameSource | '') => void
  ageRating: AgeRating | '';            setAgeRating: (v: AgeRating | '') => void
  originalWorkId: string;               setOriginalWorkId: (v: string) => void
  franchise: string;                    setFranchise: (v: string) => void
  gameReview: string;                   setGameReview: (v: string) => void
  hasSpoilers: boolean;                 setHasSpoilers: (v: boolean) => void
  rewatches: RewatchEntry[];            setRewatches: Setter<RewatchEntry[]>
  relatedItems: RelatedItem[];          setRelatedItems: Setter<RelatedItem[]>
  recommendedItems: string[];           setRecommendedItems: Setter<string[]>
}

export default function GameEditorSection(props: GameEditorSectionProps) {
  const {
    title, editingId, items, activeCategory, relatedCrossLibraryOptions,
    devs, setDevs,
    publishers, setPublishers,
    achievementsUnlocked, setAchievementsUnlocked,
    achievementsTotal, setAchievementsTotal,
    releaseDate, setReleaseDate,
    description, setDescription,
    platforms, setPlatforms,
    ownership, setOwnership,
    gameStatus, setGameStatus,
    playTime, handlePlayTimeChange,
    hasDlc, setHasDlc, dlcList, setDlcList,
    hasAddons, setHasAddons, addonsList, setAddonsList,
    isBundle, setIsBundle, bundleContents, setBundleContents, setBundleSgdbFor,
    pcgwPage, setPcgwPage,
    saveFiles, setSaveFiles,
    achievementsList, setAchievementsList,
    screenshots, setScreenshots,
    rating, setRating,
    finishedAt, setFinishedAt,
    alternativeTitles, setAlternativeTitles,
    genres, setGenres,
    gameSource, setGameSource,
    ageRating, setAgeRating,
    originalWorkId, setOriginalWorkId,
    franchise, setFranchise,
    gameReview, setGameReview,
    hasSpoilers, setHasSpoilers,
    rewatches, setRewatches,
    relatedItems, setRelatedItems,
    recommendedItems, setRecommendedItems,
  } = props

  return (
    <>
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Game details</span>
        <span className="form-section-hint">Devs, publishers, platforms, franchise</span>
      </div>
      <TagEditor
        label="Developers"
        placeholder="Add developer"
        tags={devs}
        onAdd={(v) => setDevs((prev) => prev.includes(v) ? prev : [...prev, v])}
        onRemove={(i) => setDevs((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <TagEditor
        label="Publishers"
        placeholder="Add publisher"
        tags={publishers}
        onAdd={(v) => setPublishers((prev) => prev.includes(v) ? prev : [...prev, v])}
        onRemove={(i) => setPublishers((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-row">
        <div className="field-group">
          <label>Achievements unlocked</label>
          <input placeholder="0" value={achievementsUnlocked} onChange={(e) => setAchievementsUnlocked(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </div>
        <div className="field-group">
          <label>Achievements total</label>
          <input placeholder="0" value={achievementsTotal} onChange={(e) => setAchievementsTotal(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </div>
      </div>
      <div className="field-group">
        <label>Release date</label>
        <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
      </div>
      <div className="field-group">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="field-group">
        <label>Platforms</label>
        <PlatformEditor value={platforms} onChange={setPlatforms} existing={Array.from(new Set(items.filter((i) => i.categoryId === 'videojuegos').flatMap((i) => i.platforms || [])))} />
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Ownership</label>
          <select value={ownership} onChange={(e) => setOwnership(e.target.value as Ownership | '')}>
            <option value="">Unspecified</option>
            {OWNERSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Status</label>
          <select value={gameStatus} onChange={(e) => setGameStatus(e.target.value as GameStatus)}>
            {GAME_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">Progress</span>
        <span className="form-section-hint">Time played · DLC · addons · bundle contents · achievements</span>
      </div>
      <div className="field-group">
        <label>Time played (hours.minutes)</label>
        <input placeholder="e.g. 22.49" value={playTime} onChange={(e) => handlePlayTimeChange(e.target.value)} inputMode="decimal" />
      </div>
      <GameSubItems
        question="Has DLC or expansions?"
        placeholder="DLC/expansion name"
        enabled={hasDlc}
        onToggle={(v) => { setHasDlc(v); if (!v) setDlcList([]) }}
        entries={dlcList}
        onAdd={(name) => setDlcList((prev) => [...prev, { id: crypto.randomUUID(), name, status: 'backlog' }])}
        onRemove={(id) => setDlcList((prev) => prev.filter((d) => d.id !== id))}
        onStatusChange={(id, s) => setDlcList((prev) => prev.map((d) => (d.id === id ? { ...d, status: s } : d)))}
      />
      <GameSubItems
        question="Has addons or packs?"
        placeholder="Addon/pack name"
        enabled={hasAddons}
        onToggle={(v) => { setHasAddons(v); if (!v) setAddonsList([]) }}
        entries={addonsList}
        onAdd={(name) => setAddonsList((prev) => [...prev, { id: crypto.randomUUID(), name, status: 'backlog' }])}
        onRemove={(id) => setAddonsList((prev) => prev.filter((d) => d.id !== id))}
        onStatusChange={(id, s) => setAddonsList((prev) => prev.map((d) => (d.id === id ? { ...d, status: s } : d)))}
        showStatus={false}
      />
      <BundleGamesEditor
        enabled={isBundle}
        onToggle={(v) => { setIsBundle(v); if (!v) setBundleContents([]) }}
        entries={bundleContents}
        onChange={setBundleContents}
        onRequestSgdb={(entryId, title) => setBundleSgdbFor({ entryId, title })}
      />
      <PcgwSavePaths
        gameTitle={title}
        pcgwPage={pcgwPage}
        onPageMatched={setPcgwPage}
      />
      <SaveFilesEditor
        gameTitle={title}
        categoryId={activeCategory}
        saveFiles={saveFiles}
        onChange={setSaveFiles}
      />
      <AchievementListEditor entries={achievementsList} onChange={setAchievementsList} />
      <ScreenshotsGallery
        gameTitle={title}
        categoryId={activeCategory}
        screenshots={screenshots}
        onChange={setScreenshots}
      />
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
      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Extended identity</span>
        <span className="form-section-hint">Alt titles, genres, source, edition, age rating, franchise</span>
      </div>
      <TagEditor
        label="Alternative titles"
        placeholder="Add title (regional, original…)"
        tags={alternativeTitles}
        onAdd={(t) => setAlternativeTitles((prev) => prev.includes(t) ? prev : [...prev, t])}
        onRemove={(i) => setAlternativeTitles((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <TagEditor
        label="Genres"
        placeholder="Add genre"
        tags={genres}
        onAdd={(g) => setGenres((prev) => prev.includes(g) ? prev : [...prev, g])}
        onRemove={(i) => setGenres((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="field-row">
        <div className="field-group">
          <label>Source</label>
          <select value={gameSource} onChange={(e) => setGameSource(e.target.value as GameSource | '')}>
            <option value="">Unspecified</option>
            {GAME_SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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

      {gameSource && gameSource !== 'original' && gameSource !== 'other' && (() => {
        const linked = items.find((i) => i.id === originalWorkId)
        return (
          <div className="field-group">
            <label>Original work</label>
            {linked ? (
              <div className="tag-pill-list">
                <span className="tag-pill">
                  {linked.title}
                  <button type="button" onClick={() => setOriginalWorkId('')}>✕</button>
                </span>
              </div>
            ) : (
              <AnimeItemPicker
                options={items.filter((i) => i.categoryId === 'videojuegos' && i.id !== editingId)}
                excludeIds={[]}
                onPick={(id) => setOriginalWorkId(id)}
                placeholder="Search another game to link as the original…"
              />
            )}
            <p className="hint">Points at the game this one derives from — e.g. Freedom Cry is a standalone expansion of AC IV: Black Flag. Both cards will show the link.</p>
          </div>
        )
      })()}
      <div className="field-group">
        <label>Franchise</label>
        <input value={franchise} onChange={(e) => setFranchise(e.target.value)} placeholder="e.g. The Legend of Zelda" />
      </div>
      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">Review</span>
        <span className="form-section-hint">Your take on this game · with optional spoiler toggle</span>
      </div>
      <div className="field-group">
        <label>Review</label>
        <textarea value={gameReview} onChange={(e) => setGameReview(e.target.value)} rows={3} placeholder='Your review (supports **bold**, *italic*, and "- " lists)' />
        {gameReview.trim() && (
          <div className="yesno">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(true)}>Contains spoilers</button>
            <button type="button" className={!hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(false)}>No spoilers</button>
          </div>
        )}
      </div>
      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">Play history</span>
        <span className="form-section-hint">Every replay / campaign log</span>
      </div>
      <div className="field-group">
        <label>Replay history</label>
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
        <span className="form-section-hint">Sequels, prequels, franchise, hand-picked recs</span>
      </div>
      <div className="field-group">
        <label>Related games</label>
        <RelatedListEditor
          related={relatedItems}
          options={items.filter((i) => i.categoryId === 'videojuegos' && i.id !== editingId)}
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
          options={items.filter((i) => i.categoryId === 'videojuegos' && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder="Add recommended game…"
        />
      </div>
    </>
  )
}
