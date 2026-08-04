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
