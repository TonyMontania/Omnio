// Plugin count bus — a plugin reports "I have N items" for the
// sidebar badge without needing App state as a prop.
// The App subscribes at boot; each plugin's <View/> calls
// `reportPluginCount(slug, n)` inside a `useEffect`.

type Listener = (counts: Record<string, number>) => void

const counts: Record<string, number> = {}
const listeners = new Set<Listener>()

export function reportPluginCount(slug: string, n: number): void {
  if (counts[slug] === n) return
  counts[slug] = n
  for (const l of listeners) l({ ...counts })
}

export function subscribePluginCounts(l: Listener): () => void {
  listeners.add(l)
  l({ ...counts })
  return () => { listeners.delete(l) }
}
