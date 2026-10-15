// Built-in fetcher registrations. Imported for side effects from
// `src/fetchers/index.ts`; each call to `registerFetcher` seeds the
// registry so `getFetchersFor(categoryId)` can enumerate every source
// wired to the current category. Lazy imports mirror the existing
// App.tsx behaviour — the modal JS is only pulled when the user
// actually opens a fetcher.

import { lazy, Suspense, createElement } from 'react'
import { registerFetcher, type FetcherContext, type FetcherRegistration } from './registry'

const AniDBFetcher       = lazy(() => import('../AniDBFetcher'))
const AniListFetcher     = lazy(() => import('../AniListFetcher'))
const ComicVineFetcher   = lazy(() => import('../ComicVineFetcher'))
const IgdbFetcher        = lazy(() => import('../IgdbFetcher'))
const KitsuFetcher       = lazy(() => import('../KitsuFetcher'))
const MangaDexFetcher    = lazy(() => import('../MangaDexFetcher'))
const MusicBrainzFetcher = lazy(() => import('../MusicBrainzFetcher'))
const OpenLibraryFetcher = lazy(() => import('../OpenLibraryFetcher'))
const TmdbFetcher        = lazy(() => import('../TmdbFetcher'))
const VndbFetcher        = lazy(() => import('../VndbFetcher'))

// AniList/Kitsu/Jikan/TMDb split their behavior by "kind". Anything
// registered on both anime and manga (or peliculas and series) reads
// `ctx.kind` to pick the right mode. `resolveKind` is a small helper
// that turns categoryId into the fetcher's kind vocab when the caller
// didn't set it explicitly.
type AnimeMangaKind = 'anime' | 'manga'
const animeMangaKind = (categoryId: string, override?: string): AnimeMangaKind => {
  if (override === 'anime' || override === 'manga') return override
  if (categoryId === 'anime' || categoryId === 'donghua') return 'anime'
  return 'manga'
}
type MovieSeriesKind = 'movie' | 'tv'
const movieTvKind = (categoryId: string, override?: string): MovieSeriesKind => {
  if (override === 'movie' || override === 'tv') return override
  if (categoryId === 'series') return 'tv'
  return 'movie'
}

// Wraps `render()` output in Suspense so lazy children can settle.
const suspense = (child: React.ReactElement) =>
  createElement(Suspense, { fallback: null }, child)

