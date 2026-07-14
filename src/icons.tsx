import type { ReactNode } from 'react'
import type { GameStatus, MangaStatus, AnimeStatus } from './types'

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function AnimeIcon() {
  return (
    <Icon>
      <path d="M12 3l1.8 4.4L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.6L12 3z" />
      <circle cx="18.5" cy="17.5" r="1.6" />
    </Icon>
  )
}

function GamesIcon() {
  return (
    <Icon>
      <rect x="2.5" y="8" width="19" height="9" rx="4.5" />
      <path d="M7 10.5v4M5 12.5h4" />
      <circle cx="16" cy="11.5" r="1" />
      <circle cx="18.5" cy="13.5" r="1" />
    </Icon>
  )
}

function MangaIcon() {
  return (
    <Icon>
      <path d="M4 5.5c2.2-1 5-1 8 0 3-1 5.8-1 8 0v13c-2.2-1-5-1-8 0-3-1-5.8-1-8 0v-13z" />
      <path d="M12 5.5v13" />
    </Icon>
  )
}

function MoviesIcon() {
  return (
    <Icon>
      <path d="M3 9.5l1.4-3.8a1 1 0 011-.7h13.2a1 1 0 011 .7L21 9.5" />
      <rect x="3" y="9.5" width="18" height="10.5" rx="1.5" />
      <path d="M7 9.5l1-4M12 9.5l1-4M17 9.5l1-4" />
    </Icon>
  )
}

function MusicIcon() {
  return (
    <Icon>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="16" r="2.2" />
    </Icon>
  )
}

function SeriesIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 17v3" />
    </Icon>
  )
}

function WesternComicIcon() {
  return (
    <Icon>
      <path d="M4 5.5h13a2 2 0 012 2V15a2 2 0 01-2 2h-8l-4 3.5V17H4a2 2 0 01-2-2V7.5a2 2 0 012-2z" />
      <path d="M18 3.5l1.2 2.8L22 7.5l-2.8 1.2L18 11.5l-1.2-2.8L14 7.5l2.8-1.2L18 3.5z" />
    </Icon>
  )
}

export function FolderIcon() {
  return (
    <Icon>
      <path d="M3 6.5a2 2 0 012-2h3.4l2 2H19a2 2 0 012 2V17a2 2 0 01-2 2H5a2 2 0 01-2-2V6.5z" />
    </Icon>
  )
}

export function CategoryIcon({ id }: { id: string }) {
  switch (id) {
    case 'anime': return <AnimeIcon />
    case 'donghua': return <AnimeIcon />
    case 'videojuegos': return <GamesIcon />
    case 'manga': case 'manhwa': case 'manhua': return <MangaIcon />
    case 'comics_west': return <WesternComicIcon />
    case 'peliculas': return <MoviesIcon />
    case 'musica': return <MusicIcon />
    case 'series': return <SeriesIcon />
    default: return null
  }
}

export function GameStatusIcon({ value }: { value: GameStatus }) {
  switch (value) {
    case 'backlog':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>
    case 'playing':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M10 8.5l6 3.5-6 3.5v-7z" /></Icon>
    case 'played':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M8 12.5l2.5 2.5L16 9.5" /></Icon>
    case 'completed':
      return <Icon><path d="M7 4h10v4a5 5 0 01-10 0V4z" /><path d="M7 5H4v1a3 3 0 003 3M17 5h3v1a3 3 0 01-3 3" /><path d="M12 13v4M9 20h6M9.5 17h5" /></Icon>
    case 'dropped':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M9 9l6 6M15 9l-6 6" /></Icon>
    default:
      return null
  }
}

export function MangaStatusIcon({ value }: { value: MangaStatus }) {
  switch (value) {
    case 'plan_to_read':
      return <Icon><rect x="5" y="4" width="14" height="17" rx="1.5" /><path d="M8 8h8M8 12h5" /></Icon>
    case 'reading':
      return <Icon><path d="M4 5.5c2.2-1 5-1 8 0 3-1 5.8-1 8 0v13c-2.2-1-5-1-8 0-3-1-5.8-1-8 0v-13z" /><path d="M12 5.5v13" /></Icon>
    case 'completed':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M8 12.5l2.5 2.5L16 9.5" /></Icon>
    case 'paused':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M10 9v6M14 9v6" /></Icon>
    case 'dropped':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M9 9l6 6M15 9l-6 6" /></Icon>
    default:
      return null
  }
}

export function AnimeStatusIcon({ value }: { value: AnimeStatus }) {
  switch (value) {
    case 'plan_to_watch':
      return <Icon><rect x="5" y="4" width="14" height="17" rx="1.5" /><path d="M8 8h8M8 12h5" /></Icon>
    case 'watching':
      return <Icon><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M9 9.5l6 3-6 3v-6z" /></Icon>
    case 'completed':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M8 12.5l2.5 2.5L16 9.5" /></Icon>
    case 'paused':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M10 9v6M14 9v6" /></Icon>
    case 'dropped':
      return <Icon><circle cx="12" cy="12" r="8.5" /><path d="M9 9l6 6M15 9l-6 6" /></Icon>
    default:
      return null
  }
}

export function InsightsIcon() {
  return (
    <Icon>
      <path d="M4 20V10M11 20V4M18 20v-7" />
    </Icon>
  )
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <Icon>
      <path d="M4 7h11M4 12h16M4 17h8" />
      <circle cx="17" cy="7" r="1.8" />
      <circle cx="9" cy="12" r="1.8" />
      <circle cx="14" cy="17" r="1.8" />
    </Icon>
  )
}