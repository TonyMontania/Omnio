// Inline brand marks for every third-party service Omnio integrates
// with. Rendered as tight 18x18 SVGs so they sit next to a button
// label without changing its height. Kept in one file so the import
// buttons in Settings, the eroge link row and any future badge use
// one source of truth for logo shape and colour.
//
// The marks are compact brand-inspired representations, not
// pixel-perfect copies of the official artwork — that keeps the file
// small and lets us render at any zoom without loading external
// image assets. Each entry uses the brand's primary colour so the
// row of buttons in Settings reads as its own visual language.

import type { CSSProperties } from 'react'

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

interface Props {
  service: ServiceName
  size?: number
  style?: CSSProperties
}

export default function ServiceLogo({ service, size = 18, style }: Props) {
  const sz = { width: size, height: size, ...style } satisfies CSSProperties
  switch (service) {
    case 'mal':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#2e51a2" /><text x="16" y="21" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fill="#fff">MAL</text></svg>
    case 'anilist':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#02a9ff" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill="#fff">A</text></svg>
    case 'kitsu':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#f75239" /><text x="16" y="21" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fill="#fff">Kit</text></svg>
    case 'steam':
      return <svg viewBox="0 0 32 32" style={sz}><defs><radialGradient id={`sl-steam-${size}`} cx="0.3" cy="0.35" r="0.9"><stop offset="0" stopColor="#4b6d90" /><stop offset="1" stopColor="#122236" /></radialGradient></defs><rect width="32" height="32" rx="16" fill={`url(#sl-steam-${size})`} /><circle cx="20.5" cy="12" r="4.6" fill="none" stroke="#e6ecf2" strokeWidth="1.6" /><circle cx="20.5" cy="12" r="1.8" fill="#e6ecf2" /><circle cx="12" cy="20.5" r="3.4" fill="none" stroke="#e6ecf2" strokeWidth="1.6" /><line x1="12" y1="20.5" x2="20.5" y2="12" stroke="#e6ecf2" strokeWidth="1.2" /></svg>
    case 'gog':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#86328a" /><text x="16" y="21" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fill="#fff">GOG</text></svg>
    case 'epic':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#000" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill="#fff">E</text></svg>
    case 'letterboxd':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#14181c" /><g><circle cx="10" cy="16" r="4" fill="#00e054" /><circle cx="16" cy="16" r="4" fill="#40bcf4" /><circle cx="22" cy="16" r="4" fill="#ff8000" /></g></svg>
    case 'imdb':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#f5c518" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fill="#000">IMDb</text></svg>
    case 'tmdb':
      return <svg viewBox="0 0 32 32" style={sz}><defs><linearGradient id={`sl-tmdb-${size}`} x1="0" x2="1"><stop offset="0" stopColor="#90cea1" /><stop offset="0.6" stopColor="#3cbec9" /><stop offset="1" stopColor="#01b4e4" /></linearGradient></defs><rect width="32" height="32" rx="5" fill={`url(#sl-tmdb-${size})`} /><text x="16" y="21" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="#0d253f">TMDB</text></svg>
    case 'trakt':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#ed1c24" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="#fff">t</text></svg>
    case 'serializd':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#7c4dff" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill="#fff">S</text></svg>
    case 'goodreads':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#553b08" /><text x="16" y="22" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="900" fontSize="16" fill="#fff">g</text></svg>
    case 'storygraph':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#f4b06a" /><path d="M6 22 L11 15 L15 19 L20 10 L26 22" fill="none" stroke="#3d2b1f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'kindle':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#232f3e" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill="#ff9900">a</text></svg>
    case 'spotify':
      return <svg viewBox="0 0 32 32" style={sz}><circle cx="16" cy="16" r="15" fill="#1db954" /><path d="M8 12c5-2 12-2 17 1" stroke="#000" strokeWidth="2.4" strokeLinecap="round" fill="none" /><path d="M9 17c4-1.5 10-1.5 14 1" stroke="#000" strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M10 21c3-1 8-1 12 1" stroke="#000" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
    case 'lastfm':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#d51007" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#fff">last</text></svg>
    case 'discogs':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#000" /><circle cx="16" cy="16" r="8" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="16" cy="16" r="2.4" fill="#fff" /></svg>
    case 'rym':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#132831" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="11" fill="#f2c400">RYM</text></svg>
    case 'musicbrainz':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#ba478f" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="#fff">M</text></svg>
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
    case 'notion':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#fff" /><text x="16" y="23" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18" fill="#000">N</text></svg>
    case 'csv':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#1e7d3a" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="10" fill="#fff">CSV</text></svg>
    case 'f95':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#131a24" /><text x="16" y="21" textAnchor="middle" fontFamily="Verdana, sans-serif" fontWeight="900" fontSize="13" fill="#ec2b3f" letterSpacing="-0.5">F95</text></svg>
    case 'dlsite':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#fff" /><text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="14" fill="#0064c8">DL</text></svg>
    case 'itch':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#fa5c5c" /><text x="16" y="21" textAnchor="middle" fontFamily="'Lato', 'Segoe UI', sans-serif" fontWeight="900" fontSize="11" fill="#fff" letterSpacing="-0.5">itch</text></svg>
    case 'ryuugames':
      return <svg viewBox="0 0 32 32" style={sz}><rect width="32" height="32" rx="5" fill="#0e5c2e" /><text x="16" y="24" textAnchor="middle" fontFamily="'Yu Mincho', 'MS Mincho', serif" fontWeight="700" fontSize="20" fill="#fff">龍</text></svg>
  }
}
