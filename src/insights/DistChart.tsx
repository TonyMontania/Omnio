// Pie / bar chart for status distribution. Data comes from getDistribution().

import type { DistSlice } from './stats'

export default function DistChart({ data, mode }: { data: DistSlice[]; mode: 'pie' | 'bar' }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  if (total === 0) return <p className="hint">No data yet.</p>

  if (mode === 'bar') {
    return (
      <div className="bar-chart">
        {data.map((d) => (
          <div key={d.label} className="bar-row">
            <span className="bar-label">{d.label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(d.value / total) * 100}%`, background: d.color }} />
            </div>
            <span className="bar-value">{d.value}</span>
          </div>
        ))}
      </div>
    )
  }

  let cumulative = 0
  const gradient = data.filter((d) => d.value > 0).map((d) => {
    const pct = (d.value / total) * 100
    const start = cumulative
    cumulative += pct
    return `${d.color} ${start}% ${cumulative}%`
  }).join(', ')

  return (
    <div className="pie-chart-wrap">
      <div className="pie-chart" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="pie-chart-hole" />
      </div>
      <div className="pie-legend">
        {data.map((d) => (
          <div key={d.label} className="pie-legend-row">
            <span className="pie-dot" style={{ background: d.color }} />
            <span>{d.label}</span>
            <span className="pie-legend-value">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
