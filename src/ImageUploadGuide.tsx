// Reference modal listing every image-upload slot in Omnio with the
// recommended aspect ratio, target dimensions and accepted file formats.
// Reachable from Settings → Maintenance & about → Image upload guide.
// Formats: the whole pipeline accepts PNG, JPG/JPEG, WebP, GIF, AVIF,
// BMP and SVG (see EXT_FROM_MIME in electron/main.ts) — the docs are the
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
    section: 'Games',
    rows: [
      { scope: 'Cover',            what: 'Vertical poster / box art',      ratio: '2 : 3',  suggested: '600 × 900 px', notes: 'Same aspect as SteamGridDB grid tiles. Larger sizes downscale cleanly.' },
      { scope: 'Banner (hero)',    what: 'Wide backdrop above the title',  ratio: '16 : 9', suggested: '1920 × 1080 px', notes: 'SteamGridDB hero art fits perfectly. Fades to the surface color at the bottom.' },
      { scope: 'Logo',             what: 'Transparent wordmark',           ratio: 'free',   suggested: '1280 × 720 px max', notes: 'PNG or WebP with alpha. Sits over the banner with a soft shadow.' },
      { scope: 'Bundle cover',     what: 'Cover per sub-game',             ratio: '2 : 3',  suggested: '600 × 900 px' },
      { scope: 'Screenshots',      what: 'Gallery attached to a game',     ratio: 'free',   suggested: '1920 × 1080 px or lower', notes: 'Any aspect; renders in a masonry grid.' },
    ],
  },
  {
    section: 'Music',
    rows: [
      { scope: 'Cover',            what: 'Album / EP / single artwork',    ratio: '1 : 1',  suggested: '1000 × 1000 px', notes: 'Squared. Cover Art Archive returns up to 500 × 500 by default; upload larger if you have it.' },
      { scope: 'Single covers',    what: 'Per-single artwork gallery',     ratio: '1 : 1',  suggested: '1000 × 1000 px' },
      { scope: 'Edition covers',   what: 'Deluxe / Anniversary variants',  ratio: '1 : 1',  suggested: '1000 × 1000 px', notes: 'Optional. Falls back to the base album cover when blank.' },
    ],
  },
  {
    section: 'Artists',
    rows: [
      { scope: 'Photo',            what: 'Circular avatar',                ratio: '1 : 1',  suggested: '640 × 640 px', notes: 'Faces near the top — the object-position crops bias upward.' },
      { scope: 'Banner',           what: 'Wide hero on the artist page',   ratio: '16 : 5', suggested: '1920 × 600 px', notes: 'Renders 470 px tall on the detail view, same as the games hero banner.' },
    ],
  },
  {
    section: 'Movies · Series',
    rows: [
      { scope: 'Cover (Movies)',   what: 'Poster',                         ratio: '2 : 3',  suggested: '600 × 900 px', notes: 'TMDb poster URL fits directly.' },
      { scope: 'Backdrop (Movies)',what: 'Wide backdrop',                  ratio: '16 : 9', suggested: '1920 × 1080 px' },
      { scope: 'Cover (Series)',   what: 'Poster',                         ratio: '2 : 3',  suggested: '600 × 900 px' },
    ],
  },
  {
    section: 'Anime · Donghua',
    rows: [
      { scope: 'Cover',            what: 'Poster',                         ratio: '2 : 3',  suggested: '460 × 640 px', notes: 'AniList extraLarge fits.' },
      { scope: 'Banner',           what: 'Wide backdrop',                  ratio: '16 : 6', suggested: '1920 × 720 px', notes: 'AniList banner URL fits directly.' },
    ],
  },
  {
    section: 'Manga · Manhwa · Manhua · Western comics · Books',
    rows: [
      { scope: 'Cover',            what: 'Poster / book cover',            ratio: '2 : 3',  suggested: '512 × 768 px' },
      { scope: 'Banner (manga family)', what: 'Wide backdrop',             ratio: '16 : 6', suggested: '1920 × 720 px' },
      { scope: 'Volume covers',    what: 'Per-volume artwork gallery',     ratio: '2 : 3',  suggested: '512 × 768 px', notes: 'MangaDex volume covers are pulled at this size by default.' },
    ],
  },
  {
    section: 'Groups',
    rows: [
      { scope: 'Group cover',      what: 'Optional artwork for a group',   ratio: 'free',   suggested: '1200 × 800 px' },
    ],
  },
]

export default function ImageUploadGuide({ onClose }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal-panel image-guide-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820, width: '94vw', maxHeight: '88vh' }}>
        <div className="modal-header">
          <h2>Image upload guide</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            Every image slot in Omnio accepts the same set of formats:
            &nbsp;<b>PNG · JPG / JPEG · WebP · GIF · AVIF · BMP · SVG</b>.
            Files are copied into <code>assets/</code> alongside your data
            with a title-based filename; nothing is re-encoded, so you
            keep the original quality of whatever you upload. Suggested
            dimensions match what the corresponding metadata fetcher
            downloads by default — you can go larger, but going much
            smaller will show visible upscaling.
          </p>

          {SLOTS.map((sec) => (
            <div key={sec.section} className="image-guide-section">
              <h3>{sec.section}</h3>
              <table className="image-guide-table">
                <thead>
                  <tr>
                    <th>Where</th>
                    <th>What it's for</th>
                    <th>Aspect</th>
                    <th>Suggested size</th>
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
            Assets live under <code>assets/&lt;category&gt;/&lt;kind&gt;/&lt;title&gt;.ext</code> and
            are renamed on every save so browsing the folder in Explorer / Finder reads meaningfully.
            The <b>Clean orphan assets</b> button (under Maintenance) reclaims disk from files
            no item points at anymore.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="primary-btn" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
