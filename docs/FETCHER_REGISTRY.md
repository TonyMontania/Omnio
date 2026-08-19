# Fetcher plugin registry — design pass

**Status:** scaffolded, not adopted. See `src/fetchers/registry.ts`.

## Why

Each of the 14 metadata sources (IGDB, TMDb, MangaDex, OpenLibrary,
MusicBrainz, VGMdb, AniList, AniDB, MyAnimeList / Jikan, Kitsu, ComicVine,
SteamGridDB, PCGamingWiki, lrclib) is a self-contained React modal today.
Adding a new source means editing:

- The fetcher component itself
- The "Fetch metadata" panel inside each editor block in `App.tsx`
- The API-key row in Settings → Integrations
- The `Settings` type in App.tsx (if the new source needs a key)

That's four files per source. Consolidating the metadata into a
registry drops it to two (the component + a registration file), and
opens the door to third-party plugins if we ever want them.

## Registry shape

```ts
interface FetcherRegistration {
  id: string
  label: string
  categories: readonly string[]
  auth: 'none' | 'sgdbApiKey' | 'tmdbApiKey' | 'igdb'
      | 'comicvineApiKey' | 'anidbClient'
  hint?: string
  render: (ctx: FetcherContext) => ReactElement | null
}

interface FetcherContext {
  initialQuery: string
  categoryId: string
  kind?: string
  settings: FetcherSettings           // API-key subset of Settings
  onApply: (patch: Partial<Item>, coverPath?: string, bannerPath?: string) => void
  onClose: () => void
}
```

**Why `render(ctx)` and not `component`?** Fetchers don't share a single
prop shape: AniDB takes `initialUrl` (no query), IGDB takes both a
client id and secret, AniList's `kind` is uppercase (`ANIME`) while
Jikan/Kitsu use lowercase, and TMDb's is `movie` / `tv`. Each
registration binds its component's props locally instead of trying to
squeeze every source into one signature.

## Auth

`auth` names the *credential slot(s)* on `Settings`, not the raw key
string. The reason: the fetcher panel needs to know whether the button
should be enabled (has key), and if not, where the Settings UI should
jump. Special case: `'igdb'` requires both `igdbClientId` and
`igdbClientSecret`; treated as one atomic slot.

## Migration steps

1. ~~**Register each fetcher.**~~ **Done.** Consolidated in
   `src/fetchers/registrations.tsx` — 11 registrations covering AniDB,
   AniList, ComicVine, IGDB, Jikan, Kitsu, MangaDex, MusicBrainz,
   OpenLibrary, TMDb, VGMdb. SteamGridDB, lrclib and PCGamingWiki are
   not registered because they don't behave like a search-and-apply
   metadata modal (SGDB is an image picker; lrclib is per-track;
   PCGamingWiki is embedded inline in the game editor).
2. ~~**Barrel import at boot.**~~ **Done.** `import './fetchers'` at
   the top of `App.tsx` seeds the registry on first render.
3. ~~**Rewrite the "Fetch metadata" panel.**~~ **Done.** Panel now
   iterates `getFetchersFor(activeCategory)` sorted by label; each row
   pulls copy from `resolveHint(reg, categoryId)` (registrations may
   supply a plain string or a function of category). Auth-dimming via
   `authReady(reg.auth, settings)` **not** wired yet — the previous
   panel showed disabled-auth buttons too and the fetchers themselves
   surface a "please set the API key" hint, so parity was preserved.
   Wiring `authReady` here is a small follow-up.
4. ~~**Trim `App.tsx`.**~~ **Done.** Eleven `useState` open-states
   collapsed into a single `activeFetcher: string | null`; the eleven
   `<XFetcher …/>` render blocks collapsed into one that invokes
   `reg.render(ctx)`. `applyAniListPatch` wrapper removed — the toast
   label now comes from `reg.label`. App.tsx dropped ~200 lines.

## Third-party plugins

Deferred. The runtime is Electron, so a plugin would be a JS bundle
dropped into `data/plugins/` and `require()`d at startup — that's a
sizeable security surface (network access, IPC access) for a niche
feature. Not worth the audit cost until at least one user asks.

## Related files

- `src/fetchers/registry.ts` — registry API
- `src/components/FetcherModal.tsx` — shared modal shell every fetcher
  already renders through
- `docs/DEFERRED.md` — the higher-level punt list
