// Visual Novels slice of the item editor form. VNDB-shaped; every field
// the fetcher fills has a corresponding editor row so the user can tweak
// what came back before saving.

import { useRef } from 'react'
import type {
  Item, RelatedItem, RewatchEntry,
  VisualNovelStatus, VnLength, VnStaffMember, VnStaffRole,
  VnCharacter, VnCharacterRole, VnCover, VnEdition, VnPublisher,
  VnScreenshot, VnDevStatus,
} from '../../types'
import {
  VN_STATUS_OPTIONS, VN_LENGTH_OPTIONS,
  VN_STAFF_ROLE_OPTIONS, VN_CHARACTER_ROLE_OPTIONS,
  VN_ENGINE_SUGGESTIONS, VN_DEV_STATUS_OPTIONS,
  vnLangFlag, vnLangLabel,
} from '../../types'
import { assetSrc } from '../../types'
import { pickImageToDataUrl } from '../../utils/files'
import TagEditor from './TagEditor'
import PlatformEditor from './PlatformEditor'
import RatingPicker from './RatingPicker'
import RewatchListEditor from './RewatchListEditor'
import RelatedListEditor from './RelatedListEditor'
import RecommendationsEditor from './RecommendationsEditor'

type Setter<T> = (updater: T | ((prev: T) => T)) => void

export interface VisualNovelEditorSectionProps {
  editingId: string | null
  items: Item[]
  relatedCrossLibraryOptions: Item[]
  visualNovelStatus: VisualNovelStatus;    setVisualNovelStatus: (v: VisualNovelStatus) => void
  vnDescription: string;                   setVnDescription: (v: string) => void
  devs: string[];                          setDevs: Setter<string[]>
  publishers: string[];                    setPublishers: Setter<string[]>
  vnPublishers: VnPublisher[];             setVnPublishers: Setter<VnPublisher[]>
  vnEngine: string;                        setVnEngine: (v: string) => void
  vnLength: VnLength | '';                 setVnLength: (v: VnLength | '') => void
  vnLengthHours: string;                   setVnLengthHours: (v: string) => void
  vnCommunityRating: string;               setVnCommunityRating: (v: string) => void
  vnDevStatus: VnDevStatus | '';           setVnDevStatus: (v: VnDevStatus | '') => void
  vnOriginalLanguage: string;              setVnOriginalLanguage: (v: string) => void
  vnLanguages: string[];                   setVnLanguages: Setter<string[]>
  vnAliases: string[];                     setVnAliases: Setter<string[]>
  platforms: string[];                     setPlatforms: (v: string[]) => void
  existingPlatforms: string[]
  releaseDate: string;                     setReleaseDate: (v: string) => void
  releaseYear: string;                     setReleaseYear: (v: string) => void
  playTime: string;                        setPlayTime: (v: string) => void
  startDate: string;                       setStartDate: (v: string) => void
  finishedAt: string;                      setFinishedAt: (v: string) => void
  rating: number;                          setRating: (v: number) => void
  nsfw: boolean;                           setNsfw: (v: boolean) => void
  vnStaff: VnStaffMember[];                setVnStaff: Setter<VnStaffMember[]>
  vnCharacters: VnCharacter[];             setVnCharacters: Setter<VnCharacter[]>
  vnCovers: VnCover[];                     setVnCovers: Setter<VnCover[]>
  vnEditions: VnEdition[];                 setVnEditions: Setter<VnEdition[]>
  vnScreenshots: VnScreenshot[];           setVnScreenshots: Setter<VnScreenshot[]>
  cover: string;                           setCover: (v: string) => void
  vnReview: string;                        setVnReview: (v: string) => void
  hasSpoilers: boolean;                    setHasSpoilers: (v: boolean) => void
  rewatches: RewatchEntry[];               setRewatches: Setter<RewatchEntry[]>
  vndbId: string;                          setVndbId: (v: string) => void
  relatedItems: RelatedItem[];             setRelatedItems: Setter<RelatedItem[]>
  recommendedItems: string[];              setRecommendedItems: Setter<string[]>
}

