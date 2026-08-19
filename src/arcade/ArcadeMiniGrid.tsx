// Compact single-game mini-grid, doopu-style. Difficulties are rows
// (top-to-bottom L → H → N → E → EX), characters are columns. Each
// cell is a plain square that fills with the run's flags. Character
// short codes render UNDER the grid; the game abbreviation renders
// above it as the header. Click a cell to open the run editor pre-
// filtered to that character × difficulty.

import { useMemo } from 'react'
import type { ArcadeGame, Run, RunFlag } from '../types/arcade'

interface CellState {
  cleared: boolean
  flags: Set<RunFlag>
  bestRun?: Run
}

function reduceCell(runs: Run[]): CellState {
  if (runs.length === 0) return { cleared: false, flags: new Set() }
  const flags = new Set<RunFlag>()
  let best: Run | undefined
  let bestScore = -Infinity
  for (const r of runs) {
    for (const f of r.flags) flags.add(f)
    const s = r.score ?? 0
    if (s > bestScore) { bestScore = s; best = r }
  }
  return { cleared: true, flags, bestRun: best }
}

// Derive a two-letter code from a character name when the game's
// `characterCodes` array wasn't populated by a template.
function fallbackCode(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface Props {
  game: ArcadeGame
  onOpen: () => void                    // click on the header → open detail view
  onCellClick?: (character: string, difficulty: string) => void
}

export default function ArcadeMiniGrid({ game, onOpen, onCellClick }: Props) {
  const grid = game.grid
  const matrix = useMemo(() => {
    if (!grid) return null
    const out = new Map<string, CellState>()
    for (const c of grid.characters) {
      for (const d of grid.difficulties) {
        const cellRuns = game.runs.filter((r) => r.character === c && r.difficulty === d)
        out.set(`${c}||${d}`, reduceCell(cellRuns))
      }
    }
    return out
  }, [grid, game.runs])

  const codes = game.characterCodes && game.characterCodes.length === grid?.characters.length
    ? game.characterCodes
    : grid?.characters.map(fallbackCode) ?? []
  const abbr = game.abbreviation || game.title.slice(0, 6)

  if (!grid) {
    return (
      <div className="arcade-mini-card">
        <button type="button" className="arcade-mini-header" onClick={onOpen}>
          <div className="arcade-mini-logo-box">
            {game.logo
              ? <img className="arcade-mini-logo" src={game.logo} alt="" />
              : <span className="arcade-mini-logo-fallback">{abbr.slice(0, 2)}</span>}
          </div>
          <span className="arcade-mini-abbr">{abbr}</span>
        </button>
        <div className="arcade-mini-empty hint">no grid</div>
      </div>
    )
  }

  return (
    <div className="arcade-mini-card">
      <button type="button" className="arcade-mini-header" onClick={onOpen} title={game.title}>
        {game.logo
          ? <img className="arcade-mini-logo" src={game.logo} alt={abbr} />
          : <span className="arcade-mini-abbr-only">◆ {abbr}</span>}
        {game.logo && <span className="arcade-mini-abbr">{abbr}</span>}
      </button>
      <table className="arcade-mini-table">
        <tbody>
          {grid.difficulties.map((d) => (
            <tr key={d}>
              <th className="arcade-mini-diff">{d}</th>
              {grid.characters.map((c) => {
                const cell = matrix!.get(`${c}||${d}`)!
                const classes = ['arcade-mini-cell']
                if (cell.cleared) classes.push('cleared')
                if (cell.flags.has('1cc')) classes.push('is-1cc')
                if (cell.flags.has('no-miss')) classes.push('is-nm')
                if (cell.flags.has('no-bomb')) classes.push('is-nb')
                if (cell.flags.has('pacifist')) classes.push('is-paci')
                if (cell.flags.has('extra-clear')) classes.push('is-ex')
                return (
                  <td key={c} className="arcade-mini-td">
                    <button
                      type="button"
                      className={classes.join(' ')}
                      onClick={() => onCellClick?.(c, d)}
                      title={`${c} · ${d}${cell.cleared ? ' — ' + Array.from(cell.flags).join(', ') : ''}`}
                      aria-label={`${c} on ${d}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="arcade-mini-codes">
            <th />
            {codes.map((code, i) => <td key={i}>{code}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
