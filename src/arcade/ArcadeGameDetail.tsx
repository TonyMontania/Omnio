// Detail view for one arcade game. Branches on game.type:
//   - 'grid'  → shows the axis editor, the full grid, and the run log
//   - 'score' → shows just PB stats + run log (no axes, no grid)

import { useMemo, useState } from 'react'
import type { ArcadeGame, Run } from '../types/arcade'
import ArcadeRunEditor from './ArcadeRunEditor'
import ArcadeMiniGrid from './ArcadeMiniGrid'
import GridEditor from './GridEditor'

interface Props {
  game: ArcadeGame
  onUpdate: (patch: Partial<ArcadeGame>) => void
  onAddRun: (run: Omit<Run, 'id'>) => void
  onRemoveRun: (runId: string) => void
  onUpdateRun: (runId: string, patch: Partial<Run>) => void
  onBack: () => void
  onDelete: () => void
}

function bestScore(runs: Run[]): { score?: number; run?: Run } {
  let best: Run | undefined
  let s = -Infinity
  for (const r of runs) {
    const rs = r.score ?? -Infinity
    if (rs > s) { s = rs; best = r }
  }
  return { score: best?.score, run: best }
}

export default function ArcadeGameDetail(props: Props) {
  const { game, onUpdate, onAddRun, onRemoveRun, onUpdateRun, onBack, onDelete } = props
  const pb = useMemo(() => bestScore(game.runs), [game.runs])
  const first1cc = useMemo(() => {
    const cleared = game.runs.filter((r) => r.flags.includes('1cc'))
    cleared.sort((a, b) => a.date.localeCompare(b.date))
    return cleared[0]
  }, [game.runs])

  const [editingAxes, setEditingAxes] = useState(false)
  const gridEmpty = game.type === 'grid' &&
    ((game.grid?.characters.length ?? 0) === 0 || (game.grid?.difficulties.length ?? 0) === 0)

  return (
    <div className="arcade-detail">
      <div className="arcade-detail-head">
        <button type="button" className="ghost-btn" onClick={onBack}>← Back</button>
        {game.logo && <img className="arcade-detail-logo" src={game.logo} alt="" />}
        <input
          className="arcade-detail-title"
          value={game.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Game title"
        />
        <button type="button" className="danger-btn" onClick={onDelete}>Delete</button>
      </div>

      <div className="arcade-detail-stats">
        <div className="arcade-stat">
          <span className="arcade-stat-label">Personal best</span>
          <span className="arcade-stat-value">{pb.score !== undefined ? pb.score.toLocaleString() : '—'}</span>
          {pb.run && <span className="arcade-stat-sub">{pb.run.character ?? ''} · {pb.run.difficulty ?? ''} · {pb.run.date}</span>}
        </div>
        <div className="arcade-stat">
          <span className="arcade-stat-label">Total runs</span>
          <span className="arcade-stat-value">{game.runs.length}</span>
        </div>
        {game.type === 'grid' && (
          <div className="arcade-stat">
            <span className="arcade-stat-label">First 1cc</span>
            <span className="arcade-stat-value">{first1cc ? first1cc.date : '—'}</span>
            {first1cc && <span className="arcade-stat-sub">{first1cc.character ?? ''} · {first1cc.difficulty ?? ''}</span>}
          </div>
        )}
      </div>

      {game.type === 'grid' && (
        <section className="arcade-section">
          <div className="arcade-section-head">
            <h3>Grid</h3>
            <button type="button" className="ghost-btn" onClick={() => setEditingAxes((v) => !v)}>
              {editingAxes ? '✓ Done editing' : '✎ Edit axes'}
            </button>
          </div>

          {editingAxes && <GridEditor game={game} onUpdate={onUpdate} />}
          {gridEmpty
            ? !editingAxes && <p className="hint">This grid has no axes yet. Click <b>✎ Edit axes</b> to add characters and difficulties.</p>
            : <div className="arcade-detail-grid-wrap">
                <ArcadeMiniGrid game={game} onOpen={() => { /* already in detail */ }} />
              </div>}
        </section>
      )}

      <section className="arcade-section">
        <h3>Run log</h3>
        <ArcadeRunEditor
          game={game}
          onAdd={onAddRun}
          onRemove={onRemoveRun}
          onUpdate={onUpdateRun}
        />
      </section>
    </div>
  )
}
