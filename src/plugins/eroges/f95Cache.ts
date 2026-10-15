// Version checks through F95Checker's public cache (api.f95checker.dev),
// used the same way F95Checker itself does: `/fast` in batches of ten to
// learn which threads changed, then `/full` only for those. The cache
// keeps working when F95Zone puts a browser challenge in front of its
// own pages.

import { fetchText } from './ipc'
import { F95_ENGINE, F95_STATUS, F95_TAGS } from './f95Codes'

const API = 'https://api.f95checker.dev'
const HEADERS = { 'User-Agent': 'Omnio (+https://github.com/TonyMontania/Omnio)', 'Accept': 'application/json' }
const FAST_MAX_IDS = 10

export interface CachedThread {
  name: string
  version: string
  creator: string
  engine: string
  status: string
  tags: string[]
  description: string
  coverUrl: string
  threadUpdated: string
  vn: boolean
}

const asNumber = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function parseTagIds(v: unknown): number[] {
  if (Array.isArray(v)) return v.map(asNumber)
  try {
    const parsed = JSON.parse(String(v ?? '[]'))
    return Array.isArray(parsed) ? parsed.map(asNumber) : []
  } catch {
    return []
  }
}

export function cachedThreadFrom(raw: Record<string, unknown>): CachedThread | null {
  if (raw.INDEX_ERROR) return null
  const tags = parseTagIds(raw.tags).map((id) => F95_TAGS[id]).filter((t): t is string => !!t)
  const updated = asNumber(raw.last_updated)
  return {
    name: String(raw.name ?? ''),
    version: String(raw.version ?? ''),
    creator: String(raw.developer ?? ''),
    engine: F95_ENGINE[asNumber(raw.type)] ?? '',
    status: F95_STATUS[asNumber(raw.status)] ?? '',
    tags,
    description: String(raw.description ?? ''),
    coverUrl: String(raw.image_url ?? ''),
    threadUpdated: updated > 0 ? new Date(updated * 1000).toISOString().slice(0, 10) : '',
    vn: tags.includes('visual novel'),
  }
}

// When each thread last changed in the cache (unix seconds).
export async function cachedLastChanges(threadIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  const unique = Array.from(new Set(threadIds))
  for (let i = 0; i < unique.length; i += FAST_MAX_IDS) {
    const chunk = unique.slice(i, i + FAST_MAX_IDS)
    const body = JSON.parse(await fetchText(`${API}/fast?ids=${chunk.join(',')}`, HEADERS)) as Record<string, unknown>
    for (const [id, ts] of Object.entries(body)) out.set(Number(id), asNumber(ts))
  }
  return out
}

// Full thread data. `lastChange` comes from `cachedLastChanges` and keeps
// the response cacheable; it must never be in the future.
export async function cachedThread(threadId: number, lastChange = Math.floor(Date.now() / 1000) - 60): Promise<CachedThread | null> {
  try {
    const raw = JSON.parse(await fetchText(`${API}/full/${threadId}?ts=${lastChange}`, HEADERS)) as Record<string, unknown>
    return cachedThreadFrom(raw)
  } catch (err) {
    if (/HTTP 404/.test((err as Error).message)) return null
    throw err
  }
}

export interface VersionPatch {
  latestVersion?: string
  updateAvailable: boolean
  status?: string
  threadUpdated?: string
  lastCheckedAt: number
  f95LastChange?: number
  tags?: string[]
}

const normVersion = (v: string) => v.replace(/\s+/g, '').toLowerCase()

export function isNewerVersion(latest: string | undefined, installed: string | undefined): boolean {
  return !!latest && !!installed && normVersion(latest) !== normVersion(installed)
}

export function versionPatchFrom(
  game: { version?: string; latestVersion?: string; status?: string; threadUpdated?: string; tags?: string[] },
  thread: CachedThread,
  lastChange: number,
  now = Date.now(),
): VersionPatch {
  return {
    latestVersion: thread.version || game.latestVersion,
    updateAvailable: isNewerVersion(thread.version, game.version),
    status: thread.status || game.status,
    threadUpdated: thread.threadUpdated || game.threadUpdated,
    lastCheckedAt: now,
    f95LastChange: lastChange,
    tags: thread.tags.length > 0 ? thread.tags : game.tags,
  }
}
