// Width of a "#" table column that fits its longest number (two digits
// at least), so track / episode numbers never get clipped.
export function numColumnWidth(values: (string | number | undefined)[]): number {
  const longest = values.reduce<number>((max, v) => Math.max(max, String(v ?? '').trim().length), 2)
  return longest * 9 + 34
}
