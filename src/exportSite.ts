// Renders the current library to a standalone HTML file. Assets are
// referenced by relative path (`assets/…`) so the caller must also copy
// the assets/ folder next to index.html — the main process handles that
// via export:site.

import type { Item, MusicArtist } from './types'
import { CATEGORIES } from './categories'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function localSrc(rel?: string): string | null {
  if (!rel) return null
  if (/^(https?:|data:|blob:)/i.test(rel)) return rel  // remote / inline pass through
  if (rel.startsWith('omnio-asset:')) return rel.replace(/^omnio-asset:\/*/i, 'assets/')
  return `assets/${rel}`
}

function renderCard(it: Item): string {
  const cover = localSrc(it.cover)
  const y = it.releaseDate ? new Date(it.releaseDate).getFullYear() : (it.releaseYear ?? '')
  const sub = [y, it.artist].filter(Boolean).join(' · ')
  return `
    <a class="card" href="#i-${esc(it.id)}">
      <div class="cover">
        ${cover ? `<img loading="lazy" src="${esc(cover)}" alt="">` : `<div class="fallback">${esc(it.title.charAt(0).toUpperCase())}</div>`}
        ${it.rating ? `<span class="rating">★ ${it.rating.toFixed(1)}</span>` : ''}
      </div>
      <div class="title">${esc(it.title)}</div>
      ${sub ? `<div class="sub">${esc(String(sub))}</div>` : ''}
    </a>
  `.trim()
}

function renderCategory(catId: string, catLabel: string, items: Item[]): string {
  if (items.length === 0) return ''
  return `
    <section class="cat" id="cat-${esc(catId)}">
      <h2>${esc(catLabel)}<span class="count">${items.length}</span></h2>
      <div class="grid">${items.map(renderCard).join('')}</div>
    </section>
  `
}

function renderArtists(artists: MusicArtist[]): string {
  if (artists.length === 0) return ''
  return `
    <section class="cat" id="cat-artists">
      <h2>Artists<span class="count">${artists.length}</span></h2>
      <div class="grid artists">
        ${artists.map((a) => {
          const p = localSrc(a.photo)
          return `
            <div class="card artist">
              <div class="avatar">
                ${p ? `<img loading="lazy" src="${esc(p)}" alt="">` : `<div class="fallback">${esc(a.name.charAt(0).toUpperCase())}</div>`}
              </div>
              <div class="title">${esc(a.name)}</div>
              ${a.origin ? `<div class="sub">${esc(a.origin)}</div>` : ''}
            </div>
          `.trim()
        }).join('')}
      </div>
    </section>
  `
}

export function buildStaticSiteHtml(items: Item[], artists: MusicArtist[], title = 'Omnio Library'): string {
  const now = new Date().toISOString().slice(0, 10)
  const styles = `
    :root {
      --bg:#111114; --surface:#17171a; --surface-2:#1e1e22;
      --line:#2a2a2f; --ink:#ece7d9; --mute:#8f8c82;
      --accent:#d4ac3a;
    }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink);
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    header { padding:32px 40px 24px; border-bottom:1px solid var(--line);
      display:flex; align-items:baseline; gap:16px; flex-wrap:wrap; }
    header h1 { margin:0; font-family:"Fraunces", "New York", Georgia, serif;
      font-size:36px; font-weight:400; letter-spacing:-.02em; }
    header .meta { color:var(--mute); font-family:"IBM Plex Mono", Menlo, monospace;
      font-size:12px; letter-spacing:.08em; text-transform:uppercase; }
    nav { position:sticky; top:0; z-index:1; background:var(--bg);
      border-bottom:1px solid var(--line); padding:10px 40px; display:flex; gap:10px;
      flex-wrap:wrap; }
    nav a { color:var(--mute); text-decoration:none; font-size:13px;
      padding:4px 10px; border-radius:4px; }
    nav a:hover { color:var(--ink); background:var(--surface-2); }
    section.cat { padding:28px 40px; }
    section.cat h2 { margin:0 0 16px; font-family:"Fraunces", serif;
      font-weight:400; font-size:24px; letter-spacing:-.01em;
      display:flex; align-items:baseline; gap:10px; }
    section.cat h2 .count { font-family:"IBM Plex Mono", monospace; font-size:12px;
      color:var(--mute); letter-spacing:.08em; }
    .grid { display:grid; gap:20px;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    .grid.artists { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
    .card { display:flex; flex-direction:column; gap:8px; text-decoration:none;
      color:inherit; }
    .cover, .avatar { position:relative; overflow:hidden;
      background:var(--surface-2); border-radius:8px; }
    .cover { aspect-ratio: 3/4; }
    .avatar { aspect-ratio: 1; border-radius: 50%; }
    .cover img, .avatar img { position:absolute; inset:0; width:100%; height:100%;
      object-fit:cover; display:block; }
    .fallback { position:absolute; inset:0; display:flex; align-items:center;
      justify-content:center; font-family:"Fraunces", serif; font-size:28px;
      color:var(--mute); }
    .rating { position:absolute; bottom:6px; right:8px; color:#fff;
      text-shadow: 0 1px 4px rgba(0,0,0,.8); font-family:"IBM Plex Mono", monospace;
      font-size:11px; }
    .title { font-size:13.5px; line-height:1.3; }
    .sub { font-family:"IBM Plex Mono", monospace; font-size:10.5px;
      color:var(--mute); letter-spacing:.06em; text-transform:uppercase; }
    footer { padding:24px 40px 40px; color:var(--mute); font-size:11px;
      font-family:"IBM Plex Mono", monospace; letter-spacing:.06em;
      border-top:1px solid var(--line); margin-top:32px; }
  `.trim()

  const sections = CATEGORIES.map((c) => {
    const catItems = items.filter((i) => i.categoryId === c.id)
    return renderCategory(c.id, c.label, catItems)
  }).filter(Boolean).join('\n')

  const artistsSection = renderArtists(artists)

  const nav = [
    ...CATEGORIES.filter((c) => items.some((i) => i.categoryId === c.id))
      .map((c) => `<a href="#cat-${esc(c.id)}">${esc(c.label)}</a>`),
    ...(artists.length ? [`<a href="#cat-artists">Artists</a>`] : []),
  ].join('')

  const total = items.length + artists.length
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${styles}</style>
</head><body>
<header>
  <h1>${esc(title)}</h1>
  <span class="meta">${total} entries · exported ${now}</span>
</header>
<nav>${nav}</nav>
${sections}
${artistsSection}
<footer>Exported from Omnio · read-only static snapshot.</footer>
</body></html>`
}
