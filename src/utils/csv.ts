// Shared CSV parsing + column-header helpers used by GenericImporter,
// LetterboxdImporter, LastfmImporter (and any future CSV importer).
// Handles: BOM stripping, quoted fields with embedded commas / quotes /
// newlines. Delimiter defaults to comma; pass '\t' for TSV.

export function parseCsv(input: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  const stripped = input.charCodeAt(0) === 0xFEFF ? input.slice(1) : input
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (inQuotes) {
      if (ch === '"') {
        if (stripped[i + 1] === '"') { field += '"'; i++ }
        else { inQuotes = false }
      } else { field += ch }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === delimiter) { cur.push(field); field = '' }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else field += ch
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }
  return rows.filter((r) => r.some((f) => f.length > 0))
}

// Column-index by header name (case-insensitive, whitespace-normalized).
// Returns -1 when the column isn't present. Accepts synonyms so callers
// can support minor exporter variations in one call.
export function colIndex(headers: string[], ...names: string[]): number {
  for (const n of names) {
    const target = n.trim().toLowerCase()
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === target)
    if (idx >= 0) return idx
  }
  return -1
}

// Escape one CSV cell. Quotes only when the value contains a comma,
// quote, or newline (RFC 4180). Empty / undefined → empty cell.
function csvCell(v: unknown): string {
  if (v === undefined || v === null) return ''
  const s = Array.isArray(v) ? v.join('; ') : String(v)
  if (s === '') return ''
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

// Turn a list of rows (each row an object) into a CSV string. Headers
// come from the union of all keys in the input, preserving first-seen
// order — deterministic across runs when the caller feeds objects with
// the same shape (which we always do, from a schema-known row builder).
export function buildCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const seen = new Set<string>()
  const headers: string[] = []
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) { seen.add(k); headers.push(k) }
    }
  }
  const lines: string[] = [headers.map(csvCell).join(',')]
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','))
  // CRLF matches Excel's expectation on Windows and is harmless elsewhere.
  return lines.join('\r\n') + '\r\n'
}
