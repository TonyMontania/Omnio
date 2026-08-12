// Wikipedia-style member + release timeline for a MusicArtist.
//
// Reads:
//   * artist.activeFrom / activeTo           → outer X-axis range
//   * artist.members[].joinedIn / leftIn     → per-member primary span
//   * artist.members[].roles                 → primary role color
//   * artist.members[].stints[].from / to    → overlay bars in a different role color
//   * releases                                → studio albums by this artist,
//                                               placed as dashed vertical lines
//
// Everything's SVG so it renders crisply at any zoom, prints, and copies
// cleanly. No external chart library — we own a tiny D3-shaped layout.

import { useMemo } from 'react'
import type { BandMember, Item, MusicArtist } from '../types'

interface Props {
  artist: MusicArtist
  releases: Item[]
}

// Extract the first 4-digit year in a free-text string. "March 1998" → 1998,
// "?" → undefined, "" → undefined. Falls back to `undefined` on any parse
// failure so downstream code can gate rendering behind Number.isFinite.
function pickYear(raw?: string): number | undefined {
  if (!raw) return undefined
  const m = /(\d{4})/.exec(raw)
  return m ? Number(m[1]) : undefined
}

// Role-name → hex mapping. Case- and whitespace-insensitive; the lookup
// key is the lowercased role stripped of trailing "s" so "Vocals" and
// "Vocal" collide. Unknown roles fall through to the palette cycle so
// two members with the same "Percussion" tag get the same swatch.
const ROLE_COLOR: Record<string, string> = {
  'lead vocal':     '#e63946',
  'vocal':          '#e63946',
  'backing vocal':  '#f4a6b3',
  'harmony':        '#f4a6b3',
  'lead guitar':    '#2a9d3f',
  'rhythm guitar':  '#7cd07c',
  'guitar':         '#4bb04b',
  'acoustic':       '#7cd07c',
  'bass':           '#2a7cd6',
  'drum':           '#f2861c',
  'percussion':     '#f2861c',
  'keyboard':       '#8e44ad',
  'piano':          '#8e44ad',
  'organ':          '#8e44ad',
  'synth':          '#c341c3',
  'producer':       '#7a7a7a',
  'sax':            '#e2b93b',
  'saxophone':      '#e2b93b',
  'trumpet':        '#d8b834',
  'violin':         '#a2c334',
  'cello':          '#699a1e',
  'dj':             '#4a90a4',
  'turntable':      '#4a90a4',
}
const FALLBACK_PALETTE = ['#c78e5e', '#5eb0c7', '#c75e9a', '#5ec78e', '#c7c75e', '#8e5ec7', '#5e76c7']
function roleKey(role: string): string {
  return role.trim().toLowerCase().replace(/s$/, '')
}
function colorFor(role: string, cache: Map<string, string>): string {
  const key = roleKey(role)
  if (ROLE_COLOR[key]) return ROLE_COLOR[key]
  if (cache.has(key)) return cache.get(key)!
  const color = FALLBACK_PALETTE[cache.size % FALLBACK_PALETTE.length]
  cache.set(key, color)
  return color
}

interface Segment {
  fromYear: number
  toYear: number         // exclusive-ish; we render up to (toYear + 1) to include the whole final year
  role: string
  color: string
}

// Build the [primary + stints] segment list for one member. Primary span
// spans joinedIn → leftIn (or bandEndYear); each stint overlays the same
// row with its own color so a bassist-turned-guitarist reads as two
// stacked segments across the row.
function segmentsFor(m: BandMember, bandStart: number, bandEnd: number, colorCache: Map<string, string>): Segment[] {
  const primaryStart = pickYear(m.joinedIn) ?? bandStart
  const primaryEnd = m.former ? (pickYear(m.leftIn) ?? bandEnd) : bandEnd
  const segments: Segment[] = []
  const primaryRole = m.roles[0] ?? 'Member'
  segments.push({
    fromYear: primaryStart,
    toYear: primaryEnd,
    role: primaryRole,
    color: colorFor(primaryRole, colorCache),
  })
  for (const s of m.stints ?? []) {
    const from = pickYear(s.from)
    const to = pickYear(s.to) ?? bandEnd
    if (from === undefined) continue
    const role = s.roles[0] ?? 'Member'
    segments.push({ fromYear: from, toYear: to, role, color: colorFor(role, colorCache) })
  }
  return segments
}

