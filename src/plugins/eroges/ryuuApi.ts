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

  // Optional short description from the OG description meta.
  let description: string | undefined
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  if (ogDesc) description = stripHtml(ogDesc[1])

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
