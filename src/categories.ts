// Single source of truth for the library taxonomy.
//
// Before Fase 3.3 this file exported `CATEGORIES` with `id: string` and
// a parallel `CategoryId` union lived in types/items.ts — nothing kept
// the two in sync, so a new category could be added to one without the
// other. Now `CATEGORY_IDS` is a `const` tuple, `CategoryId` derives
// from it, and `CATEGORIES` is typed against the derived literal.
// Adding a category means editing the tuple once and TypeScript flags
// every switch that doesn't handle it.

import type { AnimeCategoryId, MangaCategoryId, CategoryId } from './types/items'
import { compareText, onLanguageChange, t } from './i18n'

export interface Category {
  id: CategoryId
  label: string
  singular: string
}

// Labels are translated on read (getters), so every list that shows a
// library name follows the interface language without extra wiring.
function category<I extends CategoryId>(id: I, label: string, singular: string): Category & { id: I } {
  return {
    id,
    get label() { return t(label) },
    get singular() { return t(singular) },
  }
}

// Every list that shows the libraries (sidebar, Settings toggles, pickers,
// Stats) follows this array's order, which is kept alphabetical in the
// interface language: sortCategories() re-sorts it whenever the language
// changes.
export const CATEGORIES = [
  category('anime',         'Anime',          'anime'),
  category('libros',        'Books',          'book'),
  category('donghua',       'Donghua',        'donghua'),
  category('videojuegos',   'Games',          'game'),
  category('manga',         'Manga',          'manga'),
  category('manhua',        'Manhua',         'manhua'),
  category('manhwa',        'Manhwa',         'manhwa'),
  category('peliculas',     'Movies',         'movie'),
  category('musica',        'Music',          'music'),
  category('series',        'Series',         'series'),
  category('visual_novels', 'Visual Novels',  'visual novel'),
  category('comics_west',   'Western Comics', 'comic'),
] as const

function sortCategories(): void {
  (CATEGORIES as unknown as Category[]).sort((x, y) => compareText(x.label, y.label))
}
sortCategories()
onLanguageChange(sortCategories)

// Runtime tuple of every valid id, derived from CATEGORIES so it can't
// drift. Consumers that need string comparisons at runtime (schemas,
// filters, form controls) use this.
export const CATEGORY_ID_LIST: readonly CategoryId[] = CATEGORIES.map((c) => c.id)

// Family groupings — must stay in sync with the MangaCategoryId /
// AnimeCategoryId unions in types/items.ts. Typed as readonly tuples of
// the strict family type so pushing a wrong id here is a compile error.
export const COMIC_CATEGORY_IDS = ['manga', 'manhwa', 'manhua', 'comics_west'] as const satisfies readonly MangaCategoryId[]
export const COMIC_GROUP_LABEL = 'Comics & Manga'

export const ANIME_CATEGORY_IDS = ['anime', 'donghua'] as const satisfies readonly AnimeCategoryId[]
export const ANIME_GROUP_LABEL = 'Anime & Donghua'

// -- Type guards ------------------------------------------------------
//
// Each guard narrows a raw `string` (from JSON on disk, IPC payloads,
// or user input) to a specific `CategoryId` family so downstream
// exhaustive switches can rely on the union.

export function isCategoryId(id: string): id is CategoryId {
  return (CATEGORY_ID_LIST as readonly string[]).includes(id)
}

export function isAnimeLikeCategory(id: string): id is AnimeCategoryId {
  return (ANIME_CATEGORY_IDS as readonly string[]).includes(id)
}

export function isMangaLikeCategory(id: string): id is MangaCategoryId {
  return (COMIC_CATEGORY_IDS as readonly string[]).includes(id)
}

// -- Exhaustive-switch helper ----------------------------------------
//
// Drop at the tail of a `switch` on `CategoryId` (or any discriminated
// union). If a new variant is added to the union without a matching
// case, TypeScript reports "argument of type X is not assignable to
// parameter of type never" — the compile error you want. At runtime it
// throws to fail loud rather than silently returning undefined.
export function assertNever(x: never, context = 'unhandled variant'): never {
  throw new Error(`${context}: ${JSON.stringify(x)}`)
}
