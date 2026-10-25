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
import { t } from '../../i18n'

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
        <span className="form-section-title">{t('Reading status')}</span>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>{t('Status')}</label>
          <select value={visualNovelStatus} onChange={(e) => setVisualNovelStatus(e.target.value as VisualNovelStatus)}>
            {VN_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>{t('Development status')}</label>
          <select value={vnDevStatus} onChange={(e) => setVnDevStatus(e.target.value as VnDevStatus | '')}>
            <option value="">—</option>
            {VN_DEV_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">{t('Visual novel details')}</span>
        <span className="form-section-hint">{t('Developers, publishers, engine, aliases, languages, platforms')}</span>
      </div>
      <TagEditor
        label={t('Aliases (romaji / English / other)')}
        tags={vnAliases}
        onAdd={(v) => setVnAliases((prev) => prev.includes(v) ? prev : [...prev, v])}
        onRemove={(i) => setVnAliases((prev) => prev.filter((_, idx) => idx !== i))}
        placeholder={t('Add alternate title')}
      />
      <div className="field-grid two">
        <TagEditor
          label={t('Developers')}
          tags={devs}
          onAdd={(v) => setDevs((prev) => prev.includes(v) ? prev : [...prev, v])}
          onRemove={(i) => setDevs((prev) => prev.filter((_, idx) => idx !== i))}
          placeholder={t('Add developer')}
        />
        <TagEditor
          label={t('Publishers (fallback / manual)')}
          tags={publishers}
          onAdd={(v) => setPublishers((prev) => prev.includes(v) ? prev : [...prev, v])}
          onRemove={(i) => setPublishers((prev) => prev.filter((_, idx) => idx !== i))}
          placeholder={t('Add publisher')}
        />
      </div>
      {vnPublishers.length > 0 && (
        <div className="field-group">
          <label>{t('Publishers by region')}</label>
          <p className="hint">{t('One row per (publisher × language) — pulled from every VNDB release. Flag matches the release language.')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vnPublishers.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: 16 }}>{vnLangFlag(p.lang)}</span>
                <span style={{ flex: 1 }}>
                  <b>{p.name}</b>
                  {p.original && p.original !== p.name && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>· {p.original}</span>}
                  <span style={{ color: 'var(--text-faint)', marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {vnLangLabel(p.lang)} {p.role && p.role !== 'publisher' ? t('· {role}', { role: p.role }) : ''}
                  </span>
                </span>
                <button type="button" className="secondary-btn" onClick={() => setVnPublishers((prev) => prev.filter((_, j) => j !== i))} title={t('Remove')}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="field-grid two">
        <div className="field-group">
          <label>{t('Engine')}</label>
          <input
            list="vn-engine-suggestions"
            value={vnEngine}
            onChange={(e) => setVnEngine(e.target.value)}
            placeholder={t('e.g. Ren\'Py')}
          />
          <datalist id="vn-engine-suggestions">
            {VN_ENGINE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="field-group">
          <label>{t('Original language')}</label>
          <input
            value={vnOriginalLanguage}
            onChange={(e) => setVnOriginalLanguage(e.target.value)}
            placeholder={t('e.g. ja')}
          />
        </div>
      </div>
      <TagEditor
        label={t('Languages available')}
        tags={vnLanguages}
        onAdd={(v) => setVnLanguages((prev) => prev.includes(v) ? prev : [...prev, v])}
        onRemove={(i) => setVnLanguages((prev) => prev.filter((_, idx) => idx !== i))}
        placeholder={t('Add language code (e.g. en)')}
      />
      <div className="field-group">
        <label>{t('Platforms')}</label>
        <PlatformEditor value={platforms} onChange={setPlatforms} existing={existingPlatforms} />
      </div>
      <div className="field-group">
        <label>{t('Description')}</label>
        <textarea value={vnDescription} onChange={(e) => setVnDescription(e.target.value)} rows={4} placeholder={t('Synopsis')} />
      </div>

      <div className="form-section-header" data-belongs-to="media">
        <span className="form-section-title">{t('Covers gallery')}</span>
        <span className="form-section-hint">{t('One cover per release. Star the one you want as the main card cover; toggle Exhibited to control which show up in the detail view\'s "Covers" section.')}</span>
      </div>
      {vnCovers.length === 0 && (
        <p className="hint">{t('No extra covers yet. Fetching from VNDB downloads every release cover — usually 3–8 per VN.')}</p>
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
                    title={t('Use as the main cover')}
                  >{t('★ Main')}</button>
                  <button
                    type="button"
                    className={c.exhibited ? 'pill active' : 'pill'}
                    onClick={() => setVnCovers((prev) => prev.map((x, j) => j === i ? { ...x, exhibited: !x.exhibited } : x))}
                    style={{ fontSize: 11, padding: '2px 8px' }}
                  >{t('Exhibited')}</button>
                  <button
                    type="button"
                    className="pill"
                    onClick={() => setVnCovers((prev) => prev.filter((_, j) => j !== i))}
                    style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}
                    title={t('Remove this cover')}
                  >×</button>
                </div>
              </div>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>{t('Main cover is also stored in the top-level')}{' '}<code>cover</code>{' '}{t('field so cards and lists render correctly.')}</p>
        </div>
      )}

      {vnEditions.length > 0 && (
        <>
          <div className="form-section-header" data-belongs-to="identity">
            <span className="form-section-title">{t('Editions')}</span>
            <span className="form-section-hint">{t('Release editions per language (Original / Steam / fan translation)')}</span>
          </div>
          <div className="field-group">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {vnEditions.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
                  {e.lang && <span style={{ fontSize: 16 }} title={vnLangLabel(e.lang)}>{vnLangFlag(e.lang)}</span>}
                  <span style={{ flex: 1 }}>
                    <b>{e.name}</b>
                    <span style={{ color: 'var(--text-faint)', marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {e.lang ? vnLangLabel(e.lang) : ''}{e.official ? t(' · official') : t(' · unofficial')}
                    </span>
                  </span>
                  <button type="button" className="secondary-btn" onClick={() => setVnEditions((prev) => prev.filter((_, j) => j !== i))} title={t('Remove')}>×</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="form-section-header" data-belongs-to="progress">
        <span className="form-section-title">{t('Release & length')}</span>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>{t('Release date')}</label>
          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
        </div>
        <div className="field-group">
          <label>{t('Release year (fallback)')}</label>
          <input value={releaseYear} onChange={(e) => setReleaseYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))} placeholder={t('e.g. 2004')} />
        </div>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>{t('Length')}</label>
          <select value={vnLength} onChange={(e) => setVnLength(e.target.value as VnLength | '')}>
            <option value="">—</option>
            {VN_LENGTH_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>{t('Hours (community average)')}</label>
          <input value={vnLengthHours} onChange={(e) => setVnLengthHours(e.target.value)} placeholder={t('e.g. 28.5')} />
        </div>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>{t('Your play time')}</label>
          <input value={playTime} onChange={(e) => setPlayTime(e.target.value)} placeholder={t('e.g. 42h')} />
        </div>
        <div className="field-group">
          <label>{t('Started')}</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <div className="form-section-header" data-belongs-to="overview">
        <span className="form-section-title">{t('Ratings & completion')}</span>
      </div>
      <div className="field-grid two">
        <div className="field-group">
          <label>{t('Your rating')}</label>
          <RatingPicker value={rating} onChange={setRating} />
        </div>
        <div className="field-group">
          <label>{t('VNDB community rating (/10)')}</label>
          <input value={vnCommunityRating} onChange={(e) => setVnCommunityRating(e.target.value)} placeholder={t('e.g. 8.45')} />
        </div>
      </div>
      <div className="field-group">
        <label>{t('Completion date')}</label>
        <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
      </div>
      <div className="field-group">
        <label>{t('Content flags')}</label>
        <div className="pills">
          <button type="button" className={nsfw ? 'pill active' : 'pill'} onClick={() => setNsfw(!nsfw)}>{t('18+ / NSFW content')}</button>
        </div>
      </div>

      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">{t('Staff')}</span>
        <span className="form-section-hint">{t('Writer / artist / composer / director / translator')}</span>
      </div>
      <div className="field-group">
        <label>{t('Credits')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {vnStaff.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                value={s.name}
                onChange={(e) => setVnStaff((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                placeholder={t('Name')}
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
                placeholder={t('Route / notes')}
                style={{ flex: '1 1 30%' }}
              />
              <button type="button" className="secondary-btn" onClick={() => setVnStaff((prev) => prev.filter((_, j) => j !== i))} title={t('Remove')}>×</button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setVnStaff((prev) => [...prev, { id: crypto.randomUUID(), name: '', role: 'writer' as VnStaffRole }])}
            style={{ alignSelf: 'flex-start' }}
          >
            {t('+ Add staff member')}
          </button>
        </div>
      </div>

      <div className="form-section-header" data-belongs-to="identity">
        <span className="form-section-title">{t('Characters')}</span>
        <span className="form-section-hint">{t('Protagonist, main, side, cameos · with voice actor when voiced')}</span>
      </div>
      <input ref={characterFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCharImagePick} />
      <div className="field-group">
        <label>{t('Cast')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {vnCharacters.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 8, background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ flex: '0 0 72px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ width: 72, height: 96, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.image ? (
                    <img src={assetSrc(c.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>{t('No image')}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => { characterEditIdxRef.current = i; characterFileInputRef.current?.click() }}
                  style={{ fontSize: 11, padding: '2px 6px' }}
                >{t('Upload')}</button>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    value={c.name}
                    onChange={(e) => setVnCharacters((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    placeholder={t('Character name')}
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
                    placeholder={t('Voice actor')}
                    style={{ flex: '1 1 180px' }}
                  />
                </div>
                <textarea
                  value={c.description ?? ''}
                  onChange={(e) => setVnCharacters((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                  placeholder={t('Character description')}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <button type="button" className="secondary-btn" onClick={() => setVnCharacters((prev) => prev.filter((_, j) => j !== i))} title={t('Remove')}>×</button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setVnCharacters((prev) => [...prev, { id: crypto.randomUUID(), name: '', role: 'main' as VnCharacterRole }])}
            style={{ alignSelf: 'flex-start' }}
          >
            {t('+ Add character')}
          </button>
        </div>
      </div>

      {vnScreenshots.length > 0 && (
        <>
          <div className="form-section-header" data-belongs-to="media">
            <span className="form-section-title">{t('Screenshots')}</span>
            <span className="form-section-hint">{t('In-game shots · toggle the NSFW flag to blur individual images in the detail view')}</span>
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
                    >{t('NSFW')}</button>
                    <button type="button" className="pill" onClick={() => setVnScreenshots((prev) => prev.filter((_, j) => j !== i))} style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="form-section-header" data-belongs-to="notes">
        <span className="form-section-title">{t('Review')}</span>
        <span className="form-section-hint">{t('Your take · with optional spoiler toggle')}</span>
      </div>
      <div className="field-group">
        <label>{t('Review')}</label>
        <textarea value={vnReview} onChange={(e) => setVnReview(e.target.value)} rows={4} placeholder={t('Your review')} />
        {vnReview.trim() && (
          <div className="field-inline">
            <button type="button" className={hasSpoilers ? 'pill active' : 'pill'} onClick={() => setHasSpoilers(!hasSpoilers)}>{t('Contains spoilers')}</button>
          </div>
        )}
      </div>

      <div className="form-section-header" data-belongs-to="history">
        <span className="form-section-title">{t('Replay history')}</span>
        <span className="form-section-hint">{t('Log each replay (different route, true ending, etc.)')}</span>
      </div>
      <div className="field-group">
        <label>{t('Play history')}</label>
        <RewatchListEditor
          rewatches={rewatches}
          onAdd={(r) => setRewatches((prev) => [...prev, { ...r, id: crypto.randomUUID() }])}
          onRemove={(id) => setRewatches((prev) => prev.filter((r) => r.id !== id))}
          onUpdate={(id, patch) => setRewatches((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r))}
          onRatingChange={(id, r) => setRewatches((prev) => prev.map((x) => x.id === id ? { ...x, rating: r || undefined } : x))}
          labels={{ rewatch: t('Replayed'), started: t('Started playing'), finished: t('Finished playing'), dropped: t('Dropped'), note: t('Note') }}
        />
      </div>

      <div className="form-section-header" data-belongs-to="related">
        <span className="form-section-title">{t('Related & recommendations')}</span>
      </div>
      <div className="field-group">
        <label>{t('VNDB id')}</label>
        <input value={vndbId} onChange={(e) => setVndbId(e.target.value)} placeholder={t('e.g. v17')} />
      </div>
      <div className="field-group">
        <label>{t('Related visual novels')}</label>
        <RelatedListEditor
          related={relatedItems}
          options={items.filter((i) => i.categoryId === 'visual_novels' && i.id !== editingId)}
          crossLibrary
          allItems={relatedCrossLibraryOptions}
          onAdd={(id) => setRelatedItems((prev) => [...prev, { itemId: id, relation: 'sequel' }])}
          onRemove={(id) => setRelatedItems((prev) => prev.filter((r) => r.itemId !== id))}
          onChangeRelation={(id, r) => setRelatedItems((prev) => prev.map((x) => x.itemId === id ? { ...x, relation: r } : x))}
          pickerPlaceholder={t('Add related item… (any library)')}
        />
      </div>
      <div className="field-group">
        <label>{t('Recommendations')}</label>
        <RecommendationsEditor
          ids={recommendedItems}
          options={items.filter((i) => i.categoryId === 'visual_novels' && i.id !== editingId)}
          onAdd={(id) => setRecommendedItems((prev) => [...prev, id])}
          onRemove={(id) => setRecommendedItems((prev) => prev.filter((x) => x !== id))}
          pickerPlaceholder={t('Add recommended VN…')}
        />
      </div>
      {cover && <input type="hidden" value={cover} />}
    </>
  )
}
