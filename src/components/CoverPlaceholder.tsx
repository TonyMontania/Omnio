// Per-category SVG placeholder for items that don't (yet) have a cover.
// Renders inside <div class="cover-preview-placeholder"> or any container
// that sizes it (aspect-ratio + flex-center). Keeps the icon monochrome
// so it inherits color from `currentColor` — themes swap `--text-dim`.
//
// Adding a new category: extend the switch below and pick a symbol from
// the same visual vocabulary (thin strokes, 24-viewbox, no fills).

interface Props { categoryId: string; label?: string }

export default function CoverPlaceholder({ categoryId, label }: Props) {
  return (
    <div className="cover-placeholder-inner">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {glyphFor(categoryId)}
      </svg>
      {label !== undefined && <span className="cover-placeholder-label">{label ?? 'No cover'}</span>}
    </div>
  )
}

function glyphFor(categoryId: string) {
  switch (categoryId) {
    case 'videojuegos': // controller — two grips + d-pad + buttons
      return (
        <>
          <path d="M7 9h10a4 4 0 0 1 4 4v3a3 3 0 0 1-5.24 2L15 17h-6l-.76 1A3 3 0 0 1 3 16v-3a4 4 0 0 1 4-4z" />
          <path d="M8 12v2M7 13h2M15 13h.01M17 13h.01M16 12h.01M16 14h.01" />
        </>
      )
    case 'musica': // cassette — outer box + two spools + tape band
      return (
        <>
          <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
          <circle cx="8" cy="12" r="1.5" />
          <circle cx="16" cy="12" r="1.5" />
          <path d="M9.5 12h5" />
          <path d="M6 17l1.5-2M18 17l-1.5-2" />
        </>
      )
    case 'peliculas': // clapperboard — top hinge + strip
      return (
        <>
          <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 9l1-4 4-1 1 4M8 8l1-4 4-1 1 4M13 8l1-4 4-1 1 4" />
        </>
      )
    case 'series': // TV — screen + antenna + stand
      return (
        <>
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M8 4l4 3 4-3" />
          <path d="M8 22h8" />
        </>
      )
    case 'anime': case 'donghua': // play triangle inside a rounded frame
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
        </>
      )
    case 'manga': case 'manhwa': case 'manhua': case 'comics_west': // stacked panels
      return (
        <>
          <rect x="3" y="4" width="8" height="6" rx="0.5" />
          <rect x="13" y="4" width="8" height="10" rx="0.5" />
          <rect x="3" y="12" width="8" height="8" rx="0.5" />
          <rect x="13" y="16" width="8" height="4" rx="0.5" />
        </>
      )
    case 'libros': // open book with spine crease
      return (
        <>
          <path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z" />
          <path d="M20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z" />
          <path d="M12 7v13" />
        </>
      )
    default: // generic image frame
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="M3 17l5-4 3 3 4-5 6 6" />
        </>
      )
  }
}
