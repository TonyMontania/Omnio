// Tiny formatting helpers shared across editors / detail modals so the
// next component that wants to show a file size or a friendly date
// doesn't reinvent them (SaveFilesEditor originally inlined both).

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

// Format a `YYYY-MM-DD` string without letting the timezone shift the day.
// `new Date("2009-04-28")` parses as UTC midnight, which in any TZ west of
// UTC toLocaleDateString()s as the *previous* day (e.g. "4/27/2009" in
// America/*). Parsing the components manually and passing (y, m-1, d) to
// the Date constructor builds a local-midnight date instead, so what the
// user typed in the picker is what the detail view shows.
export function formatIsoDate(iso: string | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) {
    const fallback = new Date(iso)
    return Number.isNaN(fallback.getTime()) ? iso : fallback.toLocaleDateString()
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString()
}
