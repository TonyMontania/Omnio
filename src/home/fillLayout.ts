export interface FillLayoutInput {
  width: number
  available: number
  minWidth: number
  gap: number
  rows: number
  stretch: boolean
}

// How many columns fit and how many cards to show so a widget's card grid
// only ever shows complete rows. When fewer cards than one row exist,
// `stretch` widens them to span the full width instead of leaving a gap.
export function fillLayout({ width, available, minWidth, gap, rows, stretch }: FillLayoutInput): { columns: number; count: number } {
  const fit = Math.max(1, Math.floor((width + gap) / (minWidth + gap)))
  let count = Math.min(available, fit * rows)
  if (count > fit) count -= count % fit
  const columns = count < fit && stretch ? Math.max(count, 1) : fit
  return { columns, count }
}
