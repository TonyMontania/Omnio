// Emit MyAnimeList-compatible XML for anime or manga entries. MAL's
// import format is picky but well-documented: the outer element is
// <myanimelist>, each entry is <anime> or <manga> with a fixed set of
// child tags. Fields Omnio doesn't carry (like series_animedb_id) are
// left blank — MAL matches by title + type when the id is 0.

import type { Item } from './types'
import { getMangaStatus, getAnimeStatus } from './types'

// MAL status vocabulary. Omnio's plan_to_watch → "Plan to Watch", etc.
const ANIME_STATUS_MAL: Record<string, string> = {
  watching: 'Watching', completed: 'Completed', paused: 'On-Hold',
  dropped: 'Dropped', plan_to_watch: 'Plan to Watch',
}
const MANGA_STATUS_MAL: Record<string, string> = {
  reading: 'Reading', completed: 'Completed', paused: 'On-Hold',
  dropped: 'Dropped', plan_to_read: 'Plan to Read',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const cdata = (s: string | undefined) => (s ? `<![CDATA[${s.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>` : '')
const dateOrZero = (s?: string) => s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '0000-00-00'

export function buildAnimeMalXml(items: Item[]): string {
  const anime = items.filter((i) => i.categoryId === 'anime' || i.categoryId === 'donghua')
  const lines = [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<myanimelist>',
    '  <myinfo>',
    '    <user_export_type>1</user_export_type>',
    `    <user_total_anime>${anime.length}</user_total_anime>`,
    '  </myinfo>',
  ]
  for (const it of anime) {
    const st = getAnimeStatus(it.watchStatus)
    lines.push(
      '  <anime>',
      '    <series_animedb_id>0</series_animedb_id>',
      `    <series_title>${cdata(it.title)}</series_title>`,
      `    <series_type>${esc((it.animeFormat ?? 'TV').toUpperCase())}</series_type>`,
      `    <series_episodes>${it.totalEpisodes ?? '0'}</series_episodes>`,
      `    <my_watched_episodes>${it.episodesWatched ?? '0'}</my_watched_episodes>`,
      `    <my_start_date>${dateOrZero(it.startDate)}</my_start_date>`,
      `    <my_finish_date>${dateOrZero(it.finishedAt)}</my_finish_date>`,
      `    <my_score>${it.rating ? Math.round(it.rating * 2) : 0}</my_score>`,
      `    <my_status>${ANIME_STATUS_MAL[st.value] ?? 'Plan to Watch'}</my_status>`,
      `    <my_tags>${cdata((it.tags ?? []).join(', '))}</my_tags>`,
      `    <my_comments>${cdata(it.notes)}</my_comments>`,
      '    <update_on_import>1</update_on_import>',
      '  </anime>',
    )
  }
  lines.push('</myanimelist>', '')
  return lines.join('\n')
}

export function buildMangaMalXml(items: Item[]): string {
  const manga = items.filter((i) => i.categoryId === 'manga' || i.categoryId === 'manhwa' || i.categoryId === 'manhua')
  const lines = [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<myanimelist>',
    '  <myinfo>',
    '    <user_export_type>2</user_export_type>',
    `    <user_total_manga>${manga.length}</user_total_manga>`,
    '  </myinfo>',
  ]
  for (const it of manga) {
    const st = getMangaStatus(it.mangaStatus)
    lines.push(
      '  <manga>',
      '    <manga_mangadb_id>0</manga_mangadb_id>',
      `    <manga_title>${cdata(it.title)}</manga_title>`,
      `    <manga_volumes>${it.totalVolumes ?? '0'}</manga_volumes>`,
      `    <manga_chapters>${it.totalChapters ?? '0'}</manga_chapters>`,
      `    <my_read_volumes>${it.volumesRead ?? '0'}</my_read_volumes>`,
      `    <my_read_chapters>${it.chaptersRead ?? '0'}</my_read_chapters>`,
      `    <my_start_date>${dateOrZero(it.startDate)}</my_start_date>`,
      `    <my_finish_date>${dateOrZero(it.finishedAt)}</my_finish_date>`,
      `    <my_score>${it.rating ? Math.round(it.rating * 2) : 0}</my_score>`,
      `    <my_status>${MANGA_STATUS_MAL[st.value] ?? 'Plan to Read'}</my_status>`,
      `    <my_tags>${cdata((it.tags ?? []).join(', '))}</my_tags>`,
      `    <my_comments>${cdata(it.notes)}</my_comments>`,
      '    <update_on_import>1</update_on_import>',
      '  </manga>',
    )
  }
  lines.push('</myanimelist>', '')
  return lines.join('\n')
}

export function downloadBlob(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
