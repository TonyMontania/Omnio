// URL patterns for the "paste a metadata URL into the Title field and
// the matching fetcher opens with the title pre-filled" flow.
//
// Each pattern maps a supported URL to a fetcher registration id and a
// derived search query. The query is a best-effort humanized version
// of the URL slug — the fetcher then does its usual search and the
// user picks the row that matches. That indirection means we don't
// need per-source ID lookups (which many APIs gate behind OAuth).

export interface QuickAddMatch {
  /** Fetcher registration id (matches `registrations.tsx`). */
  fetcherId: string
  /** Human-readable search query derived from the URL slug. */
  query: string
  /** Source label shown in the "detected URL" hint. */
  source: string
}

interface Pattern {
  fetcherId: string
  source: string
  regex: RegExp
  /** Which capture group carries the human-readable slug. */
  slugGroup: number
}

const PATTERNS: Pattern[] = [
  // IGDB — https://www.igdb.com/games/the-witcher-3-wild-hunt
  { fetcherId: 'igdb', source: 'IGDB', regex: /igdb\.com\/games\/([^/?#]+)/i, slugGroup: 1 },
  // TMDb movie — https://www.themoviedb.org/movie/272-batman-begins
  { fetcherId: 'tmdb', source: 'TMDb', regex: /themoviedb\.org\/movie\/\d+-([^/?#]+)/i, slugGroup: 1 },
  { fetcherId: 'tmdb', source: 'TMDb', regex: /themoviedb\.org\/movie\/(\d+)(?:\/|\?|#|$)/i, slugGroup: 1 },
  // TMDb tv — https://www.themoviedb.org/tv/1399-game-of-thrones
  { fetcherId: 'tmdb', source: 'TMDb', regex: /themoviedb\.org\/tv\/\d+-([^/?#]+)/i, slugGroup: 1 },
  { fetcherId: 'tmdb', source: 'TMDb', regex: /themoviedb\.org\/tv\/(\d+)(?:\/|\?|#|$)/i, slugGroup: 1 },
  // AniList — https://anilist.co/anime/16498/Attack-on-Titan/
  { fetcherId: 'anilist', source: 'AniList', regex: /anilist\.co\/(?:anime|manga)\/\d+\/([^/?#]+)/i, slugGroup: 1 },
  // MyAnimeList — https://myanimelist.net/anime/16498/Shingeki_no_Kyojin
  //   AniList is our fetcher for MAL-shaped queries too.
  { fetcherId: 'anilist', source: 'MyAnimeList', regex: /myanimelist\.net\/(?:anime|manga)\/\d+\/([^/?#]+)/i, slugGroup: 1 },
  // VNDB — https://vndb.org/v17 (no slug; treat the id as a fallback)
  { fetcherId: 'vndb', source: 'VNDB', regex: /vndb\.org\/(v\d+)/i, slugGroup: 1 },
  // MangaDex — https://mangadex.org/title/<uuid>/komi-san-can-t-communicate
  { fetcherId: 'mangadex', source: 'MangaDex', regex: /mangadex\.org\/title\/[a-f0-9-]{36}\/([^/?#]+)/i, slugGroup: 1 },
  // OpenLibrary — https://openlibrary.org/works/OL45804W/The_Witcher
  { fetcherId: 'openlibrary', source: 'OpenLibrary', regex: /openlibrary\.org\/works\/OL\d+W\/([^/?#]+)/i, slugGroup: 1 },
  // Steam store — https://store.steampowered.com/app/292030/The_Witcher_3_Wild_Hunt/
  //   Steam has no fetcher; route through IGDB with the slug as a query.
  { fetcherId: 'igdb', source: 'Steam', regex: /store\.steampowered\.com\/app\/\d+\/([^/?#]+)/i, slugGroup: 1 },
]

function humanize(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Return the best URL match found in `text` (usually a pasted string),
 *  restricted to fetchers available for `availableFetcherIds`. */
export function detectQuickAddUrl(text: string, availableFetcherIds: readonly string[]): QuickAddMatch | null {
  const trimmed = text.trim()
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null
  const available = new Set(availableFetcherIds)
  for (const p of PATTERNS) {
    const m = trimmed.match(p.regex)
    if (!m) continue
    if (!available.has(p.fetcherId)) continue
    const raw = m[p.slugGroup] ?? ''
    const query = humanize(raw)
    if (!query) continue
    return { fetcherId: p.fetcherId, query, source: p.source }
  }
  return null
}
