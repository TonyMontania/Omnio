// Small schematic drawing of each Home widget for the "Add widget" picker,
// so the choice is visual instead of a wall of descriptions. Colours come
// from the theme via the .wp-* classes in home.css.

import type { ReactElement } from 'react'
import { t } from '../i18n'

const W = 160
const H = 90

let keySeq = 0
const k = () => `wp${keySeq++}`

const cover = (x: number, y: number, w = 18, h = 26) => <rect key={k()} className="wp-cover" x={x} y={y} width={w} height={h} rx={2.5} />
const line = (x: number, y: number, w: number, strong = false) => <rect key={k()} className={strong ? 'wp-text' : 'wp-line'} x={x} y={y} width={w} height={strong ? 4 : 3} rx={1.5} />
const accent = (x: number, y: number, w: number, h: number, r = 2) => <rect key={k()} className="wp-accent" x={x} y={y} width={w} height={h} rx={r} />
const bar = (x: number, y: number, w: number, fill: number) => [
  <rect key={k()} className="wp-track" x={x} y={y} width={w} height={3} rx={1.5} />,
  <rect key={k()} className="wp-accent" x={x} y={y} width={w * fill} height={3} rx={1.5} />,
]
const star = (cx: number, cy: number, r = 3.2) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.45
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  return <polygon key={k()} className="wp-accent" points={pts} />
}
const badge = (cx: number, cy: number, r = 4) => <circle key={k()} className="wp-accent" cx={cx} cy={cy} r={r} />
const coverRow = (y: number, n: number, w = 18, h = 26, gap = 6, x0 = 12) => Array.from({ length: n }, (_, i) => cover(x0 + i * (w + gap), y, w, h))

