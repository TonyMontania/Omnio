// AniDB deep-metadata fetcher for anime + donghua.
//
// AniDB's HTTP API has no search endpoint (search is done offline via the
// anime-titles.xml dump). To keep v1 small we skip that entirely and let
// the user paste an AID (or an AniDB URL) directly — the "deep fetch"
// flow assumes you already found the show on anidb.net.
//
// Coexists with AniList / MAL / Kitsu — none of them get replaced. AniDB
// provides fields the others don't (weighted tags, creators per episode,
// tighter cross-refs); when it has a better answer than what the editor
// already holds, this fetcher fills it in.
//
// Rate limit: enforced main-side (one request per 2.1s), and the button
// visually locks with a spinner so the user can't queue five fast clicks.

import { useState } from 'react'
import type { Item, AnimeFormat, AiringStatus } from './types'
import { assetBasename, downloadImageAsset } from './utils/files'

interface Props {
  initialUrl?: string
  categoryId: string       // active category so the cover lands in the right assets folder
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
  anidbClient?: string
}

type ParsedTitle = { text: string; type?: string; lang?: string }
type ParsedTag = { name: string; weight: number }

type ParsedAnime = {
  aid: string
  mainTitle: string
  altTitles: string[]
  type?: string           // TV Series / Movie / OVA …
  episodeCount?: string
  startDate?: string
  endDate?: string
  description?: string
  studios: string[]
  tags: ParsedTag[]
  pictureUrl?: string
  siteUrl: string
}

// AniDB URLs look like anidb.net/anime/12345 or anidb.net/a12345 — grab
// the numeric AID from either shape (or accept the bare number).
function extractAid(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed
  const m = /(?:anime\/|\/a|aid=)(\d+)/i.exec(trimmed)
  return m ? m[1] : null
}

// AniDB's type strings ("TV Series", "Movie", "OVA", "TV Special", "Web"…)
// map onto Omnio's AnimeFormat enum with a couple of judgment calls.
function toAnimeFormat(type: string | undefined): AnimeFormat | undefined {
  if (!type) return undefined
  const t = type.toLowerCase()
  if (t.includes('movie')) return 'movie'
  if (t.includes('ova')) return 'ova'
  if (t.includes('ona') || t.includes('web')) return 'ona'
  if (t.includes('special')) return 'special'
  if (t.includes('music')) return 'music'
  if (t.includes('tv')) return 'tv'
  return undefined
}

// Turn AniDB's YYYY-MM-DD start/end pair into Omnio's airingStatus. If no
// end date, still airing; if end date passed, finished; if start in the
// future, not yet aired.
function toAiringStatus(start?: string, end?: string): AiringStatus | undefined {
  if (!start) return undefined
  const now = new Date()
  const s = new Date(start)
  if (!Number.isNaN(s.getTime()) && s > now) return 'not_yet_aired'
  if (end) {
    const e = new Date(end)
    if (!Number.isNaN(e.getTime()) && e < now) return 'finished'
  }
  return 'airing'
}

function parseAnidbXml(xml: string, aid: string): ParsedAnime | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return null
  const anime = doc.querySelector('anime')
  if (!anime) return null
  const titles: ParsedTitle[] = Array.from(anime.querySelectorAll('titles > title')).map((n) => ({
    text: n.textContent?.trim() ?? '',
    type: n.getAttribute('type') ?? undefined,
    lang: n.getAttribute('xml:lang') ?? n.getAttribute('lang') ?? undefined,
  })).filter((t) => t.text)
  // Main title = the one AniDB marks type="main"; fallback = first title.
  const main = titles.find((t) => t.type === 'main') ?? titles[0]
  if (!main) return null
  // Alternative titles: everything else, deduped by text.
  const altSet = new Set<string>()
  const alt: string[] = []
  for (const t of titles) {
    if (t.text === main.text) continue
    if (altSet.has(t.text)) continue
    altSet.add(t.text)
    alt.push(t.text)
  }
  const type = anime.querySelector('type')?.textContent?.trim()
  const episodeCount = anime.querySelector('episodecount')?.textContent?.trim()
  const startDate = anime.querySelector('startdate')?.textContent?.trim()
  const endDate = anime.querySelector('enddate')?.textContent?.trim()
  const description = anime.querySelector('description')?.textContent?.trim()
  const picture = anime.querySelector('picture')?.textContent?.trim()
  // AniDB stores studios as creators with type="Animation Work". Directors,
  // character designers etc. all live in the same <creators> list but we
  // only surface studios in v1 (they're what maps cleanly to Item.studios).
  const studios = Array.from(anime.querySelectorAll('creators > name'))
    .filter((n) => (n.getAttribute('type') ?? '').toLowerCase().includes('animation work'))
    .map((n) => n.textContent?.trim() ?? '')
    .filter(Boolean)
  // Tags: skip spoilers (spoiler="true") and low-weight cruft, then take
  // the top 15 by weight so the editor's genres field stays sane.
  const tags: ParsedTag[] = Array.from(anime.querySelectorAll('tags > tag'))
    .filter((n) => n.getAttribute('spoiler') !== 'true')
    .map((n) => ({
      name: n.querySelector('name')?.textContent?.trim() ?? '',
      weight: parseInt(n.getAttribute('weight') ?? '0', 10) || 0,
    }))
    .filter((t) => t.name && t.weight >= 300)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 15)
  return {
    aid,
    mainTitle: main.text,
    altTitles: alt,
    type,
    episodeCount,
    startDate,
    endDate,
    description,
    studios,
    tags,
    pictureUrl: picture ? `https://cdn-eu.anidb.net/images/main/${picture}` : undefined,
    siteUrl: `https://anidb.net/anime/${aid}`,
  }
}

