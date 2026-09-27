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

// DLsite fetcher — used as a first-choice fallback whenever we can
// pull the RJ id out of a URL (Ryuugames slugs, DLsite links pasted
// directly, or a raw RJ id). Tries the maniax section first (adult
// doujin games, where every RJ id lives), then home (all-ages) if the
// maniax page 404s. English page (`ecchi-eng`) is tried last because
// it exists only for a small subset of works.
export async function dlsiteFetch(rjOrUrl: string): Promise<RyuuFetchResult> {
  const rj = (() => {
    const m = String(rjOrUrl).match(/rj\d{6,}/i)
    return m ? m[0].toUpperCase() : ''
  })()
  if (!rj) throw new Error('no se pudo extraer RJ id')

  const productUrl = (section: string) =>
    `https://www.dlsite.com/${section}/work/=/product_id/${rj}.html`
  const referer = 'https://www.dlsite.com/'
  const cookieHeader = 'adultchecked=1'
  const dlHeaders: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Referer': referer,
    'Cookie': cookieHeader,
  }

  let html = ''
  let lastErr: unknown
  for (const section of ['maniax', 'home', 'pro', 'ecchi-eng']) {
    try {
      html = await fetchText(productUrl(section), dlHeaders)
      if (html && !/404/i.test(html.slice(0, 200))) break
    } catch (e) {
      lastErr = e
    }
  }
  if (!html) throw new Error(`DLsite fetch fallo: ${String(lastErr ?? 'sin datos')}`)

  const pick = (re: RegExp): string => {
    const m = html.match(re)
    return m ? decodeEntities(stripHtml(m[1])) : ''
  }

  // Title: `<h1 id="work_name">…</h1>` (the anchor may wrap it).
  const title = pick(/<h1[^>]*id=["']work_name["'][^>]*>([\s\S]{0,400}?)<\/h1>/i)
    || pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)

  // Circle / brand — DLsite renders it as an anchor under the "サークル名"
  // (or "ブランド名") table row, and always with `maker_name` id.
  const developer = pick(/<span[^>]*class=["'][^"']*maker_name[^"']*["'][^>]*>([\s\S]{0,300}?)<\/span>/i)
    || pick(/id=["']maker_name["'][^>]*>[\s\S]{0,120}?<a[^>]*>([\s\S]{0,200}?)<\/a>/i)
    || pick(/<th[^>]*>\s*(?:サークル名|ブランド名|Circle|Brand)\s*<\/th>\s*<td[^>]*>([\s\S]{0,400}?)<\/td>/i)

  // Release date — `販売日` / `Release date` row. DLsite formats dates
  // like `2024年10月18日` (JP) or `Oct 18, 2024` (EN). Normalize the JP
  // shape to ISO so the editor stores something sortable.
  const rawDate = pick(/<th[^>]*>\s*(?:販売日|Release\s*date|Sales\s*date)\s*<\/th>\s*<td[^>]*>([\s\S]{0,400}?)<\/td>/i)
  let releaseDate = rawDate
  const jp = rawDate.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (jp) releaseDate = `${jp[1]}-${jp[2].padStart(2, '0')}-${jp[3].padStart(2, '0')}`

  // Cover — DLsite serves the main image via `og:image` (protocol-less
  // `//img.dlsite.jp/…`). Prefix scheme so downstream downloaders don't
  // choke on the missing protocol.
  let coverUrl: string | undefined
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (og) {
    let src = og[1].trim()
    if (src.startsWith('//')) src = `https:${src}`
    coverUrl = src
  }
  if (!coverUrl) {
    // Fallback: first slider image inside the product view.
    const slide = html.match(/<img[^>]+class=["'][^"']*(?:product-slider-data|slider_item)[^"']*["'][^>]+src=["']([^"']+)["']/i)
    if (slide) {
      let src = slide[1].trim()
      if (src.startsWith('//')) src = `https:${src}`
      coverUrl = src
    }
  }

  // Description: `itemprop="description"` block, or the summary blurb
  // shown right under the title (`work_parts` first paragraph).
  let description = pick(/<div[^>]+itemprop=["']description["'][^>]*>([\s\S]{0,20000}?)<\/div>/i)
  if (!description) {
    description = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  }

  return {
    title: title || undefined,
    originalTitle: title || undefined,
    language: /ecchi-eng/.test(html) ? 'English' : 'Japanese',
    developer: developer || undefined,
    releaseDate: releaseDate || undefined,
    dlsiteUrl: productUrl('maniax'),
    dlsiteId: rj,
    coverUrl,
    description: description || undefined,
  }
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
  // Fast path: Ryuugames sits behind a Cloudflare challenge that we
  // can't clear from the renderer. When the URL slug already carries a
  // DLsite RJ id (99% of eng- pages do), skip Ryuugames entirely and
  // scrape DLsite — it's the source Ryuugames itself mirrors, and it
  // doesn't gate first-visit reads behind a JS check.
  {
    const m = u.pathname.match(/rj(\d{6,})/i)
    if (m) {
      const rj = `RJ${m[1]}`
      try { return await dlsiteFetch(rj) } catch { /* fall through */ }
    }
  }
  const html = await fetchText(u.toString(), {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Referer': `${u.protocol}//${u.hostname}/`,
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
