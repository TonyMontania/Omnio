export interface Category {
  id: string
  label: string
  singular: string
  icon: string
}

export const CATEGORIES: Category[] = [
  { id: 'anime', label: 'Anime', singular: 'anime', icon: '' },
  { id: 'donghua', label: 'Donghua', singular: 'donghua', icon: '' },
  { id: 'videojuegos', label: 'Games', singular: 'game', icon: '' },
  { id: 'manga', label: 'Manga', singular: 'manga', icon: '' },
  { id: 'manhwa', label: 'Manhwa', singular: 'manhwa', icon: '' },
  { id: 'manhua', label: 'Manhua', singular: 'manhua', icon: '' },
  { id: 'comics_west', label: 'Western Comics', singular: 'comic', icon: '' },
  { id: 'peliculas', label: 'Movies', singular: 'movie', icon: '' },
  { id: 'musica', label: 'Music', singular: 'music', icon: '' },
  { id: 'series', label: 'Series', singular: 'series', icon: '' },
]

export const COMIC_CATEGORY_IDS = ['manga', 'manhwa', 'manhua', 'comics_west']
export const COMIC_GROUP_LABEL = 'Comics & Manga'

export const ANIME_CATEGORY_IDS = ['anime', 'donghua']
export const ANIME_GROUP_LABEL = 'Anime & Donghua'

export function isAnimeLikeCategory(id: string): boolean {
  return ANIME_CATEGORY_IDS.includes(id)
}