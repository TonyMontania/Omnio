import type { AnyItem, VisualNovelStatus } from '../types'

export interface VndbListEntry {
  id: string
  vote?: number | null
  started?: string | null
  finished?: string | null
  labels?: { id: number; label: string }[]
  vn?: {
    title?: string
    alttitle?: string | null
    released?: string | null
    length_minutes?: number | null
    image?: { url?: string } | null
    developers?: { name: string }[]
  }
}

// VNDB's built-in labels: 1 Playing, 2 Finished, 3 Stalled, 4 Dropped,
// 5 Wishlist, 6 Blacklist, 7 Voted. Custom labels (id ≥ 10) are ignored.
const LABEL_STATUS: Record<number, VisualNovelStatus> = {
  1: 'playing', 2: 'completed', 3: 'paused', 4: 'dropped', 5: 'plan_to_play',
}
const STATUS_PRIORITY: VisualNovelStatus[] = ['completed', 'playing', 'paused', 'dropped', 'plan_to_play']

export function isBlacklisted(entry: VndbListEntry): boolean {
  return (entry.labels ?? []).some((l) => l.id === 6)
}

export function statusFromLabels(entry: VndbListEntry): VisualNovelStatus {
  const found = new Set((entry.labels ?? []).map((l) => LABEL_STATUS[l.id]).filter(Boolean))
  const status = STATUS_PRIORITY.find((s) => found.has(s))
  if (status) return status
  return entry.vote ? 'completed' : 'plan_to_play'
}

// VNDB votes are 10–100; Omnio rates 0–5 in half stars.
export function ratingFromVote(vote?: number | null): number | undefined {
  if (!vote) return undefined
  return Math.round(vote / 10) / 2
}

export function vndbEntryFields(entry: VndbListEntry): Partial<AnyItem> {
  const vn = entry.vn ?? {}
  const hours = vn.length_minutes ? Math.round((vn.length_minutes / 60) * 10) / 10 : undefined
  const fields: Partial<AnyItem> = {
    vndbId: entry.id,
    visualNovelStatus: statusFromLabels(entry),
    rating: ratingFromVote(entry.vote),
    startDate: entry.started ?? undefined,
    finishedAt: entry.finished ?? undefined,
    releaseDate: vn.released && /^\d{4}-\d{2}-\d{2}$/.test(vn.released) ? vn.released : undefined,
    vnLengthHours: hours ? String(hours) : undefined,
    devs: vn.developers?.map((d) => d.name),
    vnAliases: vn.alttitle ? [vn.alttitle] : undefined,
  }
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)))
}

export interface VndbImportPlan {
  updates: Map<string, Partial<AnyItem>>
  creates: AnyItem[]
  skipped: number
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '')

// Existing VNs are matched by VNDB id, then by title. Matches only get
// the list's own data (status, vote, dates); everything else is kept.
export function planVndbImport(entries: VndbListEntry[], existing: AnyItem[], now = Date.now()): VndbImportPlan {
  const vns = existing.filter((i) => i.categoryId === 'visual_novels')
  const byId = new Map(vns.filter((i) => i.vndbId).map((i) => [i.vndbId!, i]))
  const byTitle = new Map(vns.map((i) => [norm(i.title), i]))
  const plan: VndbImportPlan = { updates: new Map(), creates: [], skipped: 0 }
  entries.forEach((entry, idx) => {
    if (isBlacklisted(entry) || !entry.vn?.title) { plan.skipped++; return }
    const fields = vndbEntryFields(entry)
    const match = byId.get(entry.id) ?? byTitle.get(norm(entry.vn.title))
    if (match) {
      const { visualNovelStatus, rating, startDate, finishedAt } = fields
      const personal = Object.fromEntries(Object.entries({ vndbId: entry.id, visualNovelStatus, rating, startDate, finishedAt }).filter(([, v]) => v !== undefined))
      plan.updates.set(match.id, personal)
      return
    }
    plan.creates.push({
      ...fields,
      id: crypto.randomUUID(),
      categoryId: 'visual_novels',
      title: entry.vn.title,
      cover: entry.vn.image?.url ?? undefined,
      createdAt: now + idx,
    } as AnyItem)
  })
  return plan
}