export default function BandTimeline({ artist, releases }: Props) {
  const nowYear = new Date().getFullYear()

  const { rows, minYear, maxYear, roleLegend, albumYears, hasData } = useMemo(() => {
    const colorCache = new Map<string, string>()
    const members = artist.members ?? []
    if (members.length === 0) {
      return { rows: [], minYear: 0, maxYear: 0, roleLegend: [] as { role: string; color: string }[], albumYears: [] as { year: number; title: string }[], hasData: false }
    }
    const bandStart = pickYear(artist.activeFrom) ?? Math.min(
      ...members.map((m) => pickYear(m.joinedIn) ?? nowYear).filter((y) => Number.isFinite(y)),
    )
    const bandEnd = pickYear(artist.activeTo) ?? nowYear

    const rows = members.map((m) => ({
      member: m,
      segments: segmentsFor(m, bandStart, bandEnd, colorCache),
    }))

    // Album markers — same-artist album-like items with a parseable year.
    // Extract using YYYY-MM-DD's first four digits so timezone stays out
    // of it (see utils/format.formatIsoDate for the same trick).
    const artistLc = artist.name.trim().toLowerCase()
    const albumYears: { year: number; title: string }[] = []
    for (const it of releases) {
      if ((it.artist ?? '').trim().toLowerCase() !== artistLc) continue
      if (it.musicType !== 'album') continue
      const year = pickYear(it.releaseDate) ?? pickYear(it.releaseYear)
      if (year === undefined) continue
      albumYears.push({ year, title: it.title })
    }
    albumYears.sort((a, b) => a.year - b.year)

    // Legend: every role that got a color, in first-seen order. Includes
    // both the primary role of each member and every stint role. Dedupe
    // via a Set keyed on the normalized role name.
    const seenRoles = new Set<string>()
    const roleLegend: { role: string; color: string }[] = []
    for (const row of rows) {
      for (const seg of row.segments) {
        const k = roleKey(seg.role)
        if (seenRoles.has(k)) continue
        seenRoles.add(k)
        roleLegend.push({ role: seg.role, color: seg.color })
      }
    }

    // Global year range for the axis: min of all row/segment starts and
    // the earliest album, max of all ends and the latest album.
    const allStarts: number[] = rows.flatMap((r) => r.segments.map((s) => s.fromYear))
    const allEnds: number[] = rows.flatMap((r) => r.segments.map((s) => s.toYear))
    if (albumYears.length > 0) {
      allStarts.push(albumYears[0].year)
      allEnds.push(albumYears[albumYears.length - 1].year)
    }
    // Pad by a year on each side so segments touching the edge don't get
    // clipped visually against the axis.
    const minYear = Math.min(bandStart, ...allStarts) - 1
    const maxYear = Math.max(bandEnd, ...allEnds) + 1

    return { rows, minYear, maxYear, roleLegend, albumYears, hasData: true }
  }, [artist, releases, nowYear])

  if (!hasData) return null

  // Layout constants — expressed in the SVG's internal viewBox units so
  // the whole thing scales cleanly through CSS width: 100%.
  const rowHeight = 20
  const rowGap = 4
  const leftLabelWidth = 130
  const topPadding = 8
  const bottomPadding = 40   // room for year axis
  const chartWidth = 700
  const totalHeight = topPadding + rows.length * (rowHeight + rowGap) + bottomPadding
  const yearSpan = maxYear - minYear || 1
  const yearToX = (y: number) => leftLabelWidth + ((y - minYear) / yearSpan) * chartWidth

  // Axis tick every 2 years, plus a labeled tick every 2. Skip when the
  // span is so small that ticks would overlap.
  const ticks: number[] = []
  const tickStep = yearSpan > 30 ? 4 : yearSpan > 12 ? 2 : 1
  for (let y = Math.ceil(minYear / tickStep) * tickStep; y <= maxYear; y += tickStep) ticks.push(y)

  return (
    <div className="band-timeline">
      <svg viewBox={`0 0 ${leftLabelWidth + chartWidth + 20} ${totalHeight}`} width="100%" role="img" aria-label={`Timeline for ${artist.name}`}>
        {/* Member rows */}
        {rows.map((row, i) => {
          const y = topPadding + i * (rowHeight + rowGap)
          return (
            <g key={row.member.id}>
              <text x={leftLabelWidth - 6} y={y + rowHeight * 0.72} textAnchor="end" className="band-timeline-name" style={{ fontSize: 11 }}>
                {row.member.name}
                {row.member.deceased ? ' †' : ''}
              </text>
              {row.segments.map((seg, si) => {
                const x = yearToX(seg.fromYear)
                const w = Math.max(1, yearToX(seg.toYear) - x)
                return (
                  <rect
                    key={si}
                    x={x}
                    y={y}
                    width={w}
                    height={rowHeight}
                    fill={seg.color}
                    rx={2}
                  >
                    <title>{`${row.member.name} — ${seg.role} (${seg.fromYear}${seg.toYear !== seg.fromYear ? `–${seg.toYear}` : ''})`}</title>
                  </rect>
                )
              })}
            </g>
          )
        })}

        {/* Album marker lines — drawn AFTER member rows so they overlay */}
        {albumYears.map((a, i) => {
          const x = yearToX(a.year)
          const topY = topPadding
          const botY = topPadding + rows.length * (rowHeight + rowGap) - rowGap
          return (
            <line
              key={i}
              x1={x}
              x2={x}
              y1={topY}
              y2={botY}
              stroke="var(--text)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
            >
              <title>{`${a.title} (${a.year})`}</title>
            </line>
          )
        })}

        {/* X axis */}
        {(() => {
          const y = topPadding + rows.length * (rowHeight + rowGap) + 4
          return (
            <g>
              <line x1={leftLabelWidth} x2={leftLabelWidth + chartWidth} y1={y} y2={y} stroke="var(--border)" />
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={yearToX(t)} x2={yearToX(t)} y1={y} y2={y + 4} stroke="var(--text-faint)" />
                  <text x={yearToX(t)} y={y + 16} textAnchor="middle" style={{ fontSize: 10 }} className="band-timeline-tick">{t}</text>
                </g>
              ))}
            </g>
          )
        })()}
      </svg>

      <div className="band-timeline-legend">
        {roleLegend.map((r) => (
          <span key={r.role} className="band-timeline-legend-item">
            <span className="band-timeline-swatch" style={{ background: r.color }} />
            {r.role}
          </span>
        ))}
        {albumYears.length > 0 && (
          <span className="band-timeline-legend-item">
            <span className="band-timeline-swatch dashed" />
            Studio album
          </span>
        )}
      </div>
    </div>
  )
}
