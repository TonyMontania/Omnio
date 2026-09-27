// AniDB fetcher for anime / donghua. Two lookup modes: by AID (fetches
// via AniDB's HTTP API, rate-limited server-side to 1 req / 2.1 s), or
// by title against the locally cached anime-titles.xml dump.

import { useState } from 'react'
import type { Item, AnimeFormat, AiringStatus, Episode } from './types'
import { assetBasename, downloadImageAsset } from './utils/files'
import { invoke } from './utils/ipc'

interface Props {
  initialUrl?: string
  categoryId: string
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
  anidbClient?: string
}

type ParsedTitle = { text: string; type?: string; lang?: string }
type ParsedTag = { name: string; weight: number }

// AniDB prefixes non-regular episodes with a letter (S1/S2 = special,
// C/T/P/O = credits/trailer/parody/other). `numeric` strips the prefix
// so buckets can be sorted numerically inside each group.
type ParsedEpisode = {
  epno: string
  numeric: string
  type: 'regular' | 'special' | 'other'
  title?: string
  airdate?: string
  length?: string
  rating?: string
}

type ParsedAnime = {
  aid: string
  mainTitle: string
  altTitles: string[]
  type?: string
  episodeCount?: string
  startDate?: string
  endDate?: string
  description?: string
  studios: string[]
  tags: ParsedTag[]
  episodes: ParsedEpisode[]
  pictureUrl?: string
  siteUrl: string
}

// Accepts a bare number, `.../anime/12345`, `.../a12345` or `aid=12345`.
function extractAid(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed
  const m = /(?:anime\/|\/a|aid=)(\d+)/i.exec(trimmed)
  return m ? m[1] : null
}

// AniDB descriptions embed unclickable in-house cross-refs like
// `http://anidb.net/cr1283 [Capcom]`. Keep the bracketed label and
// drop everything else so the field reads as prose.
function cleanAnidbDescription(text: string): string {
  return text
    .replace(/https?:\/\/anidb\.net\/[a-z]+\d+\s*\[([^\]]+)\]/gi, '$1')
    .replace(/https?:\/\/anidb\.net\/\S+/gi, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

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
  const main = titles.find((t) => t.type === 'main') ?? titles[0]
  if (!main) return null
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
  const rawDescription = anime.querySelector('description')?.textContent?.trim()
  const description = rawDescription ? cleanAnidbDescription(rawDescription) : undefined
  const picture = anime.querySelector('picture')?.textContent?.trim()
  // <creators> mixes studios, directors, character designers, etc. Only
  // the "Animation Work" entries map onto Item.studios.
  const studios = Array.from(anime.querySelectorAll('creators > name'))
    .filter((n) => (n.getAttribute('type') ?? '').toLowerCase().includes('animation work'))
    .map((n) => n.textContent?.trim() ?? '')
    .filter(Boolean)
  const tags: ParsedTag[] = Array.from(anime.querySelectorAll('tags > tag'))
    .filter((n) => n.getAttribute('spoiler') !== 'true')
    .map((n) => ({
      name: n.querySelector('name')?.textContent?.trim() ?? '',
      weight: parseInt(n.getAttribute('weight') ?? '0', 10) || 0,
    }))
    .filter((t) => t.name && t.weight >= 300)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 15)
  // AniDB's episode type attribute: 1 regular, 2 special, 3-6 credits/
  // trailer/parody/other. Collapsed to 3 buckets so apply() can offer
  // "regular only" vs "everything" without re-parsing.
  const bucketOf = (t: string | null): 'regular' | 'special' | 'other' => {
    if (t === '1' || t === null) return 'regular'
    if (t === '2') return 'special'
    return 'other'
  }
  const pickEpisodeTitle = (ep: Element): string | undefined => {
    const nodes = Array.from(ep.querySelectorAll('title'))
    const byLang = (l: string) => nodes.find((n) => (n.getAttribute('xml:lang') ?? n.getAttribute('lang')) === l)
    return (byLang('en') ?? byLang('x-jat') ?? nodes[0])?.textContent?.trim() || undefined
  }
  const episodes: ParsedEpisode[] = Array.from(anime.querySelectorAll('episodes > episode'))
    .map((ep) => {
      const epnoNode = ep.querySelector('epno')
      const epno = epnoNode?.textContent?.trim() ?? ''
      const type = bucketOf(epnoNode?.getAttribute('type') ?? null)
      const numeric = epno.replace(/[^0-9.]/g, '')
      return {
        epno,
        numeric,
        type,
        title: pickEpisodeTitle(ep),
        airdate: ep.querySelector('airdate')?.textContent?.trim() || undefined,
        length: ep.querySelector('length')?.textContent?.trim() || undefined,
        rating: ep.querySelector('rating')?.textContent?.trim() || undefined,
      } as ParsedEpisode
    })
    .filter((e) => e.epno.length > 0)
    // Regulars first, then specials, then the "other" bucket grouped
    // by prefix letter (all C's then T's then P's, etc). AniDB
    // interleaves those in the raw dump; grouping keeps openings /
    // endings / trailers together in the editor.
    .sort((a, b) => {
      const rank = (t: ParsedEpisode['type']) => t === 'regular' ? 0 : t === 'special' ? 1 : 2
      const dr = rank(a.type) - rank(b.type)
      if (dr !== 0) return dr
      if (a.type === 'other') {
        const la = a.epno.charAt(0).toUpperCase()
        const lb = b.epno.charAt(0).toUpperCase()
        if (la !== lb) return la.localeCompare(lb)
      }
      return parseFloat(a.numeric || '0') - parseFloat(b.numeric || '0')
    })
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
    episodes,
    pictureUrl: picture ? `https://cdn-eu.anidb.net/images/main/${picture}` : undefined,
    siteUrl: `https://anidb.net/anime/${aid}`,
  }
}

