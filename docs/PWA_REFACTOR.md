# PWA / mobile shell — refactor plan

Omnio today is Electron-only. The renderer talks to the main process
through ~40 `ipcRenderer.invoke` channels for every disk operation —
reading and writing JSONs, saving covers, rotating snapshots, running
external metadata fetches. A browser can't do any of that on its own.

The Docker deployment (`packaging/docker/`) works around the gap by
running the full Electron binary under KasmVNC and streaming its
desktop window to a browser. That's the right call for headless
servers but fails for mobile: the streamed desktop UI doesn't reflow
below ~1024px and touch interaction with a VNC canvas is poor.

Delivering a real mobile-friendly Omnio is a multi-week refactor. This
doc records the plan so we can make progress on it deliberately rather
than in bursts.

## Goal

A single codebase that ships:

- The existing Electron desktop app (Windows / macOS / Linux installers).
- A self-hostable HTTP server that serves the renderer as a PWA. The
  same JSON files, the same asset directory, the same fetcher logic —
  a different transport for IPC.

The user's data still lives on disk; no cloud, no multi-tenant.

## Non-goals

- Multi-user / auth-per-user beyond a single shared password. If someone
  wants Google-Drive-for-hobbies, that's a different product.
- Realtime collaboration.
- Rewriting the renderer from scratch. Every existing component should
  keep working with minimal changes; only the transport under IPC swaps.

## Architecture

```
┌─────────────────┐        ┌──────────────────────┐
│  React renderer │  ───▶  │ src/rpc/index.ts     │
│  (unchanged)    │        │ (currently: IPC only)│
└─────────────────┘        └──────────┬───────────┘
                                      │
                        ┌─────────────┴──────────────┐
                        │                            │
                        ▼                            ▼
                ┌───────────────┐          ┌────────────────────┐
                │ Electron IPC  │          │ HTTP client        │
                │ (window.ipc…) │          │ fetch('/rpc/...')  │
                └───────┬───────┘          └──────────┬─────────┘
                        │                             │
                        ▼                             ▼
                ┌───────────────┐          ┌────────────────────┐
                │ main.ts       │          │ server/index.ts    │
                │ handlers      │          │ Express routes     │
                └───────┬───────┘          └──────────┬─────────┘
                        │                             │
                        └──────────┬──────────────────┘
                                   ▼
                        ┌────────────────────────┐
                        │ core/ (shared logic)   │
                        │ file IO, migrations,   │
                        │ metadata fetchers,     │
                        │ image writing …        │
                        └────────────────────────┘
```

The **core/** layer already exists in spirit inside `electron/main.ts`
(read/writeSplitData, image:save handler body, mb:search body, etc).
Extracting it into pure functions taking `{ dataDir, assetsDir }` is
the biggest single piece of work.

## Phases

### Phase 1 — Extract core/ (2-3 weeks)

- Create `src/core/` with pure functions that don't depend on Electron:
  `readLibrary(root)`, `writeLibrary(root, payload)`,
  `saveImageAsset(root, category, kind, buf, basename)`,
  `downloadImage(url)`, `searchMusicBrainz(term)`, etc.
- Rewrite the Electron `ipcMain.handle` bodies as one-line wrappers
  that resolve `root` from `PORTABLE_EXECUTABLE_DIR` / `userData` and
  call into core/.
- No behavior change. All existing tests / manual smoke checks pass
  unchanged. This phase alone is high-value even without the PWA:
  it's the split-App.tsx cleanup applied to main.ts.

### Phase 2 — RPC abstraction (1 week)

- Create `src/rpc/index.ts` that exports typed functions matching every
  IPC channel: `data.load()`, `data.save(payload)`, `image.save(...)`,
  `mb.search(term)`, etc.
- Under Electron, each function delegates to `window.ipcRenderer.invoke`.
- Detect environment at runtime (`typeof window.ipcRenderer !== 'undefined'`)
  so the renderer picks the right transport.
- Replace every `window.ipcRenderer.invoke(...)` in the app with the
  typed rpc functions. This is a big mechanical diff but no behavior
  change.

### Phase 3 — HTTP server (1 week)

- New `server/` package: Express + a static handler for the built
  renderer (`dist/`). Each RPC function gets a matching route
  (`POST /rpc/data.save`, `GET /rpc/data.load`, etc). Bodies are
  JSON, files upload as multipart.
- Assets served from `${root}/assets/*` under `/assets/*`.
- Single shared password via `AUTHORIZATION: Bearer …` header,
  configured through env var. No user accounts.
- Bootable via `npm run server` locally or `npx omnio-server` after
  publishing to npm. Docker image can drop KasmVNC entirely and switch
  to this — much lighter and mobile-friendly.

### Phase 4 — Mobile CSS pass (2 weeks)

- Every full-screen editor modal needs to reflow below 768px. Grid
  becomes single-column. Card zoom loses `xl` on mobile.
- Card grid: change min-width from 260px to 140px on mobile so more
  covers fit on a phone.
- Long tables (tracklist, achievements, screenshots) become
  horizontally-scrolling stacks below 640px.
- Right-click context menu → long-press.
- Ctrl+K search becomes a bottom-sheet on mobile.

### Phase 5 — PWA manifest + service worker (2 days)

- Add `manifest.json` (already partially there for KasmVNC).
- Service worker caches the renderer shell so subsequent loads are
  instant and the app can start offline (metadata fetches still fail,
  which is fine — the local library still reads).
- `beforeinstallprompt` handling so users can "Add to Home Screen".

## Risks

- **Feature drift**: adding new fetchers or IPC handlers in the two
  transport paths is easy to forget one side. Mitigation: the rpc/
  abstraction in Phase 2 is the choke point; new features go through
  it exclusively.
- **Auth complexity creep**: single password is fine for a
  home-network deployment. If someone asks for OAuth / SSO, refuse —
  that's outside the product's scope.
- **`omnio-asset://` protocol** doesn't exist in the browser. Every
  asset URL in the renderer already goes through `assetSrc()`, which
  can be updated in one place to switch to `/assets/...` under HTTP.
  Existing behavior stays for Electron.
- **File uploads** are trickier over HTTP (multipart, size limits,
  cover conversion). Phase 3 needs an explicit `/rpc/image.upload`
  route with a 20MB limit and MIME sniff.
- **Docker image size** shrinks dramatically (KasmVNC + Chromium
  disappear) but ARM users lose the "same as desktop" guarantee. The
  KasmVNC image should stay published as `:desktop-latest` for people
  who want the identical UX; the PWA image ships as `:latest`.

## What we're NOT signing up for

- Rewriting components to native web equivalents. React + our current
  DOM tree stays.
- Removing Electron. Desktop installers remain the primary
  distribution.
- Server-side rendering. The renderer stays SPA.
- Multi-tenant / hosted service. We publish the code + Docker image;
  hosting is on the user.

## Timeline estimate

Total: **6-8 weeks of focused work**. Splittable into any of the
phases as standalone PRs; Phase 1 alone is a valuable cleanup even if
Phase 2+ never lands.
