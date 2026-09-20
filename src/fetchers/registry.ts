// Fetcher plugin registry. Each metadata source (IGDB, TMDb, MangaDex, …)
// declares an id, the categories it covers, its credential requirement,
// and a `render(ctx)` function that produces the modal JSX. The context
// carries everything a fetcher might need (current category, item kind,
// settings snapshot, initial query, and the two callbacks) so no
// registration has to reach into React state directly.
//
// The panel that shows "Fetch metadata" buttons in the editor calls
// `getFetchersFor(activeCategory)` and renders one entry per hit,
// deciding button-enabled state from `authReady(settings)`. Nothing
// consumes this yet — App.tsx still has the per-category JSX. Wiring
// the panel is the last migration step (see docs/FETCHER_REGISTRY.md).

import type { ReactElement } from 'react'
import type { Item } from '../types'

// Runtime settings the fetchers actually read. Kept as a structural
// subtype of the full Settings so the registry doesn't have to import
// App.tsx just to type this — App.tsx passes its `settings` in and
// TypeScript accepts it.
export interface FetcherSettings {
  sgdbApiKey?: string
  tmdbApiKey?: string
  igdbClientId?: string
  igdbClientSecret?: string
  comicvineApiKey?: string
  anidbClient?: string
}

// The context a registration's `render` receives. `kind` is optional
// because most sources are single-purpose; TMDb/AniList/Kitsu/Jikan use
// it to switch between anime/manga or movie/series inside one fetcher.
// Optional side-band hints a fetcher might attach. IGDB uses
// `parentGameTitle` to seed the franchise field; every other source
// ignores hints entirely.
export interface FetcherApplyHints {
  parentGameTitle?: string
  // VNDB relations arrive as VNDB slugs (v17, v42, …). applyFetchedPatch
  // walks the user's library and turns any slug that matches an existing
  // item's `vndbId` into a proper RelatedItem entry.
  vnRelations?: { vndbId: string; relation: string; title: string }[]
  // Optional tag suggestions the source knows about but that shouldn't
  // silently overwrite the user's own `tags` array. applyFetchedPatch
  // surfaces these as clickable chips in the editor — one click accepts,
  // ✕ dismisses. Genres and other structured taxonomy fields still get
  // applied directly (they map to a dedicated field, not free-text tags).
  suggestedTags?: string[]
}

export interface FetcherContext {
  initialQuery: string
  categoryId: string
  kind?: string
  settings: FetcherSettings
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string, hints?: FetcherApplyHints) => void
  onClose: () => void
}

export type FetcherAuth =
  | 'none'
  | 'sgdbApiKey'
  | 'tmdbApiKey'
  | 'igdb'                 // needs both igdbClientId + igdbClientSecret
  | 'comicvineApiKey'
  | 'anidbClient'

export interface FetcherRegistration {
  id: string                          // stable identifier, kebab-case
  label: string                       // shown on the button ("IGDB", "AniList")
  categories: readonly string[]       // categoryIds this source applies to
  auth: FetcherAuth
  // Short description shown under the button. Can be a function so the
  // same fetcher can advertise a different focus per category (TMDb
  // shows "Cast, crew, backdrop…" for movies but "Cast, seasons,
  // network…" for series).
  hint?: string | ((categoryId: string) => string)
  // Rendering is a function of the runtime context so each registration
  // can bind category-specific props (kind, apiKey, extra callbacks)
  // without needing a shared component signature.
  render: (ctx: FetcherContext) => ReactElement | null
}

export function resolveHint(reg: FetcherRegistration, categoryId: string): string {
  if (typeof reg.hint === 'function') return reg.hint(categoryId)
  return reg.hint ?? ''
}

// Answers "is this fetcher usable given the current Settings?" — the
// panel dims the button (and swaps its onClick to "jump to Settings")
// when this returns false.
export function authReady(auth: FetcherAuth, settings: FetcherSettings): boolean {
  switch (auth) {
    case 'none': return true
    case 'sgdbApiKey': return !!settings.sgdbApiKey
    case 'tmdbApiKey': return !!settings.tmdbApiKey
    case 'igdb': return !!(settings.igdbClientId && settings.igdbClientSecret)
    case 'comicvineApiKey': return !!settings.comicvineApiKey
    case 'anidbClient': return !!settings.anidbClient
  }
}

const registry: FetcherRegistration[] = []

export function registerFetcher(reg: FetcherRegistration): void {
  const existing = registry.findIndex((r) => r.id === reg.id)
  if (existing >= 0) registry[existing] = reg
  else registry.push(reg)
}

export function getFetchersFor(categoryId: string): FetcherRegistration[] {
  return registry.filter((r) => r.categories.includes(categoryId))
}

// Test / debug helper. Not intended for production callers.
export function _clearFetcherRegistryForTests(): void {
  registry.length = 0
}