export default function VisualNovelEditorSection(props: VisualNovelEditorSectionProps) {
  const {
    editingId, items, relatedCrossLibraryOptions,
    visualNovelStatus, setVisualNovelStatus,
    vnDescription, setVnDescription,
    devs, setDevs, publishers, setPublishers, vnPublishers, setVnPublishers,
    vnEngine, setVnEngine,
    vnLength, setVnLength, vnLengthHours, setVnLengthHours,
    vnCommunityRating, setVnCommunityRating, vnDevStatus, setVnDevStatus,
    vnOriginalLanguage, setVnOriginalLanguage, vnLanguages, setVnLanguages,
    vnAliases, setVnAliases, platforms, setPlatforms, existingPlatforms,
    releaseDate, setReleaseDate, releaseYear, setReleaseYear,
    playTime, setPlayTime, startDate, setStartDate, finishedAt, setFinishedAt,
    rating, setRating, nsfw, setNsfw,
    vnStaff, setVnStaff, vnCharacters, setVnCharacters,
    vnCovers, setVnCovers, vnEditions, setVnEditions,
    vnScreenshots, setVnScreenshots,
    cover, setCover,
    vnReview, setVnReview, hasSpoilers, setHasSpoilers,
    rewatches, setRewatches, vndbId, setVndbId,
    relatedItems, setRelatedItems, recommendedItems, setRecommendedItems,
  } = props

  const characterFileInputRef = useRef<HTMLInputElement>(null)
  const characterEditIdxRef = useRef<number | null>(null)
  const handleCharImagePick = pickImageToDataUrl((dataUrl) => {
    const i = characterEditIdxRef.current
    if (i === null) return
    setVnCharacters((prev) => prev.map((x, j) => j === i ? { ...x, image: dataUrl } : x))
    characterEditIdxRef.current = null
  })

  return (
    <>
      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">Reading status</span>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Status</label>
          <select value={visualNovelStatus} onChange={(e) => setVisualNovelStatus(e.target.value as VisualNovelStatus)}>
            {VN_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Development status</label>
          <select value={vnDevStatus} onChange={(e) => setVnDevStatus(e.target.value as VnDevStatus | '')}>
            <option value="">—</option>
            {VN_DEV_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Visual novel details</span>
        <span className="form-section-hint">Developers, publishers, engine, aliases, languages, platforms</span>
      </div>
      <TagEditor
        label="Aliases (romaji / English / other)"
        tags={vnAliases}
        onAdd={(v) => setVnAliases((prev) => prev.includes(v) ? prev : [...prev, v])}
        onRemove={(i) => setVnAliases((prev) => prev.filter((_, idx) => idx !== i))}
        placeholder="Add alternate title"
      />
      <div className="field-grid two">
        <TagEditor
          label="Developers"
          tags={devs}
          onAdd={(v) => setDevs((prev) => prev.includes(v) ? prev : [...prev, v])}
          onRemove={(i) => setDevs((prev) => prev.filter((_, idx) => idx !== i))}
          placeholder="Add developer"
        />
        <TagEditor
          label="Publishers (fallback / manual)"
          tags={publishers}
          onAdd={(v) => setPublishers((prev) => prev.includes(v) ? prev : [...prev, v])}
          onRemove={(i) => setPublishers((prev) => prev.filter((_, idx) => idx !== i))}
          placeholder="Add publisher"
        />
      </div>
      {vnPublishers.length > 0 && (
        <div className="field-group">
          <label>Publishers by region</label>
          <p className="hint">One row per (publisher × language) — pulled from every VNDB release. Flag matches the release language.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vnPublishers.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: 16 }}>{vnLangFlag(p.lang)}</span>
                <span style={{ flex: 1 }}>
                  <b>{p.name}</b>
                  {p.original && p.original !== p.name && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>· {p.original}</span>}
                  <span style={{ color: 'var(--text-faint)', marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {vnLangLabel(p.lang)} {p.role && p.role !== 'publisher' ? `· ${p.role}` : ''}
                  </span>
                </span>
                <button type="button" className="secondary-btn" onClick={() => setVnPublishers((prev) => prev.filter((_, j) => j !== i))} title="Remove">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="field-grid two">
        <div className="field-group">
          <label>Engine</label>
          <input
            list="vn-engine-suggestions"
            value={vnEngine}
            onChange={(e) => setVnEngine(e.target.value)}
            placeholder="e.g. Ren'Py"
          />
          <datalist id="vn-engine-suggestions">
            {VN_ENGINE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="field-group">
          <label>Original language</label>
          <input
            value={vnOriginalLanguage}
            onChange={(e) => setVnOriginalLanguage(e.target.value)}
            placeholder="e.g. ja"
          />
        </div>
      </div>
      <TagEditor
        label="Languages available"
        tags={vnLanguages}
        onAdd={(v) => setVnLanguages((prev) => prev.includes(v) ? prev : [...prev, v])}
        onRemove={(i) => setVnLanguages((prev) => prev.filter((_, idx) => idx !== i))}
        placeholder="Add language code (e.g. en)"
      />
      <div className="field-group">
        <label>Platforms</label>
        <PlatformEditor value={platforms} onChange={setPlatforms} existing={existingPlatforms} />
      </div>
      <div className="field-group">
        <label>Description</label>
        <textarea value={vnDescription} onChange={(e) => setVnDescription(e.target.value)} rows={4} placeholder="Synopsis" />
      </div>

      <div className="form-section-header" data-belongs-to="media">
        <span className="form-section-title">Covers gallery</span>
        <span className="form-section-hint">One cover per release. Star the one you want as the main card cover; toggle Exhibited to control which show up in the detail view's "Covers" section.</span>
      </div>
      {vnCovers.length === 0 && (
        <p className="hint">No extra covers yet. Fetching from VNDB downloads every release cover — usually 3–8 per VN.</p>
      )}
      {vnCovers.length > 0 && (
        <div className="field-group">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {vnCovers.map((c, i) => (
              <div key={c.id} style={{ background: 'var(--surface-2)', border: `1px solid ${c.main ? 'var(--accent)' : 'var(--border-soft)'}`, borderRadius: 'var(--radius-sm)', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden', borderRadius: 4, background: 'var(--surface)' }}>
                  <img src={assetSrc(c.path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {c.lang && (
                    <span style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.55)', padding: '2px 6px', borderRadius: 999, fontSize: 14 }} title={vnLangLabel(c.lang)}>{vnLangFlag(c.lang)}</span>
                  )}
                </div>
                {c.releaseTitle && <span style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.releaseTitle}>{c.releaseTitle}</span>}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={c.main ? 'pill active' : 'pill'}
                    onClick={() => {
                      setVnCovers((prev) => prev.map((x, j) => ({ ...x, main: j === i })))
                      setCover(c.path)
                    }}
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    title="Use as the main cover"
                  >★ Main</button>
                  <button
                    type="button"
                    className={c.exhibited ? 'pill active' : 'pill'}
                    onClick={() => setVnCovers((prev) => prev.map((x, j) => j === i ? { ...x, exhibited: !x.exhibited } : x))}
                    style={{ fontSize: 11, padding: '2px 8px' }}
                  >Exhibited</button>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => setVnCovers((prev) => prev.filter((_, j) => j !== i))}
                    style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}
                    title="Remove this cover"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>Main cover is also stored in the top-level <code>cover</code> field so cards and lists render correctly.</p>
        </div>
      )}

      {vnEditions.length > 0 && (
        <>
          <div className="form-section-header" data-belongs-to="identity">
            <span className="form-section-title">Editions</span>
            <span className="form-section-hint">Release editions per language (Original / Steam / fan translation)</span>
          </div>
          <div className="field-group">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {vnEditions.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
                  {e.lang && <span style={{ fontSize: 16 }} title={vnLangLabel(e.lang)}>{vnLangFlag(e.lang)}</span>}
                  <span style={{ flex: 1 }}>
                    <b>{e.name}</b>
                    <span style={{ color: 'var(--text-faint)', marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {e.lang ? vnLangLabel(e.lang) : ''}{e.official ? ' · official' : ' · unofficial'}
                    </span>
                  </span>
                  <button type="button" className="secondary-btn" onClick={() => setVnEditions((prev) => prev.filter((_, j) => j !== i))} title="Remove">×</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">Release &amp; length</span>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Release date</label>
          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
        </div>
        <div className="field-group">
          <label>Release year (fallback)</label>
          <input value={releaseYear} onChange={(e) => setReleaseYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))} placeholder="e.g. 2004" />
        </div>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Length</label>
          <select value={vnLength} onChange={(e) => setVnLength(e.target.value as VnLength | '')}>
            <option value="">—</option>
            {VN_LENGTH_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>Hours (community average)</label>
          <input value={vnLengthHours} onChange={(e) => setVnLengthHours(e.target.value)} placeholder="e.g. 28.5" />
        </div>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Your play time</label>
          <input value={playTime} onChange={(e) => setPlayTime(e.target.value)} placeholder="e.g. 42h" />
        </div>
        <div className="field-group">
          <label>Started</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">Ratings &amp; completion</span>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>Your rating</label>
          <RatingPicker value={rating} onChange={setRating} />
        </div>
        <div className="field-group">
          <label>VNDB community rating (/10)</label>
          <input value={vnCommunityRating} onChange={(e) => setVnCommunityRating(e.target.value)} placeholder="e.g. 8.45" />
        </div>
      </div>
      <div className="field-group">
        <label>Completion date</label>
        <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
      </div>
      <div className="field-group">
        <label>Content flags</label>
        <div className="pills">
          <button type="button" className={nsfw ? 'pill active' : 'pill'} onClick={() => setNsfw(!nsfw)}>18+ / NSFW content</button>
        </div>
      </div>

      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Staff</span>
        <span className="form-section-hint">Writer / artist / composer / director / translator</span>
      </div>
      <div className="field-group">
        <label>Credits</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {vnStaff.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                value={s.name}
                onChange={(e) => setVnStaff((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                placeholder="Name"
                style={{ flex: '1 1 200px' }}
              />
              <select
                value={s.role}
                onChange={(e) => setVnStaff((prev) => prev.map((x, j) => j === i ? { ...x, role: e.target.value as VnStaffRole } : x))}
                style={{ flex: '0 0 180px' }}
              >
                {VN_STAFF_ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <input
                value={s.note ?? ''}
                onChange={(e) => setVnStaff((prev) => prev.map((x, j) => j === i ? { ...x, note: e.target.value } : x))}
                placeholder="Route / notes"
                style={{ flex: '1 1 30%' }}
              />
              <button type="button" className="secondary-btn" onClick={() => setVnStaff((prev) => prev.filter((_, j) => j !== i))} title="Remove">×</button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setVnStaff((prev) => [...prev, { id: crypto.randomUUID(), name: '', role: 'writer' as VnStaffRole }])}
            style={{ alignSelf: 'flex-start' }}
          >
            + Add staff member
          </button>
        </div>
      </div>

      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">Characters</span>
        <span className="form-section-hint">Protagonist, main, side, cameos · with voice actor when voiced</span>
      </div>
      <input ref={characterFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCharImagePick} />
      <div className="field-group">
        <label>Cast</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vnCharacters.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 8, background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ flex: '0 0 72px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ width: 72, height: 96, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.image ? (
                    <img src={assetSrc(c.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>No image</span>
                  )}
                </div>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => { characterEditIdxRef.current = i; characterFileInputRef.current?.click() }}
                  style={{ fontSize: 11, padding: '2px 6px' }}
                >Upload</button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    value={c.name}
                    onChange={(e) => setVnCharacters((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    placeholder="Character name"
                    style={{ flex: '1 1 200px' }}
                  />
                  <select
                    value={c.role}
                    onChange={(e) => setVnCharacters((prev) => prev.map((x, j) => j === i ? { ...x, role: e.target.value as VnCharacterRole } : x))}
                    style={{ flex: '0 0 160px' }}
                  >
                    {VN_CHARACTER_ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <input
                    value={c.seiyuu ?? ''}
                    onChange={(e) => setVnCharacters((prev) => prev.map((x, j) => j === i ? { ...x, seiyuu: e.target.value } : x))}
                    placeholder="Voice actor"
                    style={{ flex: '1 1 180px' }}
                  />
                </div>
                <textarea
                  value={c.description ?? ''}
                  onChange={(e) => setVnCharacters((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                  placeholder="Character description"
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <button type="button" className="secondary-btn" onClick={() => setVnCharacters((prev) => prev.filter((_, j) => j !== i))} title="Remove">×</button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setVnCharacters((prev) => [...prev, { id: crypto.randomUUID(), name: '', role: 'main' as VnCharacterRole }])}
            style={{ alignSelf: 'flex-start' }}
          >
            + Add character
          </button>
        </div>
      </div>

      {vnScreenshots.length > 0 && (
        <>
          <div className="form-section-header" data-belongs-to="media">
            <span className="form-section-title">Screenshots</span>
            <span className="form-section-hint">In-game shots · toggle the NSFW flag to blur individual images in the detail view</span>
          </div>
          <div className="field-group">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {vnScreenshots.map((s, i) => (
                <div key={s.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <img src={assetSrc(s.path)} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 4, filter: s.nsfw ? 'blur(8px)' : 'none' }} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className={s.nsfw ? 'pill active' : 'pill'}
                      onClick={() => setVnScreenshots((prev) => prev.map((x, j) => j === i ? { ...x, nsfw: !x.nsfw } : x))}
                      style={{ fontSize: 11, padding: '2px 8px' }}
                    >NSFW</button>
                    <button type="button" className="pill" onClick={() => setVnScreenshots((prev) => prev.filter((_, j) => j !== i))} style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">Review</span>
        <span className="form-section-hint">Your take · with optional spoiler toggle</span>
      </div>
      <div className="field-group">
        <label>Review</label>
        <textarea value={vnReview} onChange={(e) => setVnReview(e.target.value)} rows={4} placeholder="Your review" />
        {vnReview.trim() && (
          <div className="field-inline">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(!hasSpoilers)}>Contains spoilers</button>
          </div>
        )}
      </div>

      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">Replay history</span>
        <span className="form-section-hint">Log each replay (different route, true ending, etc.)</span>
      </div>
      <div className="field-group">
        <label>Play history</label>
        <RewatchListEditor
          rewatches={rewatches}
          onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
          onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
          onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
          onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
          labels={{ rewatch: 'Replayed', started: 'Started playing', finished: 'Finished playing', dropped: 'Dropped', note: 'Note' }}
        />
      </div>

      <div className="form-section-header" data-belongs-to="related">
        <span className="form-section-title">Related &amp; recommendations</span>
      </div>
      <div className="field-group">
        <label>VNDB id</label>
        <input value={vndbId} onChange={(e) => setVndbId(e.target.value)} placeholder="e.g. v17" />
      </div>
      <div className="field-group">
        <label>Related visual novels</label>
        <RelatedListEditor
          related={relatedItems}
          options={items.filter((i) => i.categoryId === 'visual_novels' && i.id !== editingId)}
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
          options={items.filter((i) => i.categoryId === 'visual_novels' && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder="Add recommended VN…"
        />
      </div>
      {cover && <input type="hidden" value={cover} />}
    </>
  )
}
