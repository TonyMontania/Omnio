// Arcade / score-tracker data model. Users pick one of two `type`s
// when they create a game:
//
//   - 'grid'  → doopu-style character × difficulty tracker. User
//     defines the axes themselves.
//   - 'score' → simple high-score log with flags. No grid, no axes.
//
// Both types share the same Run history; the type just gates which
// UI panels render for the game.

export type RunFlag = '1cc' | 'no-miss' | 'no-bomb' | 'pacifist' | 'all-clear' | 'extra-clear'

export const RUN_FLAG_OPTIONS: { value: RunFlag; label: string; short: string }[] = [
  { value: '1cc',         label: '1 credit clear', short: '1cc'   },
  { value: 'no-miss',     label: 'No miss (zero deaths)', short: 'NM'    },
  { value: 'no-bomb',     label: 'No bomb',        short: 'NB'    },
  { value: 'pacifist',    label: 'Pacifist',       short: 'PACI'  },
  { value: 'all-clear',   label: 'All clear bonus',short: 'ALL'   },
  { value: 'extra-clear', label: 'Extra stage cleared', short: 'EX' },
]

export interface Run {
  id: string
  date: string
  character?: string
  difficulty?: string
  score?: number
  credits?: number
  startLives?: number
  misses?: number
  bombs?: number
  flags: RunFlag[]
  notes?: string
  videoUrl?: string
  replayFile?: string
}

export interface ArcadeGrid {
  characters: string[]
  difficulties: string[]
  trackedFlags: RunFlag[]
}

export type ArcadeGameType = 'grid' | 'score'

export interface ArcadeGame {
  id: string
  title: string
  type: ArcadeGameType
  logo?: string                         // data URL (inline) — small logo image
  createdAt: number
  runs: Run[]
  // Grid tracker specifics. Only meaningful when type === 'grid'.
  grid?: ArcadeGrid
  // Short abbreviation shown as the mini-grid header on the chart page
  // (Touhou "PCB", "EoSD"). Falls back to first letters of title.
  abbreviation?: string
  // Short 1–3-letter code per character for the column-footer strip
  // under the mini-grid. Same length as `grid.characters` when set.
  characterCodes?: string[]
  // Free-text franchise / series label. Used for section grouping.
  franchise?: string
  // Chart section on the main page. `'extra'` puts the game under a
  // separate "EXTRA" header (fighting games, side entries).
  section?: '1cc' | 'extra'
}
