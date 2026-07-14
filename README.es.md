# Omnio

<img src="public/omnio-logo.svg" width="80" align="right" alt="Logo de Omnio">

[![Licencia: MIT](https://img.shields.io/badge/License-MIT-c9a227.svg)](LICENSE)
![Plataforma: Windows](https://img.shields.io/badge/platform-Windows-informational.svg)
![Local-first](https://img.shields.io/badge/local--first-yes-success.svg)

[English](README.md) · **Español**

**Omnio** es una aplicación de escritorio local-first para trackear tus hobbies — videojuegos, música, películas, series, anime, donghua, manga, manhwa, manhua y cómics occidentales — todo en un solo lugar. Sin cuentas, sin telemetría, sin nube. Tus datos viven en `data.json` y `assets/` al lado del ejecutable, así que es lo suficientemente portable para llevarla en un pendrive.

La interfaz está en inglés. Para una referencia de campo por campo en inglés y español, ver [`docs/FIELDS.md`](docs/FIELDS.md).

## Stack técnico

- **Electron 30** + **React 18** + **Vite 5** + **TypeScript 5**
- Proceso principal en `electron/`, interfaz en `src/`
- Guardado local: un único `data.json` + carpeta `assets/` con las imágenes por categoría/tipo
- Sin backend, sin APIs externas
- Tipografías: Fraunces (display) + Inter (cuerpo) + IBM Plex Mono (etiquetas/datos)

## Categorías

### Games (Videojuegos)
Ficha estilo infinitebacklog: banner + logo, cover, descripción, developers/publishers (varios), **plataformas libres** (creás las que quieras, con sugerencias y autocompletado), ownership, status (Backlog / Playing / Played / Completed / Dropped), tiempo jugado, rating (medio punto), logros desbloqueados/totales, DLC/Expansions y Addons con status propio, notas mini-markdown, tags. **Extendido**: alternative titles, source (Original/Remake/Remaster/Port/Sequel/Spin-off), age rating ESRB, franchise, review con toggle de spoilers, replay history, related games con tipo de relación, franchise timeline auto, recommendations.

### Music (Música)
Fichas por tipo (Single / EP / Album / OST / Live / Recopilation), tracklist con rating por track, favorito, listened y **botón de Lyrics por canción** (modal para leer/editar la letra). Duración total auto (formatos álbum-like). Perfil de Artista estilo Spotify: banner + avatar circular, discografía cronológica, rating promedio. Collections Listened / Not listened. **Extendido**: alternative titles, source (Original/Compilation/Soundtrack/Remaster/Deluxe/Reissue), producers, review con spoilers, listen history, related albums, recommendations.

### Movies (Películas)
Directors, cast, franchise, watched + rewatch count, review con toggle de spoilers, backdrop image. **Extendido**: alternative titles, source (Original/Book/Comic/Game/True story/Remake/Sequel), content rating, watched where, rewatch history log completo, related movies, franchise timeline, recommendations.

### Series
Ficha propia estilo Anime — cast, directors, showrunners, writers, network, country, language, content rating. **Lista de temporadas** anidada con episodios opcionales por temporada (número/título/año/eps totales, watched, rating, notas). Migración automática desde el sistema viejo de `units[]` checklist. Related series, franchise timeline, recommendations, rewatch history, review con spoilers.

### Anime & Donghua
Grupo colapsable en la sidebar con dos sub-bibliotecas independientes (**Anime** y **Donghua**) que comparten la misma ficha estilo AniList/MAL: studios, formato (TV/Movie/OVA/ONA/Special/Music Video), airing status, season + año, demographic, watch status (Plan to watch / Watching / Completed / Paused / Dropped), episodios vistos/totales, fechas inicio/fin, rating, notas. **Extendido**: alternative titles, source (Manga/Light novel/Web novel/Novel/Original/Game/Visual novel), age rating ESRB, ep. duration + total runtime auto, aired from/to range, favorite episode + nota, dropped-at info condicional, **lista de episodios** con watched/rating/filler/notes, review con spoilers, rewatch history, related con tipo de relación, franchise timeline, recommendations.

### Comics & Manga
4 sub-bibliotecas independientes (Manga, Manhwa, Manhua, Western Comics) con ficha compartida estilo AniList/MAL: authors + artists, géneros, publication status, reading status, capítulos y volúmenes leídos/totales, volume covers en galería, rating, notas. **Extendido**: alternative titles, source, age rating ESRB, magazine/serialization, **lista de capítulos** con read/rating/notas, review con spoilers, reread history, related manga con tipo de relación, franchise timeline, recommendations.

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
- **Data**: Export / Import backup JSON, Reset settings to defaults, Delete all data, About.

## Estadísticas por categoría

Todas las categorías tienen distribución de status (pie/bar), top rated, y actividad de "completados por mes". Además:

- **Games**: Top developers, Top publishers, Top platforms, Top genres.
- **Music**: Top artists, Top genres, Top labels, Listens per month.
- **Movies**: Movies watched per month, Top directors, Top actors, Top genres.
- **Anime & Donghua**: Episodes watched per month, Top studios, Total watch time (cross-agrega ambas sub-bibliotecas).
- **Series**: Episodes watched per month, Top networks, Top actors, Total watch time.
- **Manga/Manhwa/Manhua/Comics**: Chapters read per month, Top authors, Top artists, Top magazines.

## Funciones transversales

- **Tags** libres por ítem.
- **Groups**: colecciones propias del usuario dentro de cada categoría, con reordenamiento manual por arrastre.
- **Buscador** por título (Ctrl+F).
- **Filtros** por tags + específicos por categoría (status, plataforma, género).
- **Órdenes**: alfabético, más reciente, rating, y órdenes específicos por categoría (tiempo jugado, fecha, status, manual, por artista, duración, episodios vistos, capítulos leídos).
- **Related items**: sistema manual de linkeo entre ítems de la misma categoría con tipo de relación (sequel, prequel, side story, spin-off, alt version, adaptation, other). Clickeable en la ficha. Se muestra como grid de covers.
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

## Storage y portabilidad

**Archivos**:
```
Omnio-0.1.0-portable.exe   ← el ejecutable
data.json                   ← toda la data
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
- Al empaquetarse como portable, `data.json` y `assets/` viven en la misma carpeta que el `.exe` (via `PORTABLE_EXECUTABLE_DIR` en Windows).
- Cuando subís una imagen desde tu PC, se decodifica y se escribe a disco en `assets/{categoría}/{tipo}/{uuid}.{ext}`. En el `data.json` queda solo el path relativo — nada de data URLs pesados embebidos.
- Un custom protocol `omnio-asset://` sirve las imágenes al renderer con guard anti-path-traversal.
- **Migración automática**: la primera vez que abrís la app con esta versión y tenías covers/banners/logos guardados como data URLs, todos se extraen a disco automáticamente y el `data.json` se reescribe con paths relativos.

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
