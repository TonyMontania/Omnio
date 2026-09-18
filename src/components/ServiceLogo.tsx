// Inline brand marks for every third-party service Omnio integrates
// with. Rendered as tight 18x18 square badges so they sit next to a
// button label without changing its height.
//
// Real official logos: `src/assets/service-logos/*.svg` — pulled from
// simpleicons.org at build time (single-colour glyphs, MIT-licensed),
// rendered white on a brand-coloured square so the whole row reads
// as its own visual language. See the `WITH_ASSET` map below.
//
// Niche services simpleicons doesn't ship (StoryGraph, Backloggd,
// Serializd, HowLongToBeat, RateYourMusic, Kindle, the eroge plugin's
// F95/DLsite/itch/Ryuugames) fall through to hand-drawn inline SVGs
// in the `CUSTOM` switch so no button ends up unbadged.

import type { CSSProperties } from 'react'

// Real logos bundled from simpleicons.org. Vite treats an .svg
// import as a URL — we drop that into an <img> and force the glyph
// white so it can sit on the brand-tinted background.
import mal from '../assets/service-logos/myanimelist.svg'
import anilist from '../assets/service-logos/anilist.svg'
import kitsu from '../assets/service-logos/kitsu.svg'
import steam from '../assets/service-logos/steam.svg'
import gog from '../assets/service-logos/gogdotcom.svg'
import epic from '../assets/service-logos/epicgames.svg'
import letterboxd from '../assets/service-logos/letterboxd.svg'
import imdb from '../assets/service-logos/imdb.svg'
import tmdb from '../assets/service-logos/themoviedatabase.svg'
import trakt from '../assets/service-logos/trakt.svg'
import spotify from '../assets/service-logos/spotify.svg'
import lastfm from '../assets/service-logos/lastdotfm.svg'
import discogs from '../assets/service-logos/discogs.svg'
import musicbrainz from '../assets/service-logos/musicbrainz.svg'
import itch from '../assets/service-logos/itchdotio.svg'
import notion from '../assets/service-logos/notion.svg'
import amazon from '../assets/service-logos/amazon.svg'

export type ServiceName =
  | 'mal' | 'anilist' | 'kitsu'
  | 'steam' | 'gog' | 'epic'
  | 'letterboxd' | 'imdb' | 'tmdb' | 'trakt' | 'serializd'
  | 'goodreads' | 'storygraph' | 'kindle'
  | 'spotify' | 'lastfm' | 'discogs' | 'rym' | 'musicbrainz'
  | 'backloggd' | 'hltb' | 'igdb' | 'sgdb' | 'pcgw'
  | 'anidb' | 'vndb' | 'mangadex' | 'comicvine'
  | 'notion' | 'csv'
  | 'f95' | 'dlsite' | 'itch' | 'ryuugames'

// Real-logo entries: URL to the bundled SVG + the brand's primary
// colour (used as the badge background). The SVG is rendered white
// via a filter so any glyph — dark or coloured on the original —
// renders as a crisp mark on the brand-tinted square.
const WITH_ASSET: Partial<Record<ServiceName, { src: string; bg: string }>> = {
  mal:         { src: mal,        bg: '#2e51a2' },
  anilist:     { src: anilist,    bg: '#02a9ff' },
  kitsu:       { src: kitsu,      bg: '#f75239' },
  steam:       { src: steam,      bg: '#1b2838' },
  gog:         { src: gog,        bg: '#86328a' },
  epic:        { src: epic,       bg: '#0a0a0a' },
  letterboxd:  { src: letterboxd, bg: '#14181c' },
  imdb:        { src: imdb,       bg: '#f5c518' },
  tmdb:        { src: tmdb,       bg: '#01b4e4' },
  trakt:       { src: trakt,      bg: '#ed1c24' },
  spotify:     { src: spotify,    bg: '#1db954' },
  lastfm:      { src: lastfm,     bg: '#d51007' },
  discogs:     { src: discogs,    bg: '#0a0a0a' },
  musicbrainz: { src: musicbrainz, bg: '#ba478f' },
  itch:        { src: itch,       bg: '#fa5c5c' },
  notion:      { src: notion,     bg: '#ffffff' },
  kindle:      { src: amazon,     bg: '#232f3e' },
}

interface Props {
  service: ServiceName
  size?: number
  style?: CSSProperties
}

export default function ServiceLogo({ service, size = 18, style }: Props) {
  const asset = WITH_ASSET[service]
  if (asset) {
    // Notion's mark is dark on white, so we DON'T invert it — the
    // white background stands on its own. Everything else gets
    // the invert-to-white treatment so brand colours show through
    // as the badge background.
    const invert = service !== 'notion'
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: asset.bg,
          flexShrink: 0,
          ...style,
        }}
        aria-hidden
      >
        <img
          src={asset.src}
          width={size * 0.68}
          height={size * 0.68}
          alt=""
          style={{ filter: invert ? 'brightness(0) invert(1)' : undefined, display: 'block' }}
        />
      </span>
    )
  }

  // Fallback marks for services simpleicons doesn't ship.
  const sz = { width: size, height: size, ...style } satisfies CSSProperties
  switch (service) {
    case 'serializd':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#7c4dff" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill="#fff">S</text></svg>
    case 'goodreads':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#553b08" /><text x="16" y="22" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="900" fontSize="16" fill="#fff">g</text></svg>
    case 'storygraph':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#f4b06a" /><path d="M6 22 L11 15 L15 19 L20 10 L26 22" fill="none" stroke="#3d2b1f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'rym':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#132831" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fill="#f2c400">RYM</text></svg>
    case 'backloggd':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#1e2a3a" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="#f6c04f">b</text></svg>
    case 'hltb':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#3498db" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#fff">HLTB</text></svg>
    case 'igdb':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#9147ff" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#fff">IGDB</text></svg>
    case 'sgdb':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#0e1725" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#f8b118">SGDB</text></svg>
    case 'pcgw':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#000" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#fff">PCGW</text></svg>
    case 'anidb':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#2f5cba" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fill="#fff">DB</text></svg>
    case 'vndb':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#348017" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#fff">VNDB</text></svg>
    case 'mangadex':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#ff6740" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="#fff">M</text></svg>
    case 'comicvine':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#0072b0" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="#fff">C</text></svg>
    case 'csv':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#1e7d3a" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#fff">CSV</text></svg>
    case 'f95':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#131a24" /><text x="16" y="21" textAnchor="middle" fontFamily="Verdana, sans-serif" fontWeight="900" fontSize="13" fill="#ec2b3f" letterSpacing="-0.5">F95</text></svg>
    case 'dlsite':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#fff" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="#0064c8">DL</text></svg>
    case 'ryuugames':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#0e5c2e" /><text x="16" y="24" textAnchor="middle" fontFamily="'Yu Mincho', 'MS Mincho', serif" fontWeight="700" fontSize="20" fill="#fff">龍</text></svg>
    default:
      return null
  }
}
