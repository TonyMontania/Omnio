# Omnio

<img src="public/omnio-logo.svg" width="80" align="right" alt="Logo de Omnio">

[![Licencia: MIT](https://img.shields.io/badge/License-MIT-c9a227.svg)](LICENSE)
![Plataforma: Windows · macOS · Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-informational.svg)
![Local-first](https://img.shields.io/badge/local--first-yes-success.svg)

[English](README.md) · **Español**

![Captura de Omnio](https://github.com/user-attachments/assets/f7abdd85-ae6b-4deb-b1c1-00441e0456f3)

**Omnio** es una aplicación de escritorio local-first para trackear tus hobbies — videojuegos, música, películas, series, anime, donghua, manga, manhwa, manhua y cómics occidentales — todo en un solo lugar. Sin cuentas, sin telemetría, sin nube. Tus datos viven en una carpeta `data/` al lado del ejecutable, portable para llevarla en un pendrive.

La interfaz está en inglés. Para una referencia de campo por campo en inglés y español, ver [`docs/FIELDS.md`](docs/FIELDS.md).

## Destacado

- **10 librerías** con campos ricos por categoría (ver [Categorías](#categorías))
- **3 fuentes de metadata integradas**: SteamGridDB para arte de games, AniList y MyAnimeList (vía Jikan) para anime/manga (ver [Fuentes de metadata](#fuentes-de-metadata-y-arte))
- **Import masivo** desde exports XML de MyAnimeList / AniList
- **Búsqueda global Ctrl+K**, acciones masivas (Shift+click), undo/redo (Ctrl+Z)
- **Storage por slice** desde 0.1.7: un JSON por librería; editar un juego solo reescribe `games.json` y la corrupción de un archivo no afecta al resto
- **5 snapshots rotativos** en cada save; restore de 1 click
- **Heatmap anual + Yearly Wrapped** en Statistics
- **Export a HTML estático** para compartir tu biblioteca como carpeta que abre cualquier navegador
- **Seis temas**, ocho accents, controles de density y font-size, iconografía monocromática

## Contenido

- [Instalación](#instalación)
- [Categorías](#categorías)
- [Fuentes de metadata y arte](#fuentes-de-metadata-y-arte)
- [Funciones transversales](#funciones-transversales)
- [Estadísticas](#estadísticas-por-categoría)
- [Settings](#settings)
- [Interfaz](#interfaz)
- [Storage y portabilidad](#storage-y-portabilidad)
- [Desarrollo](#desarrollo)

## Instalación

Descargá desde el [último release](https://github.com/TonyMontania/Omnio/releases/latest) y elegí tu plataforma.

### Windows

**Portable `.exe`** — recomendado (modo pendrive)
1. Descargá `Omnio-*-portable.exe` y ponelo en la carpeta que quieras.
2. Doble click para ejecutar. `data.json` y `assets/` se crean al lado en el primer arranque.
3. Primer arranque: SmartScreen va a mostrar *"Windows protegió tu PC"* — click en **Más información** → **Ejecutar de todos modos**. Es un build sin firmar y open-source; podés inspeccionar el código y buildearlo vos mismo si preferís.

**Instalador NSIS `.exe`** — asistente clásico con acceso directo en el menú de inicio y desinstalador.
1. Descargá `Omnio-*-setup.exe` y ejecutalo.
2. Los datos van a `%APPDATA%\Omnio` (NO al lado del ejecutable). Si querés el modo portable, usá el build portable.

**winget** — desde cualquier terminal:
```powershell
winget install TonyMontania.Omnio
```

**Scoop** (bucket comunitario, amigable con portables):
```powershell
scoop install omnio
```

**Chocolatey**:
```powershell
choco install omnio
```

### macOS (universal Intel + Apple Silicon)

**`.dmg`** — recomendado
1. Descargá `Omnio-Mac-*-x64.dmg` (Intel) o `Omnio-Mac-*-arm64.dmg` (Apple Silicon) y arrastrá Omnio.app a Aplicaciones.
2. Primer arranque: Gatekeeper va a decir *"Omnio no puede abrirse porque Apple no pudo verificarla"*. Para saltear esto:
   - **Click derecho** sobre la app → **Abrir** → confirmar en el diálogo. O:
   - En Terminal: `xattr -cr /Applications/Omnio.app` y abrila normalmente.

**`.zip`** — arrastrás la `.app` sin tener que montar la imagen. Aplica el mismo paso de Gatekeeper.

**Homebrew Cask**:
```bash
brew install --cask omnio
```

### Linux

**`.AppImage`** — funciona en todas las distros
1. Descargá `Omnio-Linux-*.AppImage`.
2. `chmod +x Omnio-Linux-*.AppImage`
3. Doble click o correlo desde la terminal. Algunas distros necesitan `libfuse2` (`sudo apt install libfuse2` en Debian/Ubuntu).

**Debian / Ubuntu / Mint (`.deb`)**
```bash
sudo apt install ./Omnio-Linux-*.deb
```

**Tarball (`.tar.gz`)** — extraés donde quieras y ejecutás `./omnio`. Portable, sin root.

**Flatpak (Flathub)**
```bash
flatpak install flathub com.omnio.app
flatpak run com.omnio.app
```

**Snap**
```bash
sudo snap install omnio
```

**Arch / Manjaro (AUR)**
```bash
yay -S omnio-bin      # o: paru -S omnio-bin
```

### Portabilidad

Los builds portable, tarball y AppImage mantienen `data.json` + `assets/` al lado del ejecutable — movés la carpeta entre máquinas o la metés en un pendrive y tu biblioteca viaja con vos. El instalador NSIS, el Cask de Homebrew, el `.deb`, Flatpak, Snap y el AUR siguen la convención de cada SO (`%APPDATA%`, `~/Library/Application Support/Omnio`, `~/.config/Omnio`, etc.); usá **Settings → Data → Export** para mover una biblioteca entre distintos métodos de instalación.

## Stack técnico

- **Electron 30** + **React 18** + **Vite 5** + **TypeScript 5**
- Proceso principal en `electron/`, interfaz en `src/`
- Guardado local: un único `data.json` + carpeta `assets/` con las imágenes por categoría/tipo
- Sin backend, sin APIs externas
- Tipografías: Fraunces (display) + Inter (cuerpo) + IBM Plex Mono (etiquetas/datos)

## Categorías

### Games (Videojuegos)
Ficha estilo infinitebacklog: banner + logo, cover, descripción, **múltiples developers y publishers**, **plataformas libres** (creás las que quieras, con sugerencias y autocompletado), ownership, status (Backlog / Playing / Played / Completed / Dropped), tiempo jugado, rating (medio punto), **logros desbloqueados / totales**, DLC/Expansions y Addons con status propio, **contenido de bundle** (para colecciones tipo MGS HD Collection — cada sub-juego tiene su propio cover y status para trackear el progreso individual), notas mini-markdown, tags. **Extendido**: alternative titles, source (Original / Remake / Remaster / Reboot / Port / Sequel / Spin-off / Standalone expansion / Expanded / Collection), **edición** (texto libre — Standard, Deluxe, Collector's, lo que sea), age rating ESRB, franchise, review con toggle de spoilers, replay history, related games con set completo de tipos de relación (sequel, prequel, standalone, DLC, remake, reboot, port, collection, same universe, crossover…), franchise timeline auto, recommendations.

### Music (Música)
Fichas por tipo (Single / EP / Album / OST / Live / Recopilation), tracklist con rating por track, favorito, listened y **botón de Lyrics por canción** (modal para leer/editar la letra). Duración total auto (formatos álbum-like). **Galería de single covers** — arte separado para singles con portada propia (título + año + imagen). **Editions** — Deluxe, Japan, Anniversary y demás, cada una con su cover propio y su tracklist propia (tracks extra o alternativos). Perfil de Artista estilo Spotify: banner + avatar circular (también en la vista de Artistas), discografía cronológica, rating promedio, **info de banda** (origen, estado, años activos, géneros, sellos, miembros actuales + ex-miembros con roles por integrante **y años de entrada / salida**). Collections Listened / Not listened. **Extendido**: alternative titles, source, producers, review con spoilers, listen history, related albums, recommendations.

### Movies (Películas)
Directors, **writers (guionistas)**, cast, **production companies**, **distributed by**, franchise, watched + rewatch count, review con toggle de spoilers, backdrop image. **Extendido**: alternative titles, source (Original / Book / Comic / Game / True story / Remake / Sequel), content rating, watched where, rewatch history log completo, related movies, franchise timeline, recommendations.

### Series
Ficha propia estilo Anime — cast, directors, showrunners, writers, network, country, language, content rating. **Lista de temporadas** anidada con episodios opcionales por temporada (número/título/año/eps totales, watched, rating, notas). Migración automática desde el sistema viejo de `units[]` checklist. Related series, franchise timeline, recommendations, rewatch history, review con spoilers.

### Anime & Donghua
Grupo colapsable en la sidebar con dos sub-bibliotecas independientes (**Anime** y **Donghua**) que comparten la misma ficha estilo AniList/MAL: studios, formato (TV/Movie/OVA/ONA/Special/Music Video), airing status, season + año, demographic, watch status (Plan to watch / Watching / Completed / Paused / Dropped), episodios vistos/totales, fechas inicio/fin, rating, notas. **Extendido**: alternative titles, source (Manga/Light novel/Web novel/Novel/Original/Game/Visual novel), age rating ESRB, ep. duration + total runtime auto, aired from/to range, favorite episode + nota, dropped-at info condicional, **lista de episodios** con watched/rating/filler/notes, review con spoilers, rewatch history, related con tipo de relación, franchise timeline, recommendations.

### Comics & Manga
4 sub-bibliotecas independientes (Manga, Manhwa, Manhua, Western Comics) con ficha compartida estilo AniList/MAL: authors + artists, géneros, publication status, reading status, capítulos y volúmenes leídos/totales, volume covers en galería, rating, notas. **Extendido**: alternative titles, source, age rating ESRB, magazine/serialization, **lista de capítulos** con read/rating/notas, review con spoilers, reread history, related manga con tipo de relación, franchise timeline, recommendations.

## Fuentes de metadata y arte

Tres fuentes vienen integradas en los editores — click **↗ SteamGridDB / ↗ AniList / ↗ MAL** al lado del campo de cover para buscar, elegir y auto-completar. El resto son referencia manual: abrís, copiás, pegás.

| Sitio | Ideal para | En la app |
| --- | --- | --- |
| [SteamGridDB](https://www.steamgriddb.com/) | Games — covers, banners, logos, heroes | **↗ Integrado** (necesita API key gratis, ver Settings → Data → Integrations) |
| [AniList](https://anilist.co/) | Anime, Donghua, Manga, Manhwa, Manhua — metadata + cover + banner | **↗ Integrado** (sin API key) |
| [MyAnimeList](https://myanimelist.net/) vía [Jikan](https://jikan.moe/) | Anime y Manga — metadata, cover, autores, magazine | **↗ Integrado** (sin API key) |
| [IGDB](https://www.igdb.com/) | Games — metadata (developers, publishers, fechas, géneros) | Referencia manual |
| [VGMdb](https://vgmdb.net/) | Música — soundtracks de videojuegos y ediciones japonesas | Referencia manual |
| [MusicBrainz](https://musicbrainz.org/) | Música — metadata general (artistas, sellos, tracklists) | Referencia manual |
| [Rate Your Music](https://rateyourmusic.com/) | Música — géneros, discografías, ratings | Referencia manual |
| [IMDb](https://www.imdb.com/) | Movies y Series — metadata (cast, directores, guionistas, fechas) | Referencia manual |
| [Movie Poster DB](https://movieposterdb.com/) | Movies, Series y Anime — posters en alta (requiere cuenta) | Referencia manual |
| [Douban](https://m.douban.com/home_guide) | IMDb chino — clave para donghua, C-dramas y cine asiático | Referencia manual |
| [AniDB](https://anidb.net/) | Anime — metadata profunda (staff, episodios, relaciones) | Referencia manual — la API existe pero pide registro de cliente + rate-limit duro de 2s |

**Import masivo**: ¿ya venías trackeando anime/manga en otro lado? Settings → Data → **Import MAL / AniList XML** carga un export entero de una. Funciona con el export nativo de MyAnimeList y con el exportador AniList de [malscraper.azurewebsites.net](https://malscraper.azurewebsites.net/).

¿Conocés otro sitio que valga la pena integrar? Abrí un issue o un PR.

## Interfaz

- **6 temas**: Dark (default), Light, Dark AMOLED, Nord, Gruvbox, Solarized Dark. Via `data-theme`.
- **8 accents independientes**: theme default, amber, red, blue, green, purple, teal, pink. Via `data-accent`.
- **Density**: Comfortable / Compact (reduce paddings y font-sizes).
- **Font size**: Small / Medium / Large (zoom global).
- **Sidebar**: Full (216 px) / Icons only (60 px).
- **Motion**: On / Reduced (respeta `prefers-reduced-motion` del SO + override manual).
- **Startup**: última categoría vista o siempre la primera.
- **Layouts**: List / Grid / Compact + orden manual por arrastre.
- **Onboarding**: modal de bienvenida en el primer arranque que permite elegir qué librerías activar (editable después desde Settings → Libraries).

## Settings

Organizado en tabs:
- **Appearance**: Theme, Accent, Density, Font size, Sidebar mode, Default view, Motion.
- **Behavior**: Confirm before deleting, Startup category.
- **Libraries**: Toggles individuales para cada una de las 9 categorías.
- **Card Fields**: qué campos mostrar en las cards por categoría (Games, Music, Manga/etc., Movies, Anime, Series).
- **Data**: Export / Import backup JSON, snapshots automáticos (5 rotados con restore de 1 click), Find similar titles (detector de duplicados fuzzy), Import from MyAnimeList / AniList XML, Export as HTML (site estático shareable), Yearly wrapped (recap del año), API key de SteamGridDB, Reset settings to defaults, Delete all data, About.

## Estadísticas por categoría

Todas las categorías tienen distribución de status (pie/bar), un **heatmap anual estilo GitHub** basado en fechas de completado, top rated, y actividad de "completados por mes". Además:

- **Games**: Top developers, Top publishers, Top platforms, Top genres.
- **Music**: Top artists, Top genres, Top labels, Listens per month.
- **Movies**: Movies watched per month, Top directors, Top actors, Top genres.
- **Anime & Donghua**: Episodes watched per month, Top studios, Total watch time (cross-agrega ambas sub-bibliotecas).
- **Series**: Episodes watched per month, Top networks, Top actors, Total watch time.
- **Manga/Manhwa/Manhua/Comics**: Chapters read per month, Top authors, Top artists, Top magazines.

**Yearly wrapped** (Settings → Data) resume cualquier año punta a punta: totales por categoría, horas jugadas, episodios vistos, capítulos leídos, rating promedio, mes más activo, top 5 rated, top devs / studios / genres.

## Funciones transversales

- **Tags** libres por ítem.
- **Groups**: colecciones propias del usuario dentro de cada categoría, con reordenamiento manual por arrastre. **Cada grupo puede tener su portada personalizada** (click en el ✎ de la card).
- **Buscador** por título en la librería actual (Ctrl+F) y **búsqueda global** en todas las categorías + artistas (Ctrl+K) — command palette con navegación por teclado.
- **Acciones masivas**: Shift+click en cards para seleccionar varias. Aparece una pill flotante con cambiar status, agregar/quitar tag, agregar a grupo, borrar — todo con un solo confirm.
- **Undo / redo** para cada mutación de la librería: Ctrl+Z / Ctrl+Shift+Z (o Ctrl+Y). 40 pasos de historia in-memory cubriendo items, grupos y artistas.
- **Filtros** por tags + específicos por categoría (status, plataforma, género).
- **Órdenes**: alfabético, más reciente, rating, y órdenes específicos por categoría (tiempo jugado, fecha, status, manual, por artista, duración, episodios vistos, capítulos leídos).
- **Related items**: sistema manual de linkeo entre ítems de la misma categoría con set completo de tipos de relación — sequel, prequel, side story, spin-off, standalone expansion, DLC/expansión, remake, remaster, reboot, port, alt version, same collection, same series, same universe, crossover, adaptation, other. Clickeable en la ficha. Se muestra como grid de covers.
- **Franchise timeline**: auto-derivado — ítems que comparten el mismo campo `franchise` se ordenan cronológicamente en una fila scrolleable. Clickeable.
- **Recommendations**: lista manual sin tipo de relación. Grid de covers.
- **Review con spoilers**: campo dedicado separado de notas, con toggle "Contains spoilers / No spoilers" — al abrir la ficha aparece un botón "Show spoilers" que hay que clickear para revelar.
- **Rewatch/Reread/Replay/Listen history**: log completo con fecha, rating y notas por sesión.
- **Toast** de confirmación al guardar.
- **Esc** cierra cualquier modal, panel o vista de detalle abierta.
- **"Don't ask again"** en confirmaciones de borrado.
- **Empty states** con icono + CTA cuando la categoría está vacía; variante para cuando los filtros dejan la lista vacía.
- **Scroll con top fijo**: la barra superior de cada vista queda pinneada al top y solo el contenido de abajo scrollea. Layout basado en flex (no sticky con offsets), sin gaps ni content bleeding. Lo que queda fijo depende de la vista:
  - **Library items**: header + tabs (All X / Groups) + toolbar (search / sort / filters) fijos, solo la lista scrollea.
  - **Library groups / artists**: header + tabs fijos, el grid de folders scrollea.
  - **Boards por status**: header (+ toolbar en Games) fijos, la lista scrollea.
  - **Statistics / Settings**: solo el header fijo — las tabs de categoría/settings + contenido scrollean juntos.
- **Editor con footer fijo**: Delete, Cancel y Save siempre visibles mientras scrolleás el formulario — nunca enterrados abajo del todo.
- **Virtualización**: las cards fuera de pantalla usan `content-visibility: auto` para que scrollear una grid de 500+ items siga siendo fluido.

## Storage y portabilidad

**Archivos**:
```
Omnio-0.1.7-portable.exe   ← el ejecutable
data/
  videojuegos.json          ← items con categoryId 'videojuegos'
  musica.json               ← items con categoryId 'musica'
  peliculas.json            ← …un archivo por categoría
  series.json
  anime.json
  donghua.json
  manga.json
  manhwa.json
  manhua.json
  comics_west.json
  collections.json          ← grupos
  artists.json              ← perfiles de artistas
  settings.json             ← preferencias
  customOrders.json         ← órdenes manuales por categoría
  backups/
    1/  … 5/                ← 5 snapshots rotativos (dir por save)
assets/                     ← imágenes locales
  anime/cover/
  videojuegos/cover/
  videojuegos/banner/
  videojuegos/logo/
  peliculas/cover/
  peliculas/banner/
  musica/cover/
  series/cover/
  manga/cover/
  manga/volume/
  artists/photo/
  ...
```

**Cómo funciona**:
- Al empaquetarse como portable, `data/` y `assets/` viven en la misma carpeta que el `.exe` (via `PORTABLE_EXECUTABLE_DIR` en Windows).
- **Storage por slice** (0.1.7+): cada librería es su propio archivo `.json` — editar un juego solo reescribe `videojuegos.json`, no todo lo demás. Cada save hashea el contenido, así que las slices sin cambios se saltean. Si un archivo se corrompe, el resto queda intacto.
- **Migración automática**: al primer boot de 0.1.7+, si venías con el `data.json` legacy, se hace el split a `data/` automáticamente y el original se renombra a `data.pre-split.json` como red de seguridad.
- Cuando subís una imagen desde tu PC, se decodifica y se escribe a disco en `assets/{categoría}/{tipo}/{uuid}.{ext}`. Los `.json` solo guardan el path relativo — nada de data URLs pesados embebidos.
- Un custom protocol `omnio-asset://` sirve las imágenes al renderer con guard anti-path-traversal.
- **Backups rotativos**: cada save que realmente cambia algo rota el anillo de snapshots — slot 1 recibe una copia fresca del directorio actual, slots 2-5 bajan uno, el quinto se descarta. Restaurás cualquiera desde Settings → Data → Automatic snapshots; la librería actual se copia a `data.pre-restore/` primero, así nada se destruye jamás.
- **Site export**: Settings → Data → Export as HTML elige una carpeta, escribe un `index.html` autocontenido y copia tu carpeta `assets/` al lado. Mandás la carpeta como está y se abre en cualquier navegador.

**Portable de verdad**: podés meter la carpeta completa en un pendrive y llevarlo. Toda tu data + imágenes viajan con el ejecutable.

## Identidad visual

- Paleta base amber sobre superficie oscura (dark theme por default), light y 4 temas alternativos más.
- Iconografía lineal propia sin emojis — categorías, status de Games/Manga/Anime/Series, navegación. Símbolos tipográficos monocromo (`✓ ★ → ✎ ⧉ ←`) sí se usan.
- Radios progresivos: 6 px (chico), 10 px (medio), 16 px (grande).
- Focus rings con glow via `box-shadow`.
- Logo: anillo con estrella de 4 puntas centrada — el anillo simboliza "una biblioteca que contiene todo", la estrella simboliza el rating/pasión por los hobbies.

## Desarrollo

```bash
git clone https://github.com/TonyMontania/Omnio.git
cd Omnio
npm install
npm run dev          # dev con hot reload
npm run build        # empaqueta portable en release/{version}/
npm run lint
```

Requiere Node 18+ (para `crypto.randomUUID` en el bundler) y Windows para el build portable (electron-builder). En Mac/Linux se puede correr en dev pero el target de build está pensado para Windows portable — se puede extender editando `electron-builder.json5`.

### Estructura del código

```
electron/                proceso principal de Electron + IPC
public/                  assets estáticos (logos, iconos)
build/                   iconos generados para empaquetar
scripts/                 scripts de build (generación del .ico)
src/
├── App.tsx              componente raíz (state + vistas)
├── App.css              re-exporta styles/*.css
├── styles/              tokens, base, sidebar, layout, forms, cards, panels, detail, insights, settings
├── types/               entities, options, helpers (barrel index.ts)
├── insights/            stats.ts + DistChart.tsx
├── components/editors/  15 subcomponentes de edición reusables
├── *DetailModal.tsx     una ficha de detalle por categoría
├── ArtistDetailView.tsx perfil de artista de música
├── ItemCard.tsx         card genérica de listado
├── StarRating.tsx       componente de estrellas con medio punto
├── icons.tsx            iconografía inline SVG
└── categories.ts        metadata de las 9 categorías
```

Hay una referencia detallada de cada campo por categoría en [`docs/FIELDS.md`](docs/FIELDS.md).

## Contribuir

Los PRs son bienvenidos. Por favor:

1. Abrí un issue primero si querés discutir un cambio grande.
2. Mantené los cambios chicos y enfocados. Una cosa por PR.
3. `npm run lint` y `tsc --noEmit` tienen que pasar limpio.
4. Probá con `npm run dev` antes de mandar el PR.

La app tiene un scope acotado a propósito: un solo usuario, local, tracker de hobbies. Features que requieran red, cuentas o sync entre dispositivos están fuera de scope salvo que sean opt-in y sigan siendo locales por default.

## Licencia

[MIT](LICENSE) — libre para forkear, modificar y distribuir.
