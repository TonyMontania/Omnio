
import { t } from './i18n'// Reference modal listing every image-upload slot in Omnio with the
// recommended aspect ratio, target dimensions and accepted file formats.
// Reachable from Settings → Maintenance & about → Image upload guide.
// Formats: the whole pipeline accepts PNG, JPG/JPEG, WebP, GIF, AVIF,
// BMP and SVG (see ext_from_mime in src-tauri/src/util.rs) — the docs are the
// only place users learn what's on offer without opening the source.

interface Props { onClose: () => void }

interface Slot {
  scope: string
  what: string
  ratio: string
  suggested: string
  notes?: string
}

const SLOTS: { section: string; rows: Slot[] }[] = [
  {
    section: t('Games'),
    rows: [
      { scope: t('Cover'),            what: t('Vertical poster / box art'),      ratio: '2 : 3',  suggested: '600 × 900 px', notes: t('Same aspect as SteamGridDB grid tiles. Larger sizes downscale cleanly.') },
      { scope: t('Banner (hero)'),    what: t('Wide backdrop above the title'),  ratio: '16 : 9', suggested: '1920 × 1080 px', notes: t('SteamGridDB hero art fits perfectly. Fades to the surface color at the bottom.') },
      { scope: t('Logo'),             what: t('Transparent wordmark'),           ratio: 'free',   suggested: '1280 × 720 px max', notes: t('PNG or WebP with alpha. Sits over the banner with a soft shadow.') },
      { scope: t('Bundle cover'),     what: t('Cover per sub-game'),             ratio: '2 : 3',  suggested: '600 × 900 px' },
      { scope: t('Screenshots'),      what: t('Gallery attached to a game'),     ratio: 'free',   suggested: '1920 × 1080 px or lower', notes: t('Any aspect; renders in a masonry grid.') },
    ],
  },
  {
    section: t('Music'),
    rows: [
      { scope: t('Cover'),            what: t('Album / EP / single artwork'),    ratio: '1 : 1',  suggested: '1000 × 1000 px', notes: t('Squared. Cover Art Archive returns up to 500 × 500 by default; upload larger if you have it.') },
      { scope: t('Single covers'),    what: t('Per-single artwork gallery'),     ratio: '1 : 1',  suggested: '1000 × 1000 px' },
      { scope: t('Edition covers'),   what: t('Deluxe / Anniversary variants'),  ratio: '1 : 1',  suggested: '1000 × 1000 px', notes: t('Optional. Falls back to the base album cover when blank.') },
    ],
  },
  {
    section: t('Artists'),
    rows: [
      { scope: t('Photo'),            what: t('Circular avatar'),                ratio: '1 : 1',  suggested: '640 × 640 px', notes: t('Faces near the top — the object-position crops bias upward.') },
      { scope: t('Banner'),           what: t('Wide hero on the artist page'),   ratio: '16 : 5', suggested: '1920 × 600 px', notes: t('Renders 470 px tall on the detail view, same as the games hero banner.') },
    ],
  },
  {
    section: t('Movies · Series'),
    rows: [
      { scope: t('Cover (Movies)'),   what: t('Poster'),                         ratio: '2 : 3',  suggested: '600 × 900 px', notes: t('TMDb poster URL fits directly.') },
      { scope: t('Backdrop (Movies)'),what: t('Wide backdrop'),                  ratio: '16 : 9', suggested: '1920 × 1080 px' },
      { scope: t('Cover (Series)'),   what: t('Poster'),                         ratio: '2 : 3',  suggested: '600 × 900 px' },
    ],
  },
  {
    section: t('Anime · Donghua'),
    rows: [
      { scope: t('Cover'),            what: t('Poster'),                         ratio: '2 : 3',  suggested: '460 × 640 px', notes: 'AniList extraLarge fits.' },
      { scope: t('Banner'),           what: t('Wide backdrop'),                  ratio: '16 : 6', suggested: '1920 × 720 px', notes: t('AniList banner URL fits directly.') },
    ],
  },
  {
    section: t('Manga · Manhwa · Manhua · Western comics · Books'),
    rows: [
      { scope: t('Cover'),            what: t('Poster / book cover'),            ratio: '2 : 3',  suggested: '512 × 768 px' },
      { scope: t('Banner (manga family)'), what: t('Wide backdrop'),             ratio: '16 : 6', suggested: '1920 × 720 px' },
      { scope: t('Volume covers'),    what: t('Per-volume artwork gallery'),     ratio: '2 : 3',  suggested: '512 × 768 px', notes: t('MangaDex volume covers are pulled at this size by default.') },
    ],
  },
  {
    section: t('Groups'),
    rows: [
      { scope: t('Group cover'),      what: t('Optional artwork for a group'),   ratio: 'free',   suggested: '1200 × 800 px' },
    ],
  },
]

export default function ImageUploadGuide({ onClose }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel image-guide-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: '94vw', maxHeight: '88vh' }}>
        <div className="modal-header">
          <h2>{t('Image upload guide')}</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            {t('Every image slot in Omnio accepts the same set of formats:  ')}<b>{t('PNG · JPG / JPEG · WebP · GIF · AVIF · BMP · SVG')}</b>{t('. Files are copied into')}{' '}<code>assets/</code>{' '}{t('alongside your data with a title-based filename; nothing is re-encoded, so you keep the original quality of whatever you upload. Suggested dimensions match what the corresponding metadata fetcher downloads by default — you can go larger, but going much smaller will show visible upscaling.')}
          </p>

          {SLOTS.map((sec) => (
            <div key={sec.section} className="image-guide-section">
              <h3>{sec.section}</h3>
              <table className="image-guide-table">
                <thead>
                  <tr>
                    <th>{t('Where')}</th>
                    <th>{t('What it\'s for')}</th>
                    <th>{t('Aspect')}</th>
                    <th>{t('Suggested size')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.map((r) => (
                    <tr key={r.scope}>
                      <td className="image-guide-scope">{r.scope}</td>
                      <td>{r.what}{r.notes && <div className="image-guide-note">{r.notes}</div>}</td>
                      <td className="image-guide-ratio">{r.ratio}</td>
                      <td className="image-guide-size">{r.suggested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <p className="hint" style={{ marginTop: 16 }}>
            {t('Assets live under')}{' '}<code>{t('assets/<category>/<kind>/<title>.ext')}</code>{' '}{t('and are renamed on every save so browsing the folder in Explorer / Finder reads meaningfully. The')}{' '}<b>{t('Clean orphan assets')}</b>{' '}{t('button (under Maintenance) reclaims disk from files no item points at anymore.')}
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="primary-btn" onClick={onClose}>{t('Got it')}</button>
        </div>
      </div>
    </div>
  )
}
