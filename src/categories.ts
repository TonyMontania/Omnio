export interface Category {
  id: string
  label: string
  singular: string
}

export const CATEGORIES: Category[] = [
  { id: 'anime', label: 'Anime', singular: 'anime' },
  { id: 'donghua', label: 'Donghua', singular: 'donghua' },
  { id: 'videojuegos', label: 'Games', singular: 'game' },
  { id: 'manga', label: 'Manga', singular: 'manga' },
  { id: 'manhwa', label: 'Manhwa', singular: 'manhwa' },
  { id: 'manhua', label: 'Manhua', singular: 'manhua' },
  { id: 'comics_west', label: 'Western Comics', singular: 'comic' },
  { id: 'peliculas', label: 'Movies', singular: 'movie' },
  { id: 'musica', label: 'Music', singular: 'music' },
  { id: 'series', label: 'Series', singular: 'series' },
]

export const COMIC_CATEGORY_IDS = ['manga', 'manhwa', 'manhua', 'comics_west']
export const COMIC_GROUP_LABEL = 'Comics & Manga'

export const ANIME_CATEGORY_IDS = ['anime', 'donghua']
export const ANIME_GROUP_LABEL = 'Anime & Donghua'

export function isAnimeLikeCategory(id: string): boolean {
  return ANIME_CATEGORY_IDS.includes(id)
}