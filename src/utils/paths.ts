// Tiny path helpers that don't need a full backend round-trip.
// Kept off the Rust side so quick UI needs (remember the folder we
// just saved into) don't pay for an IPC hop.

// Directory portion of a full file path. Works with both forward
// and backward slashes and prefers the separator the input uses.
// Returns undefined when the path has no separators (a bare filename).
export function parentOf(fullPath: string): string | undefined {
  const idx = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'))
  if (idx <= 0) return undefined
  return fullPath.slice(0, idx)
}
