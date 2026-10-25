// Detail view for one arcade game, laid out like the library detail
// pages: hero header (logo, chips, editable title, actions, quick stats)
// and tabs. Grid games get Grid / Runs / Progression; score logs skip
// the grid.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArcadeGame, Run } from '../types/arcade'
import ArcadeRunEditor from './ArcadeRunEditor'
import ArcadeMiniGrid from './ArcadeMiniGrid'
import GridEditor from './GridEditor'
import ScoreChart from './ScoreChart'
import { locale, t } from '../i18n'

type Tab = 'grid' | 'runs' | 'progression'

interface Props {
  game: ArcadeGame
  onUpdate: (patch: Partial<ArcadeGame>) => void
  onAddRun: (run: Omit<Run, 'id'>) => void
  onRemoveRun: (runId: string) => void
  onUpdateRun: (runId: string, patch: Partial<Run>) => void
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
  const { game, onUpdate, onAddRun, onRemoveRun, onUpdateRun, onDelete } = props
  const isGrid = game.type === 'grid'
  const pb = useMemo(() => bestScore(game.runs), [game.runs])
  const clears = useMemo(() => game.runs.filter((r) => r.flags.includes('1cc')).sort((a, b) => a.date.localeCompare(b.date)), [game.runs])
  const hasScores = game.runs.some((r) => typeof r.score === 'number')

  const [tab, setTab] = useState<Tab>(isGrid ? 'grid' : 'runs')
  const [editingAxes, setEditingAxes] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const gridEmpty = isGrid && ((game.grid?.characters.length ?? 0) === 0 || (game.grid?.difficulties.length ?? 0) === 0)
  const pbSub = pb.run ? [pb.run.character, pb.run.difficulty, pb.run.date].filter(Boolean).join(' · ') : ''
  const tabs: { id: Tab; label: string; count?: number; hidden?: boolean }[] = [
    { id: 'grid', label: t('Grid'), hidden: !isGrid },
    { id: 'runs', label: t('Runs'), count: game.runs.length },
    { id: 'progression', label: t('Progression'), hidden: !hasScores },
  ]

  return (
    <div className="content-scroll arcade-detail">
      <header className="hero arcade-hero">
        <div className="hero-stage no-banner">
          {game.logo && <img className="hero-bg" src={game.logo} alt="" aria-hidden />}
          {game.logo
            ? <img className="arcade-hero-logo zoomable" src={game.logo} alt={game.title} data-zoom-label={t('Logo')} />
            : <span className="arcade-hero-abbr">{(game.abbreviation || game.title).slice(0, 6)}</span>}
        </div>
        <div className="hero-body">
          <div className="hero-text">
            <div className="hero-chips">
              <span>{isGrid ? t('Grid') : t('Score log')}</span>
              {clears.length > 0 && <span>1cc</span>}
              {game.abbreviation && <span>{game.abbreviation}</span>}
            </div>
            <input
              className="arcade-title-input"
              value={game.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder={t('Game title')}
              aria-label={t('Game title')}
              title={t('Click to rename')}
            />
          </div>
          <div className="hero-actions">
            {isGrid && (
              <button type="button" className="add-btn" onClick={() => { setTab('grid'); setEditingAxes((v) => !v) }}>
                {editingAxes ? t('✓ Done') : t('✎ Edit axes')}
              </button>
            )}
            <div className="pop-wrap" ref={menuRef}>
              <button type="button" className={`icon-btn${menuOpen ? ' on' : ''}`} aria-label={t('More actions')} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>⋯</button>
              {menuOpen && (
                <div className="pop" role="menu">
                  <div className="pop-list">
                    <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDelete() }}>
                      <span className="pop-icon" aria-hidden>✕</span>{t('Delete game')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <dl className="hero-stats">
          <div><dt>{t('Personal best')}</dt><dd>{pb.score !== undefined ? pb.score.toLocaleString(locale()) : '—'}{pbSub && <small>{pbSub}</small>}</dd></div>
          <div><dt>{t('Runs')}</dt><dd>{game.runs.length}</dd></div>
          {isGrid && <div><dt>{t('1cc clears')}</dt><dd>{clears.length}</dd></div>}
          {isGrid && <div><dt>{t('First 1cc')}</dt><dd>{clears[0] ? clears[0].date : '—'}{clears[0] && <small>{[clears[0].character, clears[0].difficulty].filter(Boolean).join(' · ')}</small>}</dd></div>}
        </dl>
      </header>

      <nav className="hero-tabs" role="tablist">
        {tabs.filter((t) => !t.hidden).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}{t.count != null && t.count > 0 && <span className="hero-tab-count">{t.count}</span>}
          </button>
        ))}
      </nav>

      <div className="detail-tab-body">
        {tab === 'grid' && isGrid && (
          <>
            {editingAxes && <GridEditor game={game} onUpdate={onUpdate} />}
            {gridEmpty
              ? !editingAxes && <p className="hint">{t('This grid has no axes yet. Click')}{' '}<b>{t('✎ Edit axes')}</b>{' '}{t('to add characters and difficulties.')}</p>
              : <div className="arcade-detail-grid-wrap"><ArcadeMiniGrid game={game} onOpen={() => { /* already in detail */ }} /></div>}
          </>
        )}
        {tab === 'runs' && <ArcadeRunEditor game={game} onAdd={onAddRun} onRemove={onRemoveRun} onUpdate={onUpdateRun} />}
        {tab === 'progression' && hasScores && <ScoreChart runs={game.runs} />}
      </div>
    </div>
  )
}