const registrations: FetcherRegistration[] = [
  {
    id: 'anilist',
    label: 'AniList',
    // comics_west is included for parity with the previous panel wiring
    // (the button was drawn unconditionally under `isMangaLike`); AniList
    // doesn't actually index western comics, so the fetch will typically
    // return no results there.
    categories: ['anime', 'donghua', 'manga', 'manhwa', 'manhua', 'comics_west'],
    auth: 'none',
    hint: (cat) => (cat === 'anime' || cat === 'donghua') ? 'Metadata + cover + banner' : 'Metadata + cover',
    render: (ctx: FetcherContext) => suspense(
      createElement(AniListFetcher, {
        initialQuery: ctx.initialQuery,
        // AniList's GraphQL schema uses uppercase MediaType enum values.
        kind: animeMangaKind(ctx.categoryId, ctx.kind) === 'anime' ? 'ANIME' : 'MANGA',
        categoryId: ctx.categoryId,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
  // MyAnimeList (via Jikan) intentionally NOT registered — the free
  // proxy is chronically flaky and repeated failures were hurting the
  // fetch panel's usefulness. The JikanFetcher component is still on
  // disk and importing it still works, so re-adding a registration
  // later is a two-line change.
  {
    id: 'kitsu',
    label: 'Kitsu',
    // Kitsu tackles anime + manga proper. Western comics use ComicVine.
    categories: ['anime', 'donghua', 'manga', 'manhwa', 'manhua'],
    auth: 'none',
    hint: 'Fallback when other sources miss it',
    render: (ctx: FetcherContext) => suspense(
      createElement(KitsuFetcher, {
        initialQuery: ctx.initialQuery,
        kind: animeMangaKind(ctx.categoryId, ctx.kind),
        categoryId: ctx.categoryId,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
  {
    id: 'anidb',
    label: 'AniDB',
    categories: ['anime', 'donghua'],
    auth: 'anidbClient',
    hint: 'Weighted tags + tighter refs · paste AID',
    render: (ctx: FetcherContext) => suspense(
      createElement(AniDBFetcher, {
        anidbClient: ctx.settings.anidbClient,
        categoryId: ctx.categoryId,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
  {
    id: 'mangadex',
    label: 'MangaDex',
    categories: ['manga', 'manhwa', 'manhua'],
    auth: 'none',
    hint: 'Deep catalog incl. obscure titles',
    render: (ctx: FetcherContext) => suspense(
      createElement(MangaDexFetcher, {
        initialQuery: ctx.initialQuery,
        categoryId: ctx.categoryId,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
  {
    id: 'comicvine',
    label: 'ComicVine',
    categories: ['comics_west'],
    auth: 'comicvineApiKey',
    hint: 'Marvel, DC, Image, indies + creator credits',
    render: (ctx: FetcherContext) => suspense(
      createElement(ComicVineFetcher, {
        apiKey: ctx.settings.comicvineApiKey,
        initialQuery: ctx.initialQuery,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
  {
    id: 'tmdb',
    label: 'TMDb',
    categories: ['peliculas', 'series'],
    auth: 'tmdbApiKey',
    hint: (cat) => cat === 'series' ? 'Cast, seasons, network, dates, genres' : 'Cast, crew, backdrop, dates, genres',
    render: (ctx: FetcherContext) => suspense(
      createElement(TmdbFetcher, {
        apiKey: ctx.settings.tmdbApiKey,
        initialQuery: ctx.initialQuery,
        kind: movieTvKind(ctx.categoryId, ctx.kind),
        categoryId: ctx.categoryId,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
  {
    id: 'igdb',
    label: 'IGDB',
    categories: ['videojuegos'],
    auth: 'igdb',
    hint: 'Full metadata — devs, publishers, platforms, genres',
    render: (ctx: FetcherContext) => suspense(
      createElement(IgdbFetcher, {
        clientId: ctx.settings.igdbClientId,
        clientSecret: ctx.settings.igdbClientSecret,
        initialQuery: ctx.initialQuery,
        // IGDB is the only source that passes hints (parentGameTitle for
        // franchise seeding) — everyone else drops the arg.
        onApply: (p, c, b, h) => ctx.onApply(p, c, b, h),
        onClose: ctx.onClose,
      }),
    ),
  },
  {
    id: 'musicbrainz',
    label: 'MusicBrainz',
    categories: ['musica'],
    auth: 'none',
    hint: 'Releases, tracklist, artists + Cover Art',
    render: (ctx: FetcherContext) => suspense(
      createElement(MusicBrainzFetcher, {
        initialQuery: ctx.initialQuery,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
  // VGMdb intentionally NOT registered — its only public API is the
  // community proxy vgmdb.info, which has been unreachable (connect
  // timeout to :443) as of the 0.4.1 window. The fetcher component
  // remains on disk so re-registering is a one-line change the day
  // the proxy comes back.
  {
    id: 'vndb',
    label: 'VNDB',
    categories: ['visual_novels'],
    auth: 'none',
    hint: 'Metadata + tags + staff + characters + cover',
    render: (ctx: FetcherContext) => suspense(
      createElement(VndbFetcher, {
        initialQuery: ctx.initialQuery,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
  {
    id: 'openlibrary',
    label: 'OpenLibrary',
    categories: ['libros'],
    auth: 'none',
    hint: 'Authors, publisher, page count, ISBN + cover',
    render: (ctx: FetcherContext) => suspense(
      createElement(OpenLibraryFetcher, {
        initialQuery: ctx.initialQuery,
        onApply: ctx.onApply,
        onClose: ctx.onClose,
      }),
    ),
  },
]

for (const reg of registrations) registerFetcher(reg)