const DRAWINGS: Record<string, () => ReactElement[]> = {
  currently: () => [0, 1, 2].flatMap((i) => {
    const y = 10 + i * 25
    return [cover(12, y, 14, 20), line(32, y + 3, 64 - i * 12, true), line(32, y + 10, 40), ...bar(32, y + 16, 110, [0.7, 0.4, 0.85][i])]
  }),
  upcoming: () => [0, 1, 2].flatMap((i) => {
    const y = 10 + i * 25
    return [accent(12, y, 20, 20, 3), <text key={k()} className="wp-on-accent" x={22} y={y + 14} textAnchor="middle">{[3, 12, 27][i]}</text>, line(40, y + 4, 70 - i * 10, true), line(40, y + 12, 44)]
  }),
  'recently-rated': () => coverRow(14, 5, 22, 32).concat([0, 1, 2, 3, 4].flatMap((i) => [star(17 + i * 28, 56), star(25 + i * 28, 56)])),
  'pick-from-backlog': () => [
    <rect key={k()} className="wp-cover" x={46} y={16} width={30} height={44} rx={3} transform="rotate(-10 61 38)" />,
    <rect key={k()} className="wp-cover" x={84} y={16} width={30} height={44} rx={3} transform="rotate(10 99 38)" />,
    <rect key={k()} className="wp-cover-strong" x={65} y={12} width={30} height={44} rx={3} />,
    accent(58, 68, 44, 10, 5),
  ],
  'weekly-airing': () => Array.from({ length: 7 }, (_, i) => {
    const x = 10 + i * 20.5
    const items = [cover(x, 22, 17, 24)]
    if (i % 2 === 0) items.push(cover(x, 50, 17, 24))
    return [i === 2 ? accent(x, 10, 17, 6, 3) : <rect key={k()} className="wp-track" x={x} y={10} width={17} height={6} rx={3} />, ...items]
  }).flat(),
  'continue-watching': () => [0, 1, 2].flatMap((i) => {
    const x = 10 + i * 48
    return [cover(x, 12, 42, 40), line(x, 58, 30, true), ...bar(x, 68, 42, [0.6, 0.3, 0.8][i])]
  }),
  'recently-added': () => coverRow(18, 5, 22, 32).concat([0, 1, 2].flatMap((i) => [
    accent(10 + i * 28, 14, 18, 8, 2),
    <text key={k()} className="wp-on-accent wp-tiny" x={19 + i * 28} y={20} textAnchor="middle">{t('NEW')}</text>,
  ])).concat([line(12, 60, 60, true)]),
  pinned: () => coverRow(22, 5, 22, 32).concat([0, 1, 2, 3, 4].flatMap((i) => [
    <line key={k()} className="wp-accent-stroke" x1={23 + i * 28} y1={18} x2={23 + i * 28} y2={27} />,
    badge(23 + i * 28, 16, 4),
  ])),
  'shmup-1cc': () => [0, 1, 2].flatMap((i) => {
    const y = 12 + i * 24
    return [badge(20, y + 8, 7), <text key={k()} className="wp-on-accent" x={20} y={y + 11} textAnchor="middle">1</text>, line(34, y + 3, 60 - i * 8, true), line(34, y + 11, 90), ]
  }),
  'big-numbers': () => [0, 1, 2, 3].flatMap((i) => {
    const x = 10 + (i % 2) * 72
    const y = 10 + Math.floor(i / 2) * 38
    return [<rect key={k()} className="wp-tile" x={x} y={y} width={66} height={32} rx={4} />, accent(x + 8, y + 8, [30, 24, 18, 36][i], 9, 2), line(x + 8, y + 22, 40)]
  }),
  'upcoming-week': () => [
    <rect key={k()} className="wp-track" x={12} y={44} width={136} height={2} rx={1} />,
    ...Array.from({ length: 7 }, (_, i) => <circle key={k()} className={i === 1 || i === 4 ? 'wp-accent' : 'wp-dot'} cx={14 + i * 22} cy={45} r={3} />),
    cover(28, 12, 16, 24), cover(94, 12, 16, 24), cover(116, 54, 16, 24), line(12, 62, 36),
  ],
  'currently-airing': () => coverRow(18, 5, 22, 32).concat([0, 1, 2, 3, 4].flatMap((i) => [
    <circle key={k()} className="wp-live" cx={16 + i * 28} cy={22} r={2.5} />,
    line(12 + i * 28, 56, 18),
  ])),
  'cover-carousel': () => [
    ...Array.from({ length: 7 }, (_, i) => cover(-10 + i * 26, 16, 22, 34)),
    <path key={k()} className="wp-accent-stroke" d="M60 66 h40 m-6 -5 l6 5 l-6 5" fill="none" />,
  ],
  'on-this-day': () => [
    <rect key={k()} className="wp-tile" x={12} y={14} width={40} height={46} rx={4} />,
    accent(12, 14, 40, 11, 4),
    <text key={k()} className="wp-big" x={32} y={52} textAnchor="middle">16</text>,
    cover(64, 18, 22, 32), cover(92, 18, 22, 32), cover(120, 18, 22, 32),
    line(64, 58, 50),
  ],
  'rating-spread': () => [0, 1, 2, 3, 4].flatMap((i) => {
    const y = 10 + i * 15
    return [star(16, y + 4), line(24, y + 2, 8), accent(38, y, [96, 70, 40, 16, 8][i], 8, 2)]
  }),
  'finished-this-week': () => coverRow(18, 5, 22, 32).concat([0, 1, 2, 3, 4].flatMap((i) => [
    badge(31 + i * 28, 46, 5),
    <path key={k()} className="wp-check" d={`M${28.5 + i * 28} 46 l2 2 l3.5 -3.5`} fill="none" />,
  ])).concat([line(12, 62, 50, true)]),
  'top-of-year': () => [
    cover(66, 10, 28, 40), cover(30, 20, 26, 36), cover(104, 26, 24, 32),
    accent(66, 54, 28, 26, 2), <rect key={k()} className="wp-tile" x={30} y={60} width={26} height={20} rx={2} />, <rect key={k()} className="wp-tile" x={104} y={62} width={24} height={18} rx={2} />,
    <text key={k()} className="wp-on-accent" x={80} y={71} textAnchor="middle">1</text>,
  ],
  'random-favorites': () => coverRow(16, 5, 22, 32).concat([0, 1, 2, 3, 4].map((i) => (
    <path key={k()} className="wp-accent" d={`M${23 + i * 28} 60 c-3 -3 -6 -1 -6 1.5 c0 2.5 3.5 4.5 6 6.5 c2.5 -2 6 -4 6 -6.5 c0 -2.5 -3 -4.5 -6 -1.5 z`} />
  ))),
  'genre-spotlight': () => [0, 1, 2].flatMap((i) => {
    const y = 10 + i * 25
    return [accent(12, y + 6, 30 - i * 4, 8, 4), ...coverRow(y, 5, 14, 20, 4, 52)]
  }),
}

export default function WidgetPreview({ id }: { id: string }) {
  keySeq = 0
  const draw = DRAWINGS[id]
  return (
    <svg className="wp" viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden preserveAspectRatio="xMidYMid meet">
      {draw ? draw() : [line(40, 40, 80, true), line(52, 50, 56)]}
    </svg>
  )
}
