export interface Category {
  id: string
  label: string
  singular: string
}

// Sorted alphabetically by label so every list surfaced in the UI (Home
// cards, Settings library toggles, category pickers, Stats sub-tabs)
// reads in the same order the user picked. Change this list to change the
// display order everywhere.
export const CATEGORIES: Category[] = [
  { id: 'anime',       label: 'Anime',          singular: 'anime' },
  { id: 'libros',      label: 'Books',          singular: 'book' },
  { id: 'donghua',     label: 'Donghua',        singular: 'donghua' },
  { id: 'videojuegos', label: 'Games',          singular: 'game' },
  { id: 'manga',       label: 'Manga',          singular: 'manga' },
  { id: 'manhua',      label: 'Manhua',         singular: 'manhua' },
  { id: 'manhwa',      label: 'Manhwa',         singular: 'manhwa' },
  { id: 'peliculas',   label: 'Movies',         singular: 'movie' },
  { id: 'musica',      label: 'Music',          singular: 'music' },
  { id: 'series',      label: 'Series',         singular: 'series' },
  { id: 'comics_west', label: 'Western Comics', singular: 'comic' },
]

export const COMIC_CATEGORY_IDS = ['manga', 'manhwa', 'manhua', 'comics_west']
export const COMIC_GROUP_LABEL = 'Comics & Manga'

export const ANIME_CATEGORY_IDS = ['anime', 'donghua']
export const ANIME_GROUP_LABEL = 'Anime & Donghua'

export function isAnimeLikeCategory(id: string): boolean {
  return ANIME_CATEGORY_IDS.includes(id)
}