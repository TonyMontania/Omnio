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

interface RowData {
  primary: Segment
  // Stints that OVERLAP the primary span — render as a thinner centered
  // strip inside the primary bar so a "clean vocals since 2019, also did
  // unclean vocals 2019–2023" member reads as one long red bar with a
  // blue strip through the middle for the overlap years, not as two
  // sequential bars that visually cut the primary.
  overlays: Segment[]
  // Stints that fall OUTSIDE the primary span — render as normal
  // full-height bars in their own year range. Covers pre-membership
  // guest stints, or a role held after officially "leaving" for a
  // farewell tour, etc.
  sideBars: Segment[]
}

function segmentsFor(m: BandMember, bandStart: number, bandEnd: number, colorCache: Map<string, string>): RowData {
  const primaryStart = pickYear(m.joinedIn) ?? bandStart
  const primaryEnd = m.former ? (pickYear(m.leftIn) ?? bandEnd) : bandEnd
  const primaryRole = m.roles[0] ?? 'Member'
  const primary: Segment = {
    fromYear: primaryStart,
    toYear: primaryEnd,
    role: primaryRole,
    color: colorFor(primaryRole, colorCache),
  }
  const overlays: Segment[] = []
  const sideBars: Segment[] = []
  for (const s of m.stints ?? []) {
    const from = pickYear(s.from)
    const to = pickYear(s.to) ?? bandEnd
    if (from === undefined) continue
    const role = s.roles[0] ?? 'Member'
    const seg: Segment = { fromYear: from, toYear: to, role, color: colorFor(role, colorCache) }
    // Overlap with primary = simultaneous second role → inner strip.
    // Fully disjoint = side bar in its own space.
    const overlaps = from < primaryEnd && to > primaryStart
    if (overlaps) {
      // Clip to the intersection with the primary span so the strip
      // stays inside the base bar.
      overlays.push({
        ...seg,
        fromYear: Math.max(from, primaryStart),
        toYear: Math.min(to, primaryEnd),
      })
    } else {
      sideBars.push(seg)
    }
  }
  return { primary, overlays, sideBars }
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

    // Legend: every role that got a color, in first-seen order. Walks
    // primary + overlays + sideBars so a role that only appears as a
    // simultaneous second gig still gets its swatch.
    const seenRoles = new Set<string>()
    const roleLegend: { role: string; color: string }[] = []
    const pushRole = (seg: Segment) => {
      const k = roleKey(seg.role)
      if (seenRoles.has(k)) return
      seenRoles.add(k)
      roleLegend.push({ role: seg.role, color: seg.color })
    }
    for (const row of rows) {
      pushRole(row.segments.primary)
      for (const seg of row.segments.overlays) pushRole(seg)
      for (const seg of row.segments.sideBars) pushRole(seg)
    }

    // Global year range for the axis: min of all row/segment starts and
    // the earliest album, max of all ends and the latest album.
    const allSegments = (r: typeof rows[number]) => [r.segments.primary, ...r.segments.overlays, ...r.segments.sideBars]
    const allStarts: number[] = rows.flatMap((r) => allSegments(r).map((s) => s.fromYear))
    const allEnds: number[] = rows.flatMap((r) => allSegments(r).map((s) => s.toYear))
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

  // Layout constants — expressed in the SVG's internal viewBox units.
  // The container CSS caps max-width so the SVG renders roughly 1 unit
  // per pixel: bars stay ~14px tall in real pixels, names stay ~10px.
  // Without that cap, width: 100% on the SVG scales every dimension
  // (including text) with the container and the whole chart becomes
  // massive on wide screens.
  const rowHeight = 18
  const rowGap = 4
  const leftLabelWidth = 130
  const topPadding = 8
  const bottomPadding = 32   // room for year axis
  const chartWidth = 720
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
      <svg viewBox={`0 0 ${leftLabelWidth + chartWidth + 20} ${totalHeight}`} role="img" aria-label={`Timeline for ${artist.name}`}>
        {/* Member rows: primary bar + optional inner overlay strip for
            simultaneous secondary stints + side-bar segments for stints
            that fall outside the primary tenure. Inner strip is ~45% of
            row height and vertically centered so both colors remain
            readable through it. */}
        {rows.map((row, i) => {
          const y = topPadding + i * (rowHeight + rowGap)
          const overlayHeight = Math.max(6, Math.round(rowHeight * 0.45))
          const overlayY = y + Math.round((rowHeight - overlayHeight) / 2)
          const seg = row.segments
          const rangeLabel = (s: Segment) => `${s.fromYear}${s.toYear !== s.fromYear ? `–${s.toYear}` : ''}`
          return (
            <g key={row.member.id}>
              <text x={leftLabelWidth - 6} y={y + rowHeight * 0.72} textAnchor="end" className="band-timeline-name" style={{ fontSize: 11 }}>
                {row.member.name}
                {row.member.deceased ? ' †' : ''}
              </text>
              {/* Primary bar */}
              {(() => {
                const x = yearToX(seg.primary.fromYear)
                const w = Math.max(1, yearToX(seg.primary.toYear) - x)
                return (
                  <rect x={x} y={y} width={w} height={rowHeight} fill={seg.primary.color} rx={2}>
                    <title>{`${row.member.name} — ${seg.primary.role} (${rangeLabel(seg.primary)})`}</title>
                  </rect>
                )
              })()}
              {/* Disjoint side bars (stints outside the primary span) */}
              {seg.sideBars.map((s, si) => {
                const x = yearToX(s.fromYear)
                const w = Math.max(1, yearToX(s.toYear) - x)
                return (
                  <rect key={`sb${si}`} x={x} y={y} width={w} height={rowHeight} fill={s.color} rx={2}>
                    <title>{`${row.member.name} — ${s.role} (${rangeLabel(s)})`}</title>
                  </rect>
                )
              })}
              {/* Inner overlay strips (simultaneous second roles) */}
              {seg.overlays.map((s, si) => {
                const x = yearToX(s.fromYear)
                const w = Math.max(1, yearToX(s.toYear) - x)
                return (
                  <rect key={`ov${si}`} x={x} y={overlayY} width={w} height={overlayHeight} fill={s.color}>
                    <title>{`${row.member.name} — also ${s.role} (${rangeLabel(s)})`}</title>
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
