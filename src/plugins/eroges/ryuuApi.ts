// Ryuugames metadata scraper. Given a Ryuugames game URL (like
// `https://www.ryuugames.com/eng-<slug>-<dlsiteId>/`), pulls the
// game's INFO panel — the block that lists Title / Original Title /
// Language / Developer / Released date / links — and returns those
// fields for the editor to merge with the user's game.
//
// Runs in the renderer via the generic `net:fetch-text` plugin
// backend. No plugin-specific Rust code.

import { fetchText, assetDownload } from './ipc'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

function decodeEntities(s: string): string {
  if (!s) return ''
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => named[n.toLowerCase()] ?? m)
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

export interface RyuuFetchResult {
  title?: string
  originalTitle?: string
  language?: string
  developer?: string
  releaseDate?: string
  dlsiteUrl?: string
  dlsiteId?: string
  steamUrl?: string
  itchUrl?: string
  coverUrl?: string
  description?: string
}

// Pull the INFO section from a Ryuugames game page. Field extraction
// is line-based on the plain-text version — Ryuugames renders the info
// panel as `Title : Foo`, `Original Title : Bar`, etc. under an
// `<h2>INFO</h2>` heading, with links as bare `<a href>` lines under
// the heading.
export async function ryuuFetch(url: string): Promise<RyuuFetchResult> {
  const u = new URL(url)
  if (!/^https?:$/.test(u.protocol) || !/ryuugames/i.test(u.hostname)) {
    throw new Error('no es link de Ryuugames')
  }
  const html = await fetchText(u.toString(), {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml',
  })

  // Try to isolate the INFO block. Ryuugames uses `<h2>INFO</h2>` or
  // `<h3>INFO</h3>` and the fields live in the surrounding article
  // body. Fall back to the whole article/main if the anchor is not
  // found — parsing is line-based anyway so extra noise is fine.
  let infoHtml = ''
  const infoBlock = html.match(/<h[23][^>]*>\s*INFO\s*<\/h[23]>([\s\S]{0,20000}?)(?:<h[23]|<\/article|<\/main|$)/i)
  if (infoBlock) infoHtml = infoBlock[1]
  else {
    const art = html.match(/<article[^>]*>([\s\S]{0,60000}?)<\/article>/i)
    infoHtml = art ? art[1] : html
  }

  // Collect explicit links from the info block before we strip HTML.
  const links: string[] = []
  for (const m of infoHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) links.push(m[1])
  const dlsiteUrl = links.find((l) => /dlsite\.com/i.test(l))
  const steamUrl = links.find((l) => /store\.steampowered\.com|steamcommunity/i.test(l))
  const itchUrl = links.find((l) => /\.itch\.io/i.test(l))

  // Convert to plain text with newlines preserved so field extraction
  // can split on lines.
  const text = decodeEntities(
    infoHtml
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  ).split('\n').map((l) => l.trim()).filter(Boolean).join('\n')

  const grab = (label: string): string => {
    const re = new RegExp(`(?:^|\\n)\\s*${label.replace(/\s+/g, '\\s+')}\\s*[:：]\\s*([^\\n]+)`, 'i')
    const m = text.match(re)
    return m ? m[1].trim() : ''
  }

  const title = grab('Title')
  const originalTitle = grab('Original Title')
  const language = grab('Language')
  const developer = grab('Developer') || grab('Circle')
  const releaseDate = grab('Released date') || grab('Release Date') || grab('Released')

  // Extract dlsite RJ id from the URL path if we have a dlsite link
  let dlsiteId: string | undefined
  if (dlsiteUrl) {
    const m = dlsiteUrl.match(/\/(RJ\d{6,})/i)
    if (m) dlsiteId = m[1].toUpperCase()
  }
  if (!dlsiteId) {
    // Sometimes the RJ id is embedded in the Ryuugames slug itself
    const m = u.pathname.match(/rj(\d{6,})/i)
    if (m) dlsiteId = `RJ${m[1]}`
  }

  // Ryuugames pages usually have a featured cover image inside the
  // article body. Prefer the first big image that isn't a screenshot
  // gallery thumbnail.
  let coverUrl: string | undefined
  const imgMatch = html.match(/<img[^>]+class=["'][^"']*(?:wp-post-image|featured)[^"']*["'][^>]*>/i)
  if (imgMatch) {
    const src = imgMatch[0].match(/\bsrc=["']([^"']+)["']/i)
    if (src) coverUrl = src[1]
  }
  if (!coverUrl) {
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    if (og) coverUrl = og[1]
  }

  // Full description block. The section is titled "DESCRIPTION" but
  // the surrounding tag varies between site revisions — sometimes
  // it's an h2/h3 heading, sometimes a <p><strong>DESCRIPTION</strong>
  // paragraph, sometimes a WordPress block that wraps the label in a
  // <span>. We try every shape we've seen, keep the longest block
  // that comes back, and fall back to the OG meta only if nothing
  // matched. Reject fallback text that looks like SEO title junk
  // ("Direct Link Download", "Crack" appended to the game name) so
  // we don't pollute the field with search-engine bait.
  const extractBlock = (headingRe: RegExp): string | undefined => {
    const m = html.match(headingRe)
    if (!m) return undefined
    // The regex captures the body after the heading. Cut it at the
    // next heading / </article> / </main> / a "Download" section /
    // EOF so we don't spill into unrelated content.
    const body = m[1]
      .split(/<h[1-6]\b|<\/article|<\/main|<div[^>]+class=["'][^"']*(?:vndetails|td-post-sharing|entry-related)|LINK\s*DOWNLOAD|Direct\s*Link|Download\s*Links/i)[0]
    const raw = body
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
    const cleaned = decodeEntities(raw)
      .split('\n')
      .map((l) => l.replace(/\s+$/g, '').replace(/^\s+/g, ''))
      .filter(Boolean)
      .join('\n')
    return cleaned.length > 0 ? cleaned : undefined
  }

  let description: string | undefined
  const patterns: RegExp[] = [
    // <h2>DESCRIPTION</h2> ... — most common Ryuugames shape
    /<h[1-6][^>]*>\s*(?:<[^>]+>\s*)*DESCRIPTION(?:\s*<\/[^>]+>)*\s*<\/h[1-6]>([\s\S]{0,20000})/i,
    // <p><strong>DESCRIPTION</strong>...</p>  or <p><b>DESCRIPTION</b>...
    /<(?:p|div)[^>]*>\s*<(?:strong|b)[^>]*>\s*DESCRIPTION\s*<\/(?:strong|b)>[\s\S]{0,200}?<\/(?:p|div)>([\s\S]{0,20000})/i,
    // Bare "DESCRIPTION" heading-shaped span with class
    /<(?:span|div)[^>]*class=["'][^"']*(?:heading|title|section)[^"']*["'][^>]*>\s*DESCRIPTION\s*<\/(?:span|div)>([\s\S]{0,20000})/i,
  ]
  for (const re of patterns) {
    const found = extractBlock(re)
    if (found && (!description || found.length > description.length)) description = found
  }

  // Fallback: the OG description meta. Skip it when the string
  // reads like SEO junk (Ryuugames prepends "Direct Link Download"
  // and the RJ id to boilerplate meta for search engines).
  if (!description) {
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    const candidate = ogDesc ? stripHtml(ogDesc[1]) : ''
    const looksSEO = /Direct\s*Link\s*Download|\bCrack\b|\bRJ\d{6,}\b/i.test(candidate)
    if (candidate && !looksSEO) description = candidate
  }

  return { title, originalTitle, language, developer, releaseDate, dlsiteUrl, dlsiteId, steamUrl, itchUrl, coverUrl, description }
}

// Download a Ryuugames cover into the plugin's asset folder. Returns
// the on-disk filename.
export async function ryuuDownloadCover(gameName: string, imageUrl: string): Promise<string | null> {
  const res = await assetDownload('cover', imageUrl, `${gameName} cover`, 'https://www.ryuugames.com/')
  return res.ok ? res.filename : null
}

// Widen the return signature to expose failure reasons, mirroring
// the F95 downloader.
export async function ryuuDownloadCoverDetailed(gameName: string, imageUrl: string): Promise<{ ok: true; filename: string } | { ok: false; error: string }> {
  const res = await assetDownload('cover', imageUrl, `${gameName} cover`, 'https://www.ryuugames.com/')
  return res.ok ? { ok: true, filename: res.filename } : { ok: false, error: res.error }
}
