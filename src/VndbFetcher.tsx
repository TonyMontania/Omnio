// VNDB fetcher for Visual Novels. Two POSTs — /kana/vn for the main
// metadata, /kana/release for the per-release edition gallery (VNDB
// stores publishers per-release, not per-VN).

import type {
  Item, VnLength, VnStaffMember, VnStaffRole, VnCharacter, VnCharacterRole,
  VnCover, VnEdition, VnPublisher, VnScreenshot, VnDevStatus,
} from './types'
import { FetcherModal, type FetcherResult } from './components/FetcherModal'
import { assetBasename, downloadImageAsset } from './utils/files'

interface Props {
  initialQuery: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string, hints?: { vnRelations?: { vndbId: string; relation: string; title: string }[] }) => void
  onClose: () => void
}

// Mirrors VNDB_VN_FIELDS in src-tauri/src/handlers/fetchers.rs.
interface VndbVnHit {
  id: string
  title: string
  alttitle?: string
  aliases?: string[]
  description?: string               // BBCode-flavored
  released?: string
  olang?: string
  languages?: string[]
  platforms?: string[]
  length?: 1 | 2 | 3 | 4 | 5
  length_minutes?: number
  length_votes?: number
  devstatus?: 0 | 1 | 2               // 0 finished, 1 in dev, 2 cancelled
  rating?: number                     // /100
  votecount?: number
  image?: { url?: string; sexual?: number; violence?: number }
  tags?: { name: string; category: 'cont' | 'ero' | 'tech'; spoiler: 0 | 1 | 2; rating: number }[]
  screenshots?: { url: string; sexual?: number; violence?: number; thumbnail?: string }[]
  developers?: { name: string; original?: string }[]
  editions?: { eid?: number; lang?: string; name: string; official?: boolean }[]
  staff?: { name: string; original?: string; role: string; note?: string }[]
  va?: {
    note?: string
    character: { id?: string; name: string; original?: string; description?: string; image?: { url?: string } }
    staff: { name: string; original?: string }
  }[]
  relations?: { id: string; title: string; relation: string }[]
}

interface VndbCharacterHit {
  id: string
  name: string
  original?: string
  description?: string
  gender?: string
  image?: { url?: string; sexual?: number; violence?: number }
  vns?: { id: string; role: string }[]  // vns this character appears in with per-VN role
}

// Shape matches VNDB_RELEASE_FIELDS. Note `images` is plural — VNDB's
// /release exposes a typed image array (box front, back, disc, digital
// cover), unlike /vn which returns a single `image`.
interface VndbReleaseImage {
  url: string
  type?: 'pkgfront' | 'pkgmed' | 'pkgback' | 'pkgcontent' | 'dig' | string
  languages?: string[] | null
  sexual?: number
  violence?: number
}
interface VndbReleaseHit {
  id: string
  title: string
  alttitle?: string
  released?: string
  official?: boolean
  patch?: boolean
  engine?: string | null
  languages?: { lang: string; main?: boolean; mtl?: boolean }[]
  platforms?: string[]
  images?: VndbReleaseImage[]
  producers?: { id: string; name: string; original?: string; developer?: boolean; publisher?: boolean }[]
}

const LENGTH_MAP: Record<number, VnLength> = {
  1: 'very_short', 2: 'short', 3: 'medium', 4: 'long', 5: 'very_long',
}

const DEVSTATUS_MAP: Record<number, VnDevStatus> = {
  0: 'finished', 1: 'in_development', 2: 'cancelled',
}

function stripBBCode(v?: string): string | undefined {
  if (!v) return undefined
  return v
    .replace(/\[url=[^\]]*\]/gi, '').replace(/\[\/url\]/gi, '')
    .replace(/\[spoiler\][\s\S]*?\[\/spoiler\]/gi, '(spoiler)')
    .replace(/\[[^\]]+\]/g, '')
    .trim()
}

// Keep non-spoiler content-category tags with a decent community score.
// Categories: cont(ent) / ero(tic) / tech(nical). Spoiler tier: 0/1/2.
function pickTags(hit: VndbVnHit): string[] {
  const raw = hit.tags ?? []
  return raw
    .filter((t) => t.category === 'cont' && t.spoiler === 0 && t.rating >= 2)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 12)
    .map((t) => t.name)
}

