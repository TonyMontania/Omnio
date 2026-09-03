// Top-level Arcade view. Compact chart layout for grid-tracker games;
// score-log games get a simpler card in a separate section. Selected
// game routes to the detail view.

import { useMemo, useState } from 'react'
import type { ArcadeGame, Run } from '../types/arcade'
import ArcadeGameDetail from './ArcadeGameDetail'
import ArcadeMiniGrid from './ArcadeMiniGrid'
import NewGameModal from './NewGameModal'

interface Props {
  games: ArcadeGame[]
  onCreate: (game: ArcadeGame) => void
  onUpdate: (gameId: string, patch: Partial<ArcadeGame>) => void
  onDelete: (gameId: string) => void
  onAddRun: (gameId: string, run: Omit<Run, 'id'>) => void
  onRemoveRun: (gameId: string, runId: string) => void
  onUpdateRun: (gameId: string, runId: string, patch: Partial<Run>) => void
}

function bestScore(runs: Run[]): number | undefined {
  let s: number | undefined
  for (const r of runs) if (r.score !== undefined && (s === undefined || r.score > s)) s = r.score
  return s
}

export default function ArcadeView(props: Props) {
  const { games, onCreate, onUpdate, onDelete, onAddRun, onRemoveRun, onUpdateRun } = props
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const selected = games.find((g) => g.id === selectedId) ?? null

  const { chartGames, extraGames, scoreGames } = useMemo(() => {
    const chart: ArcadeGame[] = []
    const extra: ArcadeGame[] = []
    const score: ArcadeGame[] = []
    for (const g of games) {
      if (g.type === 'score') { score.push(g); continue }
      if (g.section === 'extra') extra.push(g)
      else chart.push(g)
    }
    const byCreated = (a: ArcadeGame, b: ArcadeGame) => a.createdAt - b.createdAt
    chart.sort(byCreated); extra.sort(byCreated); score.sort(byCreated)
    return { chartGames: chart, extraGames: extra, scoreGames: score }
  }, [games])

  if (selected) {
    return (
      <ArcadeGameDetail
        game={selected}
        onUpdate={(patch) => onUpdate(selected.id, patch)}
        onAddRun={(run) => onAddRun(selected.id, run)}
        onRemoveRun={(rid) => onRemoveRun(selected.id, rid)}
        onUpdateRun={(rid, patch) => onUpdateRun(selected.id, rid, patch)}
        onBack={() => setSelectedId(null)}
        onDelete={() => {
          if (!window.confirm(`Delete "${selected.title}" and its ${selected.runs.length} runs?`)) return
          onDelete(selected.id)
          setSelectedId(null)
        }}
      />
    )
  }

  return (
    <div className="arcade-view">
      <div className="arcade-chart-header">
        <h1>ARCADE CHART</h1>
        <button type="button" className="primary-btn" onClick={() => setNewOpen(true)}>+ Add game</button>
      </div>

      {games.length === 0 && (
        <div className="arcade-empty">
          <p>No arcade games yet.</p>
          <p className="hint">Click <b>+ Add game</b> to create one. Choose <b>Grid</b> for a doopu-style character × difficulty tracker, or <b>Score log</b> for a simple high-score list.</p>
        </div>
      )}

      {chartGames.length > 0 && (
        <div className="arcade-chart-flow">
          {chartGames.map((g) => (
            <ArcadeMiniGrid
              key={g.id}
              game={g}
              onOpen={() => setSelectedId(g.id)}
              onCellClick={() => setSelectedId(g.id)}
            />
          ))}
        </div>
      )}

      {extraGames.length > 0 && (
        <>
          <div className="arcade-chart-header arcade-chart-subhead">
            <h2>EXTRA</h2>
          </div>
          <div className="arcade-chart-flow">
            {extraGames.map((g) => (
              <ArcadeMiniGrid
                key={g.id}
                game={g}
                onOpen={() => setSelectedId(g.id)}
                onCellClick={() => setSelectedId(g.id)}
              />
            ))}
          </div>
        </>
      )}

      {scoreGames.length > 0 && (
        <>
          <div className="arcade-chart-header arcade-chart-subhead">
            <h2>SCORE LOGS</h2>
          </div>
          <div className="arcade-score-flow">
            {scoreGames.map((g) => {
              const pb = bestScore(g.runs)
              const has1cc = g.runs.some((r) => r.flags.includes('1cc'))
              return (
                <button
                  key={g.id}
                  type="button"
                  className="arcade-score-card"
                  onClick={() => setSelectedId(g.id)}
                >
                  {g.logo && <img className="arcade-score-logo" src={g.logo} alt="" />}
                  <div className="arcade-score-body">
                    <div className="arcade-score-title">{g.title || '(untitled)'}</div>
                    <div className="arcade-score-pb">
                      PB {pb !== undefined ? pb.toLocaleString() : '—'} · {g.runs.length} run{g.runs.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  {has1cc && <span className="arcade-badge">1cc</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="arcade-legend">
        <div className="arcade-legend-title">LEGEND</div>
        <div className="arcade-legend-row"><span className="arcade-mini-cell cleared" /> cleared</div>
        <div className="arcade-legend-row"><span className="arcade-mini-cell cleared is-1cc" /> 1cc</div>
        <div className="arcade-legend-row"><span className="arcade-mini-cell cleared is-nm" /> no-miss</div>
        <div className="arcade-legend-row"><span className="arcade-mini-cell cleared is-nb" /> no-bomb</div>
        <div className="arcade-legend-row"><span className="arcade-mini-cell cleared is-ex" /> extra-clear</div>
      </div>

      <div className="arcade-credit">
        Grid layout adapted from{' '}
        <a
          href="https://github.com/doopu/1ccTracker"
          onClick={(e) => { e.preventDefault(); window.ipcRenderer.invoke('updates:open-url', 'https://github.com/doopu/1ccTracker') }}
        >doopu/1ccTracker</a>
      </div>

      {newOpen && (
        <NewGameModal
          onCreate={onCreate}
          onClose={() => setNewOpen(false)}
        />
      )}
    </div>
  )
}