export default function AniDBFetcher({ initialUrl, categoryId, onApply, onClose, anidbClient }: Props) {
  const [input, setInput] = useState(initialUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParsedAnime | null>(null)
  const [episodeScope, setEpisodeScope] = useState<'none' | 'regular' | 'regular_specials' | 'all'>('regular')
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ aid: string; mainTitle: string; altTitles: string[] }[] | null>(null)
  const [searchBusy, setSearchBusy] = useState<'idle' | 'downloading' | 'searching'>('idle')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [dumpCount, setDumpCount] = useState<number | null>(null)

  const downloadDump = async () => {
    setSearchBusy('downloading')
    setSearchError(null)
    const r = await invoke('anidb:download-titles')
    if (r.ok) {
      setDumpCount(r.data.count)
    } else {
      setSearchError(`Could not download the title dump — ${r.error}`)
    }
    setSearchBusy('idle')
  }

  const runSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    setSearchBusy('searching')
    setSearchError(null)
    const r = await invoke('anidb:search-titles', q, 25)
    if (r.ok) {
      setSearchResults(r.data)
      if (r.data.length === 0) setSearchError('No matches. Try a different spelling or the romaji title.')
    } else {
      setSearchResults(null)
      if (r.error.includes('not downloaded')) {
        setSearchError('Title cache not downloaded yet. Click "Download title dump" first (one-time, ~10 MB).')
      } else {
        setSearchError(r.error)
      }
    }
    setSearchBusy('idle')
  }

  const pickFromSearch = async (aid: string) => {
    setInput(aid)
    setSearchMode(false)
    setSearchResults(null)
    // Yield a tick so the setInput above lands before fetchOne reads it.
    setTimeout(() => { void fetchOne(aid) }, 0)
  }

  const fetchOne = async (overrideAid?: string) => {
    const aid = overrideAid ?? extractAid(input)
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
      if (!parsed) {
        // Surface the raw response preview so a rate-limit, banned
        // client or maintenance page reads distinctly from a genuine
        // "no such AID".
        const preview = res.data.trim().replace(/\s+/g, ' ').slice(0, 250)
        setError(`Could not parse AniDB response. First bytes of what AniDB sent back:\n\n${preview || '(empty response)'}\n\nCommon causes: newly-registered clients can take up to ~15 min to activate; API=UDP instead of HTTP on the client; wrong client version; rate limit exceeded ("banned" for ~24h).`)
        setBusy(false)
        return
      }
      setResult(parsed)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!result) return
    const includeType = (t: ParsedEpisode['type']) => {
      if (episodeScope === 'none') return false
      if (episodeScope === 'regular') return t === 'regular'
      if (episodeScope === 'regular_specials') return t === 'regular' || t === 'special'
      return true
    }
    const episodesForItem: Episode[] | undefined = episodeScope === 'none' || result.episodes.length === 0
      ? undefined
      : result.episodes.filter((e) => includeType(e.type)).map((e) => ({
          id: crypto.randomUUID(),
          number: e.epno,
          title: e.title,
          airdate: e.airdate,
          length: e.length,
        }))
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
      hasEpisodes: episodesForItem && episodesForItem.length > 0 ? true : undefined,
      episodes: episodesForItem,
    }
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
    <div className="modal-overlay">
      <div className="modal-panel anidb-fetcher" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: '92vw', maxHeight: '85vh' }}>
        <div className="modal-header">
          <h2>AniDB deep fetch</h2>
          <button type="button" className="panel-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="anidb-mode-toggle">
            <button
              type="button"
              className={!searchMode ? 'pill active' : 'pill'}
              onClick={() => { setSearchMode(false); setSearchResults(null); setSearchError(null) }}
            >By AID / URL</button>
            <button
              type="button"
              className={searchMode ? 'pill active' : 'pill'}
              onClick={() => { setSearchMode(true); setError(null); setResult(null) }}
            >Search by title</button>
          </div>

          {!searchMode && (
            <p className="hint" style={{ marginTop: 0 }}>
              AniDB's HTTP API has no title search — find the anime on
              <b> anidb.net</b> first, then paste the URL (or just the AID number) below.
              Rate-limited to one fetch every ~2 seconds per AniDB's terms.
              Requires a registered client name (Settings → Data → Integrations).
            </p>
          )}
          {searchMode && (
            <p className="hint" style={{ marginTop: 0 }}>
              Uses AniDB's public title dump — no rate limit, no client name needed. Download it once (~10 MB compressed) and every search after that runs 100 % locally. Re-download whenever you feel it's out of date (they refresh it daily).
            </p>
          )}

          {!anidbClient && (
            <p className="save-files-error">
              No AniDB client name set. Register one at anidb.net/software/add and add it in Settings → Data → Integrations.
            </p>
          )}

          {!searchMode && (
            <div className="discogs-creds">
              <label>
                <span>AniDB URL or AID</span>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://anidb.net/anime/12345"
                  onKeyDown={(e) => { if (e.key === 'Enter') void fetchOne() }}
                  autoFocus
                />
              </label>
              <button
                type="button"
                className="importer-file-btn"
                onClick={() => void fetchOne()}
                disabled={busy || !anidbClient || !input.trim()}
              >
                {busy ? 'Fetching (respecting 2s throttle)…' : 'Fetch'}
              </button>
            </div>
          )}

          {searchMode && (
            <div className="anidb-search">
              <div className="anidb-search-bar">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type an anime title (any language)…"
                  onKeyDown={(e) => { if (e.key === 'Enter') void runSearch(searchQuery) }}
                  autoFocus
                />
                <button
                  type="button"
                  className="importer-file-btn"
                  onClick={() => void runSearch(searchQuery)}
                  disabled={searchBusy !== 'idle' || !searchQuery.trim()}
                >
                  {searchBusy === 'searching' ? 'Searching…' : 'Search'}
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => void downloadDump()}
                  disabled={searchBusy !== 'idle'}
                  title="One-time (or occasional) download of the AniDB title dump. Reusable across every search after."
                >
                  {searchBusy === 'downloading' ? 'Downloading…' : (dumpCount ? `Re-download dump (${dumpCount})` : 'Download title dump')}
                </button>
              </div>
              {searchError && <p className="save-files-error">{searchError}</p>}
              {searchResults && searchResults.length > 0 && (
                <ul className="anidb-search-results">
                  {searchResults.map((r) => (
                    <li key={r.aid} onClick={() => void pickFromSearch(r.aid)}>
                      <div className="anidb-search-title">{r.mainTitle}</div>
                      {r.altTitles.length > 0 && (
                        <div className="anidb-search-alts">{r.altTitles.slice(0, 3).join(' · ')}{r.altTitles.length > 3 && ' …'}</div>
                      )}
                      <div className="anidb-search-aid">aid {r.aid}</div>
                    </li>
                  ))}
                </ul>
              )}
              {busy && <p className="hint">Fetching full details (respecting 2s throttle)…</p>}
            </div>
          )}

          {error && <pre className="save-files-error" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', margin: 0 }}>{error}</pre>}

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
                  {result.episodes.length > 0 && (() => {
                    const nRegular = result.episodes.filter((e) => e.type === 'regular').length
                    const nSpecial = result.episodes.filter((e) => e.type === 'special').length
                    const nOther = result.episodes.filter((e) => e.type === 'other').length
                    return (
                      <div className="anidb-episodes-scope">
                        <div className="anidb-episodes-head">
                          <span>Episode list</span>
                          <span className="hint" style={{ fontSize: 11.5 }}>
                            {nRegular} regular
                            {nSpecial > 0 && ` · ${nSpecial} special`}
                            {nOther > 0 && ` · ${nOther} other`}
                          </span>
                        </div>
                        <div className="anidb-episodes-options">
                          <label><input type="radio" name="anidb-scope" checked={episodeScope === 'none'} onChange={() => setEpisodeScope('none')} /> Don't add episodes</label>
                          <label><input type="radio" name="anidb-scope" checked={episodeScope === 'regular'} onChange={() => setEpisodeScope('regular')} /> Regular only ({nRegular})</label>
                          <label><input type="radio" name="anidb-scope" checked={episodeScope === 'regular_specials'} onChange={() => setEpisodeScope('regular_specials')} /> Regular + specials ({nRegular + nSpecial})</label>
                          <label><input type="radio" name="anidb-scope" checked={episodeScope === 'all'} onChange={() => setEpisodeScope('all')} /> Everything ({result.episodes.length})</label>
                        </div>
                        <p className="hint" style={{ marginTop: 4, fontSize: 11.5 }}>Applies to the item's <b>Episodes</b> section — replaces any existing list. Number, title (English → Romaji → first available) and order are copied from AniDB.</p>
                      </div>
                    )
                  })()}
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