function mapStaffRole(role: string): VnStaffRole {
  const r = role.toLowerCase()
  if (r === 'scenario' || r === 'writer') return 'writer'
  if (r === 'art' || r === 'chardesign' || r === 'artist') return 'artist'
  if (r === 'music' || r === 'songs' || r === 'composer') return 'composer'
  if (r === 'director') return 'director'
  if (r === 'translator') return 'translator'
  return 'other'
}

function toStaff(hit: VndbVnHit): VnStaffMember[] {
  const raw = hit.staff ?? []
  // role="staff" is VNDB's "credited but no specific job" catch-all;
  // those entries usually duplicate a proper credit elsewhere.
  const filtered = raw.filter((s) => s.role.toLowerCase() !== 'staff')
  const seen = new Set<string>()
  const out: VnStaffMember[] = []
  for (const s of filtered) {
    const key = `${s.name}|${s.role}|${s.note ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: crypto.randomUUID(),
      name: s.name,
      original: s.original,
      role: mapStaffRole(s.role),
      note: s.note,
    })
  }
  return out
}

// VNDB's "main" is the protagonist, "primary" is a main heroine.
function mapCharRole(role?: string): VnCharacterRole {
  if (role === 'main') return 'protagonist'
  if (role === 'primary') return 'main'
  if (role === 'side') return 'side'
  if (role === 'appears') return 'appears'
  return 'main'
}

function toCharacters(vnHit: VndbVnHit, characters: VndbCharacterHit[]): VnCharacter[] {
  // Multi-VA characters (age variants, route splits) keep the first
  // entry as the headline seiyuu.
  const vaByChar = new Map<string, { staff: string; note?: string }>()
  for (const v of vnHit.va ?? []) {
    if (!v.character?.id) continue
    if (vaByChar.has(v.character.id)) continue
    vaByChar.set(v.character.id, { staff: v.staff?.name ?? '', note: v.note })
  }

  return characters.map((c) => {
    const rel = (c.vns ?? []).find((v) => v.id === vnHit.id)
    const va = vaByChar.get(c.id)
    return {
      id: crypto.randomUUID(),
      name: c.name,
      original: c.original,
      description: stripBBCode(c.description),
      role: mapCharRole(rel?.role),
      seiyuu: va?.staff || undefined,
      seiyuuNote: va?.note,
      vndbId: c.id,
    }
  })
}

function toEditions(hit: VndbVnHit): VnEdition[] {
  return (hit.editions ?? []).map((e) => ({
    id: crypto.randomUUID(),
    eid: e.eid,
    lang: e.lang,
    name: e.name,
    official: e.official,
  }))
}

// Unique (publisher, language) rows. A producer can be both dev and
// publisher on a release; track that as `role` = 'both'.
function toPublishers(releases: VndbReleaseHit[]): VnPublisher[] {
  const seen = new Map<string, VnPublisher>()
  for (const rel of releases) {
    const langs = (rel.languages ?? []).map((l) => l.lang)
    for (const p of rel.producers ?? []) {
      if (!p.publisher && !p.developer) continue
      const role: VnPublisher['role'] = p.publisher && p.developer ? 'both' : p.publisher ? 'publisher' : 'developer'
      for (const lang of langs) {
        const key = `${p.id}:${lang}`
        if (seen.has(key)) continue
        seen.set(key, {
          id: crypto.randomUUID(),
          name: p.name,
          original: p.original,
          lang,
          role,
        })
      }
    }
  }
  return Array.from(seen.values())
}

// One entry per unique cover URL across every release. Keeps the front
// package art (`pkgfront`) and digital covers (`dig`) — those are what
// end-users think of as "the cover"; discs, back covers and inserts stay
// out. No cap: the user can prune from the editor if a VN has 40
// international releases and they only want a subset.
function pickReleaseCovers(releases: VndbReleaseHit[]): { url: string; lang?: string; releaseTitle: string }[] {
  const bucket: { url: string; lang?: string; releaseTitle: string }[] = []
  const seenUrl = new Set<string>()
  for (const rel of releases) {
    for (const img of rel.images ?? []) {
      const url = img.url
      if (!url || seenUrl.has(url)) continue
      const t = img.type ?? ''
      // Skip disc art, back covers, inserts — noise for a cover gallery.
      if (t === 'pkgmed' || t === 'pkgback' || t === 'pkgcontent') continue
      seenUrl.add(url)
      bucket.push({
        url,
        lang: img.languages?.[0] ?? rel.languages?.[0]?.lang,
        releaseTitle: rel.title,
      })
    }
  }
  return bucket
}

// VNDB stores engine per-release, not per-VN. Pick the most-common
// non-null engine across every official release so re-releases on the
// same engine dominate over one-off ports.
function pickEngine(releases: VndbReleaseHit[]): string | undefined {
  const counts = new Map<string, number>()
  for (const r of releases) {
    if (!r.engine || r.patch) continue
    counts.set(r.engine, (counts.get(r.engine) ?? 0) + 1)
  }
  let best: string | undefined
  let bestCount = 0
  for (const [name, n] of counts) {
    if (n > bestCount) { best = name; bestCount = n }
  }
  return best
}

async function downloadCovers(
  vnTitle: string,
  mainCoverUrl: string | null,
  releases: VndbReleaseHit[],
): Promise<{ mainCoverPath?: string; covers: VnCover[] }> {
  const covers: VnCover[] = []
  let mainPath: string | undefined
  const seen = new Set<string>()

  // Main cover first — it's the one VNDB thinks is the canonical one for
  // the VN as a whole.
  if (mainCoverUrl) {
    const p = await downloadImageAsset(mainCoverUrl, 'visual_novels', 'cover', assetBasename(vnTitle, 'cover'))
    if (p) {
      mainPath = p
      seen.add(mainCoverUrl)
      covers.push({
        id: crypto.randomUUID(),
        path: p,
        main: true,
        exhibited: true,
        releaseTitle: 'Main cover',
      })
    }
  }

  // Then the per-release covers, skipping URLs already grabbed.
  const releaseCovers = pickReleaseCovers(releases)
  for (const rc of releaseCovers) {
    if (seen.has(rc.url)) continue
    seen.add(rc.url)
    const p = await downloadImageAsset(
      rc.url,
      'visual_novels',
      'cover',
      assetBasename(vnTitle, 'cover', covers.length + 1),
    )
    if (!p) continue
    covers.push({
      id: crypto.randomUUID(),
      path: p,
      lang: rc.lang,
      releaseTitle: rc.releaseTitle,
      exhibited: true,
    })
  }

  return { mainCoverPath: mainPath, covers }
}

async function downloadScreenshots(vnTitle: string, hit: VndbVnHit): Promise<VnScreenshot[]> {
  const raw = (hit.screenshots ?? []).slice(0, 8)
  const out: VnScreenshot[] = []
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i]
    const p = await downloadImageAsset(
      s.url,
      'visual_novels',
      'screenshot',
      assetBasename(vnTitle, 'screen', i + 1),
    )
    if (!p) continue
    out.push({
      id: crypto.randomUUID(),
      filename: p.split(/[\\/]/).pop() ?? p,
      path: p,
      addedAt: new Date().toISOString(),
      nsfw: (s.sexual ?? 0) >= 1 || (s.violence ?? 0) >= 2,
    })
  }
  return out
}

async function downloadCharacterImages(
  vnTitle: string,
  characters: VnCharacter[],
  charHits: VndbCharacterHit[],
): Promise<VnCharacter[]> {
  // Build a url map keyed by VNDB character id (each VnCharacter carries
  // vndbId now, matching the id returned by /character).
  const urls = new Map<string, string>()
  for (const c of charHits) {
    const u = c.image?.url
    if (u) urls.set(c.id, u)
  }
  const enriched: VnCharacter[] = []
  for (let i = 0; i < characters.length; i++) {
    const c = characters[i]
    const url = c.vndbId ? urls.get(c.vndbId) : undefined
    if (!url) { enriched.push(c); continue }
    const p = await downloadImageAsset(
      url,
      'visual_novels',
      'character',
      assetBasename(vnTitle, 'char', i + 1),
    )
    enriched.push({ ...c, image: p ?? undefined })
  }
  return enriched
}

export default function VndbFetcher({ initialQuery, onApply, onClose }: Props) {
  const search = async (q: string): Promise<FetcherResult<VndbVnHit>> => {
    const r = await window.ipcRenderer.invoke('vndb:search', q)
    return r?.ok ? { ok: true, data: r.data as VndbVnHit[] } : { ok: false, error: r?.error ?? 'Search failed' }
  }

  const apply = async (h: VndbVnHit) => {
    // Two extra calls: /release for publishers + multi-cover, /character
    // for full character metadata (image, description, gender, per-VN
    // role). Both fire in parallel with each other and with the VN hit
    // we already have.
    const [rr, cr] = await Promise.all([
      window.ipcRenderer.invoke('vndb:releases', h.id),
      window.ipcRenderer.invoke('vndb:characters', h.id),
    ])
    const releases: VndbReleaseHit[] = rr?.ok ? (rr.data as VndbReleaseHit[]) : []
    const charHits: VndbCharacterHit[] = cr?.ok ? (cr.data as VndbCharacterHit[]) : []

    const { mainCoverPath, covers } = await downloadCovers(h.title, h.image?.url ?? null, releases)
    const staff = toStaff(h)
    let characters = toCharacters(h, charHits)
    characters = await downloadCharacterImages(h.title, characters, charHits)
    const editions = toEditions(h)
    const publishers = toPublishers(releases)
    const tags = pickTags(h)
    const screenshots = await downloadScreenshots(h.title, h)
    const nsfw = (h.image?.sexual ?? 0) >= 1 || (h.image?.violence ?? 0) >= 2

    // Populate the manual publishers list too, so users who just look at
    // that field (instead of the per-region grid below it) still see
    // something. Deduped by name; developers-only rows skip so the manual
    // list stays as "publishers".
    const uniquePublisherNames = Array.from(new Set(
      publishers.filter((p) => p.role !== 'developer').map((p) => p.name),
    ))

    const patch: Partial<Item> = {
      title: h.title,
      vnDescription: stripBBCode(h.description),
      releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(h.released ?? '') ? h.released : undefined,
      releaseYear: h.released && /^\d{4}/.test(h.released) ? h.released.slice(0, 4) : undefined,
      devs: h.developers?.map((d) => d.name),
      publishers: uniquePublisherNames.length > 0 ? uniquePublisherNames : undefined,
      platforms: h.platforms,
      vnLanguages: h.languages,
      vnOriginalLanguage: h.olang,
      vnAliases: [h.alttitle, ...(h.aliases ?? [])].filter((v): v is string => !!v && v !== h.title),
      vnLength: h.length ? LENGTH_MAP[h.length] : undefined,
      vnLengthHours: h.length_minutes ? (h.length_minutes / 60).toFixed(1) : undefined,
      vnEngine: pickEngine(releases),
      vnDevStatus: h.devstatus !== undefined ? DEVSTATUS_MAP[h.devstatus] : undefined,
      vnCommunityRating: h.rating ? (h.rating / 10).toFixed(2) : undefined,
      vnStaff: staff.length > 0 ? staff : undefined,
      vnCharacters: characters.length > 0 ? characters : undefined,
      vnEditions: editions.length > 0 ? editions : undefined,
      vnPublishers: publishers.length > 0 ? publishers : undefined,
      vnScreenshots: screenshots.length > 0 ? screenshots : undefined,
      vnCovers: covers.length > 0 ? covers : undefined,
      tags: tags.length > 0 ? tags : undefined,
      vndbId: h.id,
      nsfw,
    }
    const vnRelations = (h.relations ?? []).map((r) => ({
      vndbId: r.id,
      relation: r.relation,
      title: r.title,
    }))
    onApply(patch, mainCoverPath ?? undefined, undefined, { vnRelations })
    onClose()
  }

  return (
    <FetcherModal<VndbVnHit>
      title="VNDB"
      hint={<>Free, no API key. Fills title, aliases, description, developers, staff, characters (with voice actors), tags, length, community rating, editions, dev status, screenshots (with NSFW flags), and every release cover — one for each region so you can pick which one to show as the main cover. Publishers are pulled from every release with a country flag per language.</>}
      placeholder="Search a visual novel…"
      initialQuery={initialQuery}
      onSearch={search}
      onApply={apply}
      onClose={onClose}
      renderHit={(h) => {
        const yr = h.released ? h.released.slice(0, 4) : ''
        const devs = h.developers?.slice(0, 2).map((d) => d.name).join(', ') ?? ''
        const langs = h.languages?.slice(0, 3).join(' / ') ?? ''
        const sub = [devs, yr, langs].filter(Boolean).join(' · ')
        return {
          key: h.id,
          title: h.title,
          sub,
          thumbUrl: h.image?.url ?? undefined,
        }
      }}
    />
  )
}
