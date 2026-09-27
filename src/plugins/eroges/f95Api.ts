// F95Zone scraper — mirrors Nyx's `f95:fetch` + `f95:checkVersion`
// handlers, but runs in the renderer via `net:fetch-text` (the plain
// HTTP passthrough exposed by the plugin backend). Nothing here is
// specific to a plugin slug — the parsing rules live here so we can
// evolve them independently of the Rust core.

import { fetchText, assetDownload } from './ipc'
import { parseF95Title } from './parseF95Title'
import type { Parsed } from './parseF95Title'

function decodeEntities(s: string): string {
  if (!s) return ''
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => named[n.toLowerCase()] ?? m)
}
function extractMeta(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
  const m = html.match(re)
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
  return m ? decodeEntities(m[1]) : ''
}
function stripHtml(s: string): string {
  return decodeEntities(String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

const KNOWN_LABELS = [
  'Thread Updated', 'Release Date', 'Updated', 'Developer', 'Publisher',
  'Censored', 'Version', 'OS', 'Language', 'Languages', 'Genre', 'Tags',
  'Installation', 'Changelog', 'Change-Log', 'Warning', 'Download',
  'Downloads', 'Screenshots', 'Screenshot', 'Spoiler', 'Overview',
  'Original Title', 'Japanese Title', 'JP Title', 'Native Title',
]

function extractField(bodyText: string, label: string): string {
  const escaped = label.replace(/\s+/g, '\\s+')
  const startRe = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:?\\s*`, 'i')
  const startMatch = bodyText.match(startRe)
  if (!startMatch || startMatch.index === undefined) return ''
  const startIdx = startMatch.index + startMatch[0].length
  const after = bodyText.slice(startIdx)
  const others = KNOWN_LABELS.filter((l) => l.toLowerCase() !== label.toLowerCase())
  const endPattern = new RegExp(
    `\\n\\s*(?:${others.map((l) => l.replace(/\s+/g, '\\s+')).join('|')})\\s*:`,
    'i',
  )
  const endMatch = after.match(endPattern)
  const end = endMatch && endMatch.index !== undefined ? endMatch.index : Math.min(4000, after.length)
  return after.slice(0, end).trim().replace(/\n{3,}/g, '\n\n')
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

export interface F95FetchResult extends Parsed {
  description: string
  releaseDate: string
  coverUrl: string
  // Backup image candidates the caller can try if the main coverUrl
  // fails to download (F95 attachment endpoints sometimes need extra
  // auth; og:image is a stable-but-generic fallback).
  coverFallbacks: string[]
  originalTitle: string
  language: string
  dlsiteUrl: string
  dlsiteId: string
  steamUrl: string
  itchUrl: string
  // True when F95 hid external store links behind their login wall
  // (`<div class="messageHide">You must be registered to see the
  // links</div>`). Store links can't be scraped in that case — the
  // editor surfaces this to the user so they know to fall back to
  // the Ryuugames importer.
  storeLinksHidden: boolean
}

export async function f95Fetch(url: string, cookie?: string): Promise<F95FetchResult> {
  const u = new URL(url)
  if (!/^https?:$/.test(u.protocol)) throw new Error('URL inválida')
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  }
  if (cookie && cookie.trim()) headers['Cookie'] = cookie.trim()
  const html = await fetchText(u.toString(), headers)

  const ogTitle = extractMeta(html, 'og:title')
  const ogImage = extractMeta(html, 'og:image')
  const pageTitle = (html.match(/<title>([^<]+)<\/title>/i) ?? ['', ''])[1] ?? ''
  const parsed = parseF95Title(decodeEntities(ogTitle || pageTitle))

  let bodyHtml = ''
  const bbMatch = html.match(/<div[^>]*class="[^"]*bbWrapper[^"]*"[^>]*>([\s\S]{0,200000}?)<\/article>/i)
  if (bbMatch) bodyHtml = bbMatch[1]
  else {
    const bb2 = html.match(/<div[^>]*class="[^"]*bbWrapper[^"]*"[^>]*>([\s\S]{0,200000})/i)
    if (bb2) bodyHtml = bb2[1]
  }
  // Preserve inline colors as `[[C:color]]…[[/C]]` markers so the
  // renderer can restyle them after the HTML strip. Runs before the
  // spoiler pass so colored text inside a spoiler still comes out
  // styled. Other inline styles (bold/italic/underline/etc.) are
  // intentionally dropped — the label-detection heuristic gets
  // confused when field labels like `<b>Overview</b>` become
  // markers, and the alt rendering path breaks the description.
  const bodyHtmlColored = bodyHtml.replace(
    /<span[^>]*style="[^"]*color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, color: string, content: string) => `[[C:${color.trim()}]]${content}[[/C]]`,
  )
  // Preserve F95 spoiler blocks as `[[SPOILER:title]]…[[/SPOILER]]`
  // markers so the renderer can turn them back into collapsible
  // `<details>` sections. XenForo emits them as
  //   <div class="bbCodeSpoiler">
  //     <button><span class="button-text"><span>TITLE</span></span></button>
  //     <div class="bbCodeSpoiler-content">…CONTENT…</div>
  //   </div>
  // Nested spoilers are folded to their outermost block only.
  const bodyHtmlWithSpoilers = bodyHtmlColored.replace(
    /<div\s+class="bbCodeSpoiler">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi,
    (_, inner: string) => {
      const titleMatch = inner.match(/<span[^>]*class="button-text"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Spoiler'
      const contentMatch = inner.match(/<div\s+class="bbCodeSpoiler-content">([\s\S]*)$/i)
      const content = contentMatch ? contentMatch[1] : inner
      return `\n[[SPOILER:${title}]]${content}[[/SPOILER]]\n`
    },
  )
  const bodyText = decodeEntities(
    bodyHtmlWithSpoilers
      .replace(/<br[^>]*>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  ).replace(/[ \t]+\n/g, '\n')

  const description = extractField(bodyText, 'Overview')
    .replace(/^[:：\s]+/, '')
    .split('\n').map((l) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  let releaseDate = extractField(bodyText, 'Release Date').split('\n')[0].replace(/^[:：\s]+/, '').trim()
  if (!releaseDate) {
    const rdMatch = html.match(/Release\s+Date\s*:?\s*<\/b>\s*([^<\r\n]+)/i)
    if (rdMatch) releaseDate = stripHtml(rdMatch[1]).replace(/^[:：\s]+/, '').trim()
  }

  const firstLine = (label: string): string =>
    extractField(bodyText, label).split('\n')[0].replace(/^[:：\s]+/, '').trim()
  const originalTitle = firstLine('Original Title') || firstLine('Japanese Title')
    || firstLine('JP Title') || firstLine('Native Title')
  const language = firstLine('Language') || firstLine('Languages')

  // Sniff official store URLs across every place F95 might hide them:
  //
  //   1. Plain `https://www.dlsite.com/...` in the HTML — happens when
  //      the poster used a bbcode `[URL]` block that F95 didn't mask.
  //   2. XenForo's link tooltip metadata: `data-url="..."`,
  //      `data-preview-url="..."`, or the `title=` on link chips.
  //   3. `/masked/<base64>/` redirects — F95's own link masker.
  //      Every masked path segment decodes as base64 to the real URL.
  //
  // Doing all three catches every layout that F95's XenForo skin has
  // shipped over the years without needing to guess which one this
  // thread happens to use.
  const collectUrls = (): string[] => {
    const out: string[] = []
    // (1) raw URLs
    for (const m of html.matchAll(/https?:\/\/[^\s"'<>()\\]+/gi)) out.push(m[0])
    // (2) attribute-hosted URLs
    for (const m of html.matchAll(/\b(?:data-url|data-orig|data-preview-url|title|data-tooltip)=["']([^"']+)["']/gi)) out.push(m[1])
    // (3) decoded F95 masked links
    for (const m of html.matchAll(/\/masked\/([A-Za-z0-9+/=_-]{8,})\//g)) {
      try {
        const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/')
        const pad = b64 + '='.repeat((4 - b64.length % 4) % 4)
        const decoded = atob(pad)
        if (/^https?:\/\//i.test(decoded)) out.push(decoded)
      } catch { /* not valid base64 — ignore */ }
    }
    return out
  }
  const trimUrl = (v: string) => v.replace(/[.,;:!?)]+$/, '').replace(/&amp;/gi, '&')

  // Score each candidate so a game-product URL wins over a
  // developer/circle profile or a generic search page.
  //
  //   DLsite:  work/=/product_id/RJ... → 100 (the game)
  //            product_id anywhere      →  60
  //            everything else          →  10 (circle profile, dev search…)
  //   Steam:   /app/<numeric>           → 100 (the game)
  //            /agecheck/app/           →  90
  //            search page              →  10
  //            everything else          →  30
  const scoreDlsite = (u: string): number => {
    if (/\/work\/=\/product_id\/RJ\d/i.test(u)) return 100
    if (/product_id\/RJ\d/i.test(u)) return 60
    if (/circle|maker_id|profile|search/i.test(u)) return 10
    return 40
  }
  const scoreSteam = (u: string): number => {
    if (/store\.steampowered\.com\/app\/\d+/i.test(u)) return 100
    if (/store\.steampowered\.com\/agecheck\/app\/\d+/i.test(u)) return 90
    if (/search/i.test(u)) return 10
    return 30
  }
  const scoreItch = (u: string): number => {
    // itch.io game pages are `<creator>.itch.io/<game>`. Profile
    // roots (`<creator>.itch.io/` with nothing after) are less useful.
    if (/[a-z0-9-]+\.itch\.io\/[a-z0-9][a-z0-9-]+/i.test(u)) return 100
    if (/[a-z0-9-]+\.itch\.io\/?$/i.test(u)) return 30
    return 50
  }

  let dlsiteUrl = '', steamUrl = '', itchUrl = '', dlsiteId = ''
  let bestDlsite = 0, bestSteam = 0, bestItch = 0
  for (const raw of collectUrls()) {
    const url = trimUrl(raw)
    if (/(?:^|\/\/)(?:www\.)?dlsite\.com\//i.test(url)) {
      const s = scoreDlsite(url)
      if (s > bestDlsite) { bestDlsite = s; dlsiteUrl = url }
    }
    if (/(?:store\.steampowered\.com|steamcommunity\.com)\//i.test(url)) {
      const s = scoreSteam(url)
      if (s > bestSteam) { bestSteam = s; steamUrl = url }
    }
    if (/\.itch\.io/i.test(url)) {
      const s = scoreItch(url)
      if (s > bestItch) { bestItch = s; itchUrl = url }
    }
  }
  if (dlsiteUrl) {
    const rj = dlsiteUrl.match(/\/(RJ\d{6,})/i)
    if (rj) dlsiteId = rj[1].toUpperCase()
  }

  const isValidImg = (v: string): boolean => {
    if (!v) return false
    if (/emoji|smilies|avatar|\/xf\/|styles\/default|proxy\.php\?image=$/i.test(v)) return false
    return /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(v)
      || /attachments|imgbox|imgbb|imgur|postimg|pixhost|f95zone|imagebam|imagetwist|xenforo/i.test(v)
  }
  const normalize = (v: string) => (v.startsWith('//') ? 'https:' + v : v)
  // A URL that carries an explicit image extension is safer to fetch
  // than a redirect-style endpoint (e.g. `/attachments/12345/`), which
  // may serve HTML for unauthorized clients even when the cover was
  // visible on the page.
  const hasImageExt = (v: string): boolean => /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(v)
  const candidates: string[] = []
  const addCandidate = (v: string) => {
    const norm = normalize(v.trim())
    if (!norm || candidates.includes(norm)) return
    if (!isValidImg(norm)) return
    candidates.push(norm)
  }

  // Extract the best-looking image URL from a single <img> tag or link.
  // XenForo attaches previews under lots of different attribute names
  // (lazy loading, retina srcsets, tooltip previews…), so we check
  // every one we've seen in the wild.
  const grabImgUrl = (tag: string): string => {
    const grab = (attr: string): string => {
      const rr = new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i')
      const mm = tag.match(rr); return mm ? mm[1] : ''
    }
    const srcset = grab('srcset') || grab('data-srcset')
    const srcsetFirst = srcset ? srcset.split(',')[0].trim().split(/\s+/)[0] : ''
    return grab('data-src') || grab('data-url') || grab('data-original')
      || grab('data-preview-url') || grab('data-lb-src') || grab('data-src-full')
      || srcsetFirst || grab('src')
  }

  // Walk the OP body in document order and add the first image URL
  // each <img>/<a> tag exposes. This preserves the natural top-down
  // reading order — the banner cover appears at the top of the post
  // and F95 wraps screenshot thumbnails in <a href="fullres.gif"> a
  // few paragraphs down; scanning in DOM order keeps the banner first
  // even when it's a bare <img> and the screenshots are anchor-
  // wrapped.
  if (bodyHtml) {
    for (const m of bodyHtml.matchAll(/<(?:a\b[^>]*href=["']([^"']+)["']|img\b([^>]*))>/gi)) {
      if (m[1]) addCandidate(m[1])
      else if (m[2] !== undefined) addCandidate(grabImgUrl(`<img${m[2]}>`))
    }
  }
  // Whole-document fallback for the rare thread where the OP body
  // detection misses the post entirely.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) addCandidate(grabImgUrl(m[0]))
  if (ogImage) addCandidate(ogImage)

  // Stable secondary re-sort: only demote URLs that don't carry an
  // image extension (attachment redirect endpoints), keeping the
  // document-order relative ordering among the "safe" URLs intact.
  candidates.sort((a, b) => {
    const scoreA = hasImageExt(a) ? 1 : 0
    const scoreB = hasImageExt(b) ? 1 : 0
    return scoreB - scoreA
  })
  const coverUrl = candidates[0] ?? ''
  const coverFallbacks = candidates.slice(1)

  const storeLinksHidden = !dlsiteUrl && !steamUrl && !itchUrl && /messageHide--link/i.test(html)
  return { ...parsed, description, releaseDate, coverUrl, coverFallbacks, originalTitle, language, dlsiteUrl, dlsiteId, steamUrl, itchUrl, storeLinksHidden }
}

export interface F95Version {
  version: string
  threadUpdated: string
  status: string
}

export async function f95CheckVersion(url: string, cookie?: string): Promise<F95Version> {
  const u = new URL(url)
  if (!/^https?:$/.test(u.protocol) || !/f95zone/i.test(u.hostname)) {
    throw new Error('no es link de F95')
  }
  const headers: Record<string, string> = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml',
  }
  if (cookie && cookie.trim()) headers['Cookie'] = cookie.trim()
  const html = await fetchText(u.toString(), headers)
  const ogTitle = extractMeta(html, 'og:title')
  const pageTitle = (html.match(/<title>([^<]+)<\/title>/i) ?? ['', ''])[1] ?? ''
  const parsed = parseF95Title(decodeEntities(ogTitle || pageTitle))
  let bodyHtml = ''
  const bbMatch = html.match(/<div[^>]*class="[^"]*bbWrapper[^"]*"[^>]*>([\s\S]{0,40000}?)<\/article>/i)
  if (bbMatch) bodyHtml = bbMatch[1]
  const bodyText = decodeEntities(bodyHtml.replace(/<br[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''))
  const grab = (label: string): string => {
    const re = new RegExp(`(?:^|\\n)\\s*${label.replace(/\s+/g, '\\s+')}\\s*:?\\s*([^\\n]+)`, 'i')
    const m = bodyText.match(re); return m ? m[1].replace(/^[:：\s]+/, '').trim() : ''
  }
  return {
    version: grab('Version') || parsed.version || '',
    threadUpdated: grab('Thread Updated') || grab('Updated'),
    status: parsed.status,
  }
}

// Download an F95 cover image into the plugin's asset folder. Returns
// the on-disk filename (relative to assets/plugins/eroges/cover/).
export async function f95DownloadCover(gameName: string, imageUrl: string, cookie?: string): Promise<{ ok: true; filename: string } | { ok: false; error: string }> {
  const res = await assetDownload('cover', imageUrl, `${gameName} cover`, 'https://f95zone.to/', cookie)
  return res.ok ? { ok: true, filename: res.filename } : { ok: false, error: res.error }
}