export default function AniDBFetcher({ initialUrl, categoryId, onApply, onClose, anidbClient }: Props) {
  const [input, setInput] = useState(initialUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParsedAnime | null>(null)

  const fetchOne = async () => {
    const aid = extractAid(input)
    if (!aid) { setError('Paste an AniDB URL (anidb.net/anime/12345) or a numeric AID.'); return }
    if (!anidbClient) { setError('Set your AniDB client name in Settings → Data → Integrations first.'); return }
    setError(null)
    setBusy(true)
    try {
      const res = await window.ipcRenderer.invoke('anidb:anime', anidbClient, aid) as
        | { ok: true; data: string }
        | { ok: false; error: string }
      if (!res.ok) { setError(res.error); setBusy(false); return }
      const parsed = parseAnidbXml(res.data, aid)
      if (!parsed) { setError('Could not parse AniDB response. The AID might not exist yet or the API returned an unexpected shape.'); setBusy(false); return }
      setResult(parsed)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!result) return
    const patch: Partial<Item> = {
      title: result.mainTitle,
      alternativeTitles: result.altTitles.length > 0 ? result.altTitles : undefined,
      animeFormat: toAnimeFormat(result.type),
      totalEpisodes: result.episodeCount,
      airedFrom: result.startDate,
      airedTo: result.endDate,
      airingStatus: toAiringStatus(result.startDate, result.endDate),
      animeDescription: result.description,
      studios: result.studios.length > 0 ? result.studios : undefined,
      genres: result.tags.length > 0 ? result.tags.map((t) => t.name) : undefined,
    }
    // Download the cover into assets/ so it stays local (matches every other
    // fetcher). AniDB's image CDN is `https://cdn-eu.anidb.net/images/main/{file}`
    // when the API returns a bare filename; a full URL is passed through.
    let coverUrl = result.pictureUrl
    if (coverUrl && !/^https?:\/\//i.test(coverUrl)) {
      coverUrl = `https://cdn-eu.anidb.net/images/main/${coverUrl}`
    }
    const coverPath = coverUrl
      ? await downloadImageAsset(coverUrl, categoryId, 'cover', assetBasename(result.mainTitle, 'cover')) ?? undefined
      : undefined
    onApply(patch, coverPath)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel anidb-fetcher" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '92vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>AniDB deep fetch</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ marginTop: 0 }}>
            AniDB's HTTP API has no title search — find the anime on
            <b> anidb.net</b> first, then paste the URL (or just the AID number) below.
            Rate-limited to one fetch every ~2 seconds per AniDB's terms.
            Requires a registered client name (Settings → Data → Integrations).
          </p>

          {!anidbClient && (
            <p className="save-files-error">
              No AniDB client name set. Register one at anidb.net/software/add and add it in Settings → Data → Integrations.
            </p>
          )}

          <div className="discogs-creds">
            <label>
              <span>AniDB URL or AID</span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://anidb.net/anime/12345"
                onKeyDown={(e) => { if (e.key === 'Enter') fetchOne() }}
                autoFocus
              />
            </label>
            <button
              type="button"
              className="importer-file-btn"
              onClick={fetchOne}
              disabled={busy || !anidbClient || !input.trim()}
            >
              {busy ? 'Fetching (respecting 2s throttle)…' : 'Fetch'}
            </button>
          </div>

          {error && <p className="save-files-error">{error}</p>}

          {result && (
            <div className="anidb-result">
              <div className="anidb-preview">
                {result.pictureUrl && <img src={result.pictureUrl} alt="" className="anidb-cover" />}
                <div className="anidb-preview-body">
                  <h3>{result.mainTitle}</h3>
                  {result.altTitles.length > 0 && (
                    <p className="anidb-alts">{result.altTitles.slice(0, 4).join(' · ')}{result.altTitles.length > 4 && ` +${result.altTitles.length - 4}`}</p>
                  )}
                  <div className="anidb-meta">
                    {result.type && <span>{result.type}</span>}
                    {result.episodeCount && <span>{result.episodeCount} ep</span>}
                    {result.startDate && <span>{result.startDate}{result.endDate ? ` → ${result.endDate}` : ''}</span>}
                  </div>
                  {result.studios.length > 0 && (
                    <p className="anidb-studios">{result.studios.join(', ')}</p>
                  )}
                  {result.tags.length > 0 && (
                    <div className="anidb-tags">
                      {result.tags.slice(0, 10).map((t) => (
                        <span key={t.name} className="anidb-tag" title={`weight ${t.weight}`}>{t.name}</span>
                      ))}
                    </div>
                  )}
                  {result.description && <p className="anidb-desc">{result.description.slice(0, 320)}{result.description.length > 320 && '…'}</p>}
                  <a className="pcgw-link" href={result.siteUrl} target="_blank" rel="noopener noreferrer">Open on AniDB ↗</a>
                </div>
              </div>
            </div>
          )}
        </div>
        {result && (
          <div className="modal-footer">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="primary-btn" onClick={apply}>Apply to editor</button>
          </div>
        )}
      </div>
    </div>
  )
}
