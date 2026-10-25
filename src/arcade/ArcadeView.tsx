// Top-level Arcade view. Grid-tracker games render as doopu-style mini
// charts; score-log games as cards. The top bar (title, filters, search,
// + Add game) is published through setPageMeta like the library pages.
// A selected game routes to the detail view.

import { useEffect, useMemo, useState } from 'react'
import type { ArcadeGame, Run } from '../types/arcade'
import type { PluginPageMeta } from '../plugins/registry'
import { ArcadeIcon } from '../icons'
import ArcadeGameDetail from './ArcadeGameDetail'
import ArcadeMiniGrid from './ArcadeMiniGrid'
import NewGameModal from './NewGameModal'

type Filter = 'all' | 'grid' | 'score'

interface Props {
  games: ArcadeGame[]
  setPageMeta: (meta: PluginPageMeta | null) => void
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
  const { games, setPageMeta, onCreate, onUpdate, onDelete, onAddRun, onRemoveRun, onUpdateRun } = props
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const selected = games.find((g) => g.id === selectedId) ?? null
  const query = search.trim().toLowerCase()

  const { chartGames, extraGames, scoreGames, gridCount, scoreCount } = useMemo(() => {
    const chart: ArcadeGame[] = []
    const extra: ArcadeGame[] = []
    const score: ArcadeGame[] = []
    let grids = 0
    let scores = 0
    for (const g of games) {
      if (g.type === 'score') scores++
      else grids++
      if (query && !g.title.toLowerCase().includes(query) && !(g.abbreviation ?? '').toLowerCase().includes(query)) continue
      if (g.type === 'score') { if (filter !== 'grid') score.push(g); continue }
      if (filter === 'score') continue
      if (g.section === 'extra') extra.push(g)
      else chart.push(g)
    }
    const byCreated = (a: ArcadeGame, b: ArcadeGame) => a.createdAt - b.createdAt
    chart.sort(byCreated); extra.sort(byCreated); score.sort(byCreated)
    return { chartGames: chart, extraGames: extra, scoreGames: score, gridCount: grids, scoreCount: scores }
  }, [games, filter, query])

  useEffect(() => {
    if (selected) {
      setPageMeta({ icon: <ArcadeIcon />, title: 'Arcade', onBack: () => setSelectedId(null) })
      return
    }
    setPageMeta({
      icon: <ArcadeIcon />,
      title: 'Arcade',
      count: { n: games.length, unit: games.length === 1 ? 'game' : 'games' },
      chips: [
        { key: 'all', label: 'All', count: games.length, active: filter === 'all', onClick: () => setFilter('all') },
        { key: 'grid', label: 'Grids', count: gridCount, active: filter === 'grid', onClick: () => setFilter('grid') },
        { key: 'score', label: 'Score logs', count: scoreCount, active: filter === 'score', onClick: () => setFilter('score') },
      ],
      actions: (
        <div className="ctl">
          <label className="search-box">
            <span aria-hidden>⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search games" aria-label="Search games" />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}
          </label>
          <button type="button" className="add-btn" onClick={() => setNewOpen(true)}>+ Add game</button>
        </div>
      ),
    })
  }, [selected, games.length, gridCount, scoreCount, filter, search, setPageMeta])

  if (selected) {
    return (
      <ArcadeGameDetail
        game={selected}
        onUpdate={(patch) => onUpdate(selected.id, patch)}
        onAddRun={(run) => onAddRun(selected.id, run)}
        onRemoveRun={(rid) => onRemoveRun(selected.id, rid)}
        onUpdateRun={(rid, patch) => onUpdateRun(selected.id, rid, patch)}
        onDelete={() => {
          if (!window.confirm(`Delete "${selected.title}" and its ${selected.runs.length} runs?`)) return
          onDelete(selected.id)
          setSelectedId(null)
        }}
      />
    )
  }

  const nothingShown = chartGames.length + extraGames.length + scoreGames.length === 0

  return (
    <div className="content-scroll arcade-view">
      {games.length === 0 ? (
        <div className="arcade-empty">
          <p>No arcade games yet.</p>
          <p className="hint">Click <b>+ Add game</b> to create one. Choose <b>Grid</b> for a character × difficulty clear tracker, or <b>Score log</b> for a simple high-score list.</p>
        </div>
      ) : nothingShown && (
        <div className="arcade-empty"><p>No games match this view.</p></div>
      )}

      {chartGames.length > 0 && (
        <section className="arcade-block">
          <h2 className="arcade-block-title">Chart</h2>
          <div className="arcade-chart-flow">
            {chartGames.map((g) => (
              <ArcadeMiniGrid key={g.id} game={g} onOpen={() => setSelectedId(g.id)} onCellClick={() => setSelectedId(g.id)} />
            ))}
          </div>
        </section>
      )}

      {extraGames.length > 0 && (
        <section className="arcade-block">
          <h2 className="arcade-block-title">Extra</h2>
          <div className="arcade-chart-flow">
            {extraGames.map((g) => (
              <ArcadeMiniGrid key={g.id} game={g} onOpen={() => setSelectedId(g.id)} onCellClick={() => setSelectedId(g.id)} />
            ))}
          </div>
        </section>
      )}

      {scoreGames.length > 0 && (
        <section className="arcade-block">
          <h2 className="arcade-block-title">Score logs</h2>
          <div className="arcade-score-flow">
            {scoreGames.map((g) => {
              const pb = bestScore(g.runs)
              const has1cc = g.runs.some((r) => r.flags.includes('1cc'))
              return (
                <button key={g.id} type="button" className="arcade-score-card" onClick={() => setSelectedId(g.id)}>
                  <div className="arcade-score-art">
                    {g.logo ? <img src={g.logo} alt="" /> : <span>{(g.abbreviation || g.title).slice(0, 3)}</span>}
                    {has1cc && <span className="arcade-badge">1cc</span>}
                  </div>
                  <div className="arcade-score-title">{g.title || '(untitled)'}</div>
                  <div className="arcade-score-pb">
                    PB {pb !== undefined ? pb.toLocaleString() : '—'} · {g.runs.length} run{g.runs.length === 1 ? '' : 's'}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {gridCount > 0 && filter !== 'score' && (
        <div className="arcade-legend">
          <span className="arcade-legend-row"><span className="arcade-mini-cell cleared" /> Cleared</span>
          <span className="arcade-legend-row"><span className="arcade-mini-cell cleared is-1cc" /> 1cc</span>
          <span className="arcade-legend-row"><span className="arcade-mini-cell cleared is-nm" /> No-miss</span>
          <span className="arcade-legend-row"><span className="arcade-mini-cell cleared is-nb" /> No-bomb</span>
          <span className="arcade-legend-row"><span className="arcade-mini-cell cleared is-ex" /> Extra clear</span>
          <span className="arcade-credit">
            Grid layout adapted from{' '}
            <a
              href="https://github.com/doopu/1ccTracker"
              onClick={(e) => { e.preventDefault(); window.ipcRenderer.invoke('updates:open-url', 'https://github.com/doopu/1ccTracker') }}
            >doopu/1ccTracker</a>
          </span>
        </div>
      )}

      {newOpen && <NewGameModal onCreate={onCreate} onClose={() => setNewOpen(false)} />}
    </div>
  )
}
