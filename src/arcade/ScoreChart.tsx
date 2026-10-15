import { useMemo, useState } from 'react'
import type { Run } from '../types/arcade'

interface Props {
  runs: Run[]
}

const W = 640
const H = 220
const PAD = { top: 14, right: 16, bottom: 26, left: 64 }

function compact(n: number): string {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

function comboKey(r: Run): string {
  return [r.character, r.difficulty].filter(Boolean).join(' · ')
}

export default function ScoreChart({ runs }: Props) {
  const [combo, setCombo] = useState('')
  const [hover, setHover] = useState<number | null>(null)

  const combos = useMemo(() => {
    const set = new Set(runs.filter((r) => typeof r.score === 'number').map(comboKey).filter(Boolean))
    return Array.from(set).sort()
  }, [runs])

  const points = useMemo(() => runs
    .filter((r) => typeof r.score === 'number' && r.date && (!combo || comboKey(r) === combo))
    .sort((a, b) => a.date.localeCompare(b.date)), [runs, combo])

  if (points.length < 2) {
    return <p className="hint">Log at least two runs with a score to see how it evolves.</p>
  }

  const scores = points.map((r) => r.score!)
  const max = Math.max(...scores)
  const min = Math.min(...scores)
  const span = max - min || max || 1
  const lo = Math.max(0, min - span * 0.08)
  const hi = max + span * 0.08
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH

  let best = -Infinity
  const pbPath = points.map((r, i) => {
    const prev = best
    best = Math.max(best, r.score!)
    if (i === 0) return `M${x(0)},${y(best)}`
    return prev === best ? `L${x(i)},${y(best)}` : `L${x(i)},${y(prev)} L${x(i)},${y(best)}`
  }).join(' ')

  const ticks = [lo, lo + (hi - lo) / 2, hi]
  const hovered = hover !== null ? points[hover] : null

  return (
    <div className="arcade-chart">
      <div className="arcade-chart-bar">
        {combos.length > 1 && (
          <select className="sort-select" value={combo} onChange={(e) => { setCombo(e.target.value); setHover(null) }}>
            <option value="">All characters & difficulties</option>
            {combos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <span className="arcade-chart-legend">
          <span className="legend-dot" aria-hidden /> Run score
          <span className="legend-line" aria-hidden /> Personal best
        </span>
      </div>
      <div className="arcade-chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Score per run, ${points.length} runs, personal best ${max.toLocaleString()}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="arcade-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
              <text className="arcade-chart-axis" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{compact(t)}</text>
            </g>
          ))}
          <text className="arcade-chart-axis" x={PAD.left} y={H - 6}>{points[0].date}</text>
          <text className="arcade-chart-axis" x={W - PAD.right} y={H - 6} textAnchor="end">{points[points.length - 1].date}</text>
          <path className="arcade-chart-pb" d={pbPath} />
          {points.map((r, i) => (
            <g key={r.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(i)} cy={y(r.score!)} r={12} fill="transparent" />
              <circle className={hover === i ? 'arcade-chart-dot active' : 'arcade-chart-dot'} cx={x(i)} cy={y(r.score!)} r={4.5} />
            </g>
          ))}
        </svg>
        {hovered && hover !== null && (
          <div className="arcade-chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hovered.score!) / H) * 100}%` }}>
            <b>{hovered.score!.toLocaleString()}</b>
            <span>{hovered.date}</span>
            {comboKey(hovered) && <span>{comboKey(hovered)}</span>}
            {hovered.flags.length > 0 && <span>{hovered.flags.join(' · ')}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
