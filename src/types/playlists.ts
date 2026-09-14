// Cross-library playlists — ordered lists that can mix items from
// every library (games alongside anime alongside albums), unlike
// Collections which are strictly single-category.
//
// An entry references an item by (categoryId, itemId) so a playlist
// survives library restructuring — if you move an item to a different
// category later, the entry stays consistent because it stores both
// halves of the address.

export interface PlaylistEntry {
  categoryId: string
  itemId: string
  // Optional per-entry note the user attached when adding the item.
  // Kept small on purpose — this isn't a review, it's a "why this made
  // the cut" sentence.
  note?: string
  addedAt: number
}

export interface Playlist {
  id: string
  name: string
  description?: string
  // Optional cover asset path (same convention as items / collections).
  cover?: string
  entries: PlaylistEntry[]
  createdAt: number
  updatedAt?: number
}

// A playlist is empty until the user adds something; UI treats zero
// entries as a valid state (shows the empty hint, not an error).
export function playlistIsEmpty(p: Playlist): boolean {
  return p.entries.length === 0
}

// Add an item at the end. No-op when the exact (categoryId, itemId)
// pair is already in the list — playlists don't hold duplicates.
export function playlistAdd(p: Playlist, categoryId: string, itemId: string, note?: string): Playlist {
  if (p.entries.some((e) => e.categoryId === categoryId && e.itemId === itemId)) return p
  return {
    ...p,
    entries: [...p.entries, { categoryId, itemId, note, addedAt: Date.now() }],
    updatedAt: Date.now(),
  }
}

export function playlistRemove(p: Playlist, categoryId: string, itemId: string): Playlist {
  const entries = p.entries.filter((e) => !(e.categoryId === categoryId && e.itemId === itemId))
  if (entries.length === p.entries.length) return p
  return { ...p, entries, updatedAt: Date.now() }
}

// Reorder an entry from `from` to `to` (both zero-indexed positions
// into the entries array). Out-of-range indices are clamped so a bad
// drop coord can't scramble the list.
export function playlistReorder(p: Playlist, from: number, to: number): Playlist {
  const n = p.entries.length
  if (from < 0 || from >= n) return p
  const target = Math.max(0, Math.min(n - 1, to))
  if (target === from) return p
  const entries = p.entries.slice()
  const [moved] = entries.splice(from, 1)
  entries.splice(target, 0, moved)
  return { ...p, entries, updatedAt: Date.now() }
}
