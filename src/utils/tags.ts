// Helpers for the optional tag hierarchy. `tagTree` maps child → parent.
// A tag with no entry in the map is top-level. Cycles are tolerated: the
// walk uses a visited set so a bad map still terminates instead of
// exploding the filter path.

export type TagTree = Record<string, string>

// Expand a set of selected tags to include every descendant. Selecting a
// parent in the filter dropdown should match every item tagged with any
// descendant, so we build the reverse map (parent → children) once and
// walk it breadth-first.
export function expandTagSelection(selected: string[], tree?: TagTree): string[] {
  if (!tree || Object.keys(tree).length === 0) return selected
  const children: Record<string, string[]> = {}
  for (const [child, parent] of Object.entries(tree)) {
    if (!parent) continue
    if (!children[parent]) children[parent] = []
    children[parent].push(child)
  }
  const out = new Set<string>()
  const stack = [...selected]
  while (stack.length) {
    const t = stack.pop() as string
    if (out.has(t)) continue
    out.add(t)
    const kids = children[t]
    if (kids) for (const k of kids) if (!out.has(k)) stack.push(k)
  }
  return Array.from(out)
}

// Build a nested display order: top-level tags first, each followed by
// its subtree (depth-first). Used by the filter dropdown to render an
// indented list without any recursive JSX. Returns { tag, depth } rows.
export function flattenTagTree(allTags: string[], tree?: TagTree): { tag: string; depth: number }[] {
  const known = new Set(allTags)
  const parentOf = tree ?? {}
  const children: Record<string, string[]> = {}
  for (const [child, parent] of Object.entries(parentOf)) {
    if (!parent || !known.has(child) || !known.has(parent)) continue
    if (!children[parent]) children[parent] = []
    children[parent].push(child)
  }
  for (const list of Object.values(children)) list.sort((a, b) => a.localeCompare(b))
  const roots = allTags
    .filter((t) => {
      const p = parentOf[t]
      return !p || !known.has(p)
    })
    .sort((a, b) => a.localeCompare(b))
  const rows: { tag: string; depth: number }[] = []
  const visited = new Set<string>()
  const walk = (tag: string, depth: number) => {
    if (visited.has(tag)) return
    visited.add(tag)
    rows.push({ tag, depth })
    const kids = children[tag]
    if (kids) for (const k of kids) walk(k, depth + 1)
  }
  for (const r of roots) walk(r, 0)
  // Anything the tree didn't reach (orphan cycles) still needs to show.
  for (const t of allTags) if (!visited.has(t)) rows.push({ tag: t, depth: 0 })
  return rows
}
