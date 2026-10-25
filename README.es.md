<div align="center">

<img src="public/omnio-logo.svg" width="96" alt="Logo de Omnio">

# Omnio

[English](README.md) · **Español**

**Todos tus pasatiempos en una sola app que vive en tu computadora.**

Juegos · Música · Películas · Series · Anime · Donghua · Manga · Manhwa · Manhua · Cómics · Libros · Novelas Visuales

[![Descargar](https://img.shields.io/badge/Descargar-última%20versión-c9a227?style=for-the-badge)](https://github.com/TonyMontania/Omnio/releases/latest)

[![Última versión](https://img.shields.io/github/v/release/TonyMontania/Omnio?color=c9a227&label=versión)](https://github.com/TonyMontania/Omnio/releases/latest)
[![Fecha](https://img.shields.io/github/release-date/TonyMontania/Omnio?color=c9a227&label=publicada)](https://github.com/TonyMontania/Omnio/releases/latest)
[![Descargas](https://img.shields.io/github/downloads/TonyMontania/Omnio/total?color=c9a227&label=descargas)](https://github.com/TonyMontania/Omnio/releases)
[![Tests](https://github.com/TonyMontania/Omnio/actions/workflows/test.yml/badge.svg)](https://github.com/TonyMontania/Omnio/actions/workflows/test.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-c9a227)](LICENSE)

![Plataformas: Windows · macOS · Linux](https://img.shields.io/badge/plataformas-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-informational)
![Local](https://img.shields.io/badge/local-sin%20cuenta%20%C2%B7%20sin%20telemetría-success)
[![Hecho con Tauri](https://img.shields.io/badge/hecho%20con-Tauri%202-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![Estrellas en GitHub](https://img.shields.io/github/stars/TonyMontania/Omnio?style=social)](https://github.com/TonyMontania/Omnio/stargazers)

</div>

- **12 bibliotecas, una sola app**: no más un sitio distinto para cada pasatiempo.
- **Metadatos con un clic desde 14 fuentes**: portadas, descripciones, listas de temas, reparto, etiquetas.
- **Tuyo y sin conexión**: sin cuentas, sin nube, sin telemetría. Tu biblioteca es una carpeta de archivos JSON que te pertenece.

<p align="center">
  <img width="1280" height="720" alt="Agregar un juego: buscar en IGDB, aplicar los metadatos y la portada, guardar" src="https://github.com/user-attachments/assets/79944c47-09fe-4747-b103-98f8f550fa03" />
</p>

## Contenido

- [Instalación](#instalación)
- [Cómo se ve](#cómo-se-ve)
- [¿Por qué Omnio?](#por-qué-omnio)
- [Funciones](#funciones)
- [Fuentes de metadatos](#fuentes-de-metadatos)
- [Almacenamiento](#almacenamiento)
- [Atajos de teclado](#atajos-de-teclado)
- [Privacidad](#privacidad)
- [Créditos](#créditos)
- [Licencia](#licencia)

## Instalación

| Sistema | La forma más rápida |
| --- | --- |
| **Windows** | [Instalador `-setup.exe`](https://github.com/TonyMontania/Omnio/releases/latest), o el `.zip` portable |
| **macOS** | [`.dmg`](https://github.com/TonyMontania/Omnio/releases/latest): `aarch64` para Apple Silicon, `x64` para Intel |
| **Linux** | [`.AppImage`](https://github.com/TonyMontania/Omnio/releases/latest), `.deb` o `.rpm` |

Las versiones no están firmadas, así que Windows SmartScreen y macOS Gatekeeper muestran un aviso la primera vez que abres la app. Abajo están los detalles de cada paquete.

<details>
<summary><b>Windows: todos los paquetes</b></summary>

| Paquete | Archivo | Comando | Notas |
| --- | --- | --- | --- |
| **Instalador NSIS** | `Omnio_<version>_x64-setup.exe` | doble clic | Por usuario, sin permisos de administrador. La opción recomendada. |
| **Instalador MSI** | `Omnio_<version>_x64_en-US.msi` | `msiexec /i Omnio_<version>_x64_en-US.msi /qb` | Para despliegues con directivas de grupo / SCCM / Intune. |
| **ZIP portable** | `Omnio_<version>_windows-portable.zip` | descomprimir y ejecutar `omnio.exe` | Windows 10 21H2+ y todos los Windows 11 ya traen WebView2. En versiones más viejas instala una vez el [runtime Evergreen](https://developer.microsoft.com/microsoft-edge/webview2/); si no, `omnio.exe` se cierra enseguida sin abrir ninguna ventana. |
| **winget** | — | `winget install TonyMontania.Omnio` | Instala la versión NSIS. Disponible cuando el manifiesto llegue a [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs). |

Los datos se guardan en `%APPDATA%\com.omnio.app\` (la versión portable los guarda junto a `omnio.exe`).

</details>

<details>
<summary><b>macOS: todos los paquetes</b></summary>

| Paquete | Archivo | Comando | Notas |
| --- | --- | --- | --- |
| **DMG (Apple Silicon)** | `Omnio_<version>_aarch64.dmg` | arrastrar a Aplicaciones | Para Macs M1 / M2 / M3 / M4. |
| **DMG (Intel)** | `Omnio_<version>_x64.dmg` | arrastrar a Aplicaciones | Para Macs anteriores a Apple Silicon. |

La primera vez en macOS 14 Sonoma o anterior: clic derecho en **Abrir** → **Abrir**. En macOS 15 Sequoia ese atajo ya no existe, así que ejecuta una vez desde la Terminal:

```bash
xattr -cr /Applications/Omnio.app
open /Applications/Omnio.app
```

`xattr -cr` quita la marca de cuarentena que Gatekeeper le pone a la descarga. El mismo comando sirve en versiones anteriores de macOS si prefieres no usar el clic derecho.

Los datos se guardan en `~/Library/Application Support/com.omnio.app/`.

</details>

<details>
<summary><b>Linux: todos los paquetes</b></summary>

| Paquete | Archivo | Comando | Notas |
| --- | --- | --- | --- |
| **AppImage** | `omnio_<version>_amd64.AppImage` | `chmod +x omnio_<version>_amd64.AppImage && ./omnio_<version>_amd64.AppImage` | Universal. Debian / Ubuntu 22.04+ necesitan `libfuse2` (`sudo apt install libfuse2`). ¿Sin FUSE? Ejecútalo con `./omnio_<version>_amd64.AppImage --appimage-extract-and-run`. |
| **Paquete Debian** | `omnio_<version>_amd64.deb` | `sudo dpkg -i omnio_<version>_amd64.deb` | Debian, Ubuntu, Mint, Pop!_OS, elementary. |
| **Paquete RPM** | `omnio-<version>-1.x86_64.rpm` | `sudo dnf install ./omnio-<version>-1.x86_64.rpm` | Fedora, RHEL, CentOS Stream, Rocky, Alma, openSUSE. |
| **AUR** | — | `yay -S omnio-bin` (o tu ayudante de AUR) | Arch, Manjaro, EndeavourOS. Reempaqueta el `.deb` original. Próximamente. |

Los datos se guardan en `~/.local/share/com.omnio.app/`.

</details>

¿Quieres compilarla tú? Mira [CONTRIBUTING.md → Running locally](CONTRIBUTING.md#running-locally).

## Cómo se ve

<img width="1696" height="1000" alt="Omnio: panel de inicio" src="https://github.com/user-attachments/assets/824f474b-ce75-4266-a8af-faa594288dfb" />

*Panel de inicio: un tablero de widgets que puedes arrastrar, cambiar de tamaño y reordenar: lo que tienes en curso, lo que está en emisión, un carrusel de portadas, números grandes, un día como hoy y más.*

<img width="1919" height="1031" alt="Omnio: cuadrícula de la biblioteca" src="https://github.com/user-attachments/assets/e89e97e9-46ce-4400-8fb4-92cf627aecd7" />

*Cuadrícula de la biblioteca: navegación por portadas con estados, listas inteligentes, agrupación, orden, filtros y acciones en lote.*

![Omnio: editor con pestañas y vista previa en vivo](https://github.com/user-attachments/assets/ffba12f6-f3b2-44b2-a531-91d16c804204)
*Editor con pestañas (Resumen / Identidad / Progreso / Imágenes / Historial / Relacionados / Notas) con vista previa en vivo y metadatos con un clic desde 14 fuentes.*

## ¿Por qué Omnio?

| | Sitios de seguimiento | Planillas | **Omnio** |
| --- | :---: | :---: | :---: |
| Todos tus pasatiempos en un lugar | Un sitio por pasatiempo | ✓ | ✓ |
| Portadas y metadatos completados automáticamente | ✓ | — | ✓ |
| Funciona sin conexión | — | ✓ | ✓ |
| No necesita cuenta | — | ✓ | ✓ |
| Tus datos quedan en tu disco | — | ✓ | ✓ |
| Importa desde MAL, AniList, Steam, Letterboxd, Goodreads… | En parte | — | ✓ |
| Gratis y de código abierto | Depende | — | ✓ |

## Funciones

<table>
<tr>
<td width="33%" valign="top">

**Registrar**

- **12 bibliotecas**: Juegos · Música · Películas · Series · Anime · Donghua · Manga · Manhwa · Manhua · Cómics Occidentales · Libros · Novelas Visuales
- **Editor con pestañas** (Resumen / Identidad / Progreso / Imágenes / Historial / Relacionados / Notas) con vista previa en vivo de la tarjeta y del detalle
- **Vistas**: cuadrícula, lista, compacta, Kanban por estado, línea de tiempo por año de lanzamiento y un diario de lo que agregaste y terminaste
- **Campos personalizados** por biblioteca, en el editor y, si quieres, como etiqueta en la tarjeta
- **Acciones en lote**: selecciona varias tarjetas para cambiar estado, calificación, etiquetas o grupos, o moverlas a otra biblioteca
- **Jerarquía de etiquetas**: anida etiquetas (`jrpg → turn-based`); filtrar por la madre incluye todas sus descendientes
- **Calificación con medias estrellas**, de a 0,5
- **Plantillas de elementos**: guarda los valores que quieres precargados en cada categoría
- **Listas**: listas ordenadas que mezclan elementos de todas las bibliotecas

</td>
<td width="33%" valign="top">

**Descubrir**

- **Metadatos y portadas con un clic** desde 14 fuentes (ver abajo). Se guardan en caché local por 24 h
- **Agregado rápido** desde la barra lateral, o pega una URL de IGDB / TMDb / AniList / VNDB / Steam en el campo del título y el buscador se abre con los datos cargados
- **Búsqueda global (Ctrl+K)** en todas las bibliotecas, con operadores (`favorite:true`, `year:>2020`, `status:playing`)
- **Panel de inicio con widgets**: Sigue donde quedaste, En emisión, Esta semana, Carrusel de portadas, Números grandes, Un día como hoy, Distribución de calificaciones, Lo mejor del año, Géneros destacados, Elegir de tus pendientes y más. Arrastra, cambia el tamaño y agrega rápido desde la barra lateral
- **Calendario de lanzamientos**: próximos lanzamientos y fechas de emisión, exportable a iCal
- **Elegir al azar**: deja que Omnio elija lo próximo de tus pendientes
- **Línea de tiempo de franquicias** entre bibliotecas, por secciones o como diagrama libre
- **Estadísticas**: distribución por categoría + mapa de actividad, matriz de géneros entre bibliotecas, gráfico mensual de agregados y terminados, lo mejor calificado / artistas / géneros / sellos / desarrolladores / distribuidoras / plataformas
- **Sección Arcade**: seguimiento de puntajes y 1cc para shmups y juegos de arcade. El modo cuadrícula está adaptado de [doopu/1ccTracker](https://github.com/doopu/1ccTracker)

</td>
<td width="33%" valign="top">

**Tus datos son tuyos**

- **Totalmente local**: sin cuentas, sin telemetría, sin analíticas
- **Importar**: XML de MAL / AniList, Steam, Letterboxd, IMDb, Backloggd, Serializd, Spotify, RateYourMusic, subrayados de Kindle, Last.fm (CSV + sincronización por API), carpeta de música local, Trakt.tv, Discogs, StoryGraph, juegos instalados de Steam / GOG / Epic, Excel / CSV / Notion / TXT (las exportaciones de Playnite, GOG y Goodreads se reconocen solas)
- **Exportar**: sitio HTML estático (con búsqueda, claro/oscuro), XML de MAL, iCal del calendario de lanzamientos, CSV por categoría, imagen PNG del Resumen del año
- **Copias de seguridad rotativas**: 5 instantáneas automáticas por guardado, restaura la que quieras; copia programada opcional a una carpeta (Dropbox, OneDrive…)
- **Herramientas de limpieza**: buscar duplicados, unificar variantes de géneros y roles, revisar campos vacíos, arreglar portadas rotas, revisar qué álbumes te faltan de la discografía de un artista
- **Actualizador integrado**: revisa GitHub Releases y descarga la versión que corresponde
- **Proxy HTTP** para todas las solicitudes salientes
- **11 temas × 8 colores de acento**: Dark / Light / AMOLED / Nord / Tokyo Night / Solarized / Dracula / Catppuccin / Rosé Pine / Gruvbox / Everforest

</td>
</tr>
</table>

## Fuentes de metadatos

Haz clic en el botón **↗** del panel "Obtener metadatos" para buscar, elegir y completar automáticamente. Las claves de API (solo para las fuentes que las piden) van en **Configuración → Integraciones**. La tabla completa de qué campo completa cada fuente está en [`docs/FETCHER_FIELDS.md`](docs/FETCHER_FIELDS.md).

Las fuentes están agrupadas por la biblioteca que alimentan. Lo marcado como *Sin clave* funciona de entrada.

**Juegos**

| Fuente | Qué completa | Acceso |
| --- | --- | --- |
| [IGDB](https://www.igdb.com/) | Metadatos completos + tipo de obra deducido (Remake / Remaster / Port…) | Client ID + Secret de Twitch (gratis) |
| [SteamGridDB](https://www.steamgriddb.com/) | Portadas, banners, logos, imágenes principales | Clave de API gratuita |
| [PCGamingWiki](https://www.pcgamingwiki.com/) | Rutas de partidas guardadas y configuración por sistema | Sin clave |

**Películas y series**

| Fuente | Qué completa | Acceso |
| --- | --- | --- |
| [TMDb](https://www.themoviedb.org/) | Títulos, reparto, equipo, fondos, duración, temporadas + episodios | Clave de API gratuita |

**Anime y donghua**

| Fuente | Qué completa | Acceso |
| --- | --- | --- |
| [AniList](https://anilist.co/) | Metadatos completos, etiquetas, relaciones | Sin clave |
| [AniDB](https://anidb.net/) | Etiquetas con peso, referencias más precisas (pega el AID) | Nombre de cliente registrado |
| [Kitsu](https://kitsu.app/) | Clasificación por edad cuando AniList no la tiene | Sin clave |

**Manga · Manhwa · Manhua · Cómics Occidentales**

| Fuente | Qué completa | Acceso |
| --- | --- | --- |
| [AniList](https://anilist.co/) | Metadatos completos para manga y similares | Sin clave |
| [MangaDex](https://mangadex.org/) | Metadatos completos + ID de MangaDex para el enlace a "capítulos nuevos" | Sin clave |
| [Kitsu](https://kitsu.app/) | Alternativa para manga | Sin clave |
| [ComicVine](https://comicvine.gamespot.com/) | Cómics Occidentales (Marvel, DC, Image, independientes) | Clave de API gratuita |

**Música**

| Fuente | Qué completa | Acceso |
| --- | --- | --- |
| [MusicBrainz](https://musicbrainz.org/) + [Cover Art Archive](https://coverartarchive.org/) | Título, artista, lista de temas, productores, portada, selector de edición | Sin clave |
| [lrclib](https://lrclib.net/) | Letra de cada tema (sincronizada cuando existe) | Sin clave |
| [Last.fm](https://www.last.fm/) | Sincroniza tus álbumes más escuchados (marca como escuchados los que coinciden) | Clave de API gratuita + usuario |

**Libros**

| Fuente | Qué completa | Acceso |
| --- | --- | --- |
| [OpenLibrary](https://openlibrary.org/) | Título, autores, descripción, editorial, ISBN, portada | Sin clave |

**Novelas Visuales**

| Fuente | Qué completa | Acceso |
| --- | --- | --- |
| [VNDB](https://vndb.org/) | Descripción, alias, motor, etiquetas, capturas, personajes + equipo, portadas por región, relaciones | Sin clave |

## Almacenamiento

Tu biblioteca vive en dos carpetas dentro de la carpeta de datos de la app del sistema (o junto al ejecutable en la versión portable):

```
data/
  games.json  music.json  movies.json  series.json
  anime.json  donghua.json
  manga.json  manhwa.json  manhua.json  comics_west.json
  books.json  visual_novels.json
  collections.json  artists.json  arcadeGames.json
  smartLists.json  playlists.json
  settings.json  customOrders.json
  cache/searches.json    ← resultados de búsquedas de metadatos, válidos por 24 h
  backups/1..5/          ← 5 instantáneas rotativas
assets/
  <category>/<kind>/<filename>
  games/saves/<title>/…      ← partidas guardadas de cada juego
  games/screenshots/<title>/…
```

Cada biblioteca es su propio JSON: editar un juego solo reescribe `games.json`, así que si un archivo se daña, los demás quedan intactos. Los archivos de imágenes usan el título del elemento (`Hollow Knight cover.jpg`), así que la carpeta `assets/` se entiende al abrirla en el Explorador / Finder.

## Atajos de teclado

- **Ctrl+K**: búsqueda global en todas las bibliotecas
- **Ctrl+F**: buscar en la biblioteca actual
- **Ctrl+Z / Ctrl+Shift+Z** (o **Ctrl+Y**): deshacer / rehacer
- **Ctrl+H**: ir al Inicio
- **F5**: recargar los datos desde el disco
- **?**: guía completa de atajos
- **Clic derecho**: acciones rápidas en cualquier tarjeta
- **Shift + clic**: selección múltiple
- **Esc**: cerrar ventana / panel

Todos los atajos se pueden cambiar o desactivar en **Configuración → Atajos de teclado**.

## Privacidad

- **Sin cuentas, sin telemetría, sin analíticas.** No se envía nada a ningún servidor propio.
- **Solo hay conexiones cuando tú las inicias**: búsquedas de metadatos (una solicitud por cada búsqueda que haces) y la búsqueda de actualizaciones en GitHub Releases al abrir la app.
- **Las claves de API** que pegas en Configuración → Integraciones se guardan en `data/settings.json` en tu disco y solo se usan para las solicitudes a esa fuente.
- **Sin rastreadores de terceros** ni en la app ni en el sitio HTML exportado.

## Créditos

- **Arcade → modo cuadrícula** es una reimplementación de [doopu/1ccTracker](https://github.com/doopu/1ccTracker): el mismo lenguaje visual y las mismas marcas por celda (1cc / sin perder vidas / sin bombas / pacifista / todo completado / extra completado), integrado al modelo de datos de Omnio.

## Licencia

[MIT](LICENSE): puedes hacer forks, modificarla y distribuirla libremente.

---

<div align="center">

**Si Omnio te resulta útil, una ⭐ en el repositorio ayuda a que otras personas lo encuentren.**

</div>

- Errores / pedidos de funciones → [issues](https://github.com/TonyMontania/Omnio/issues)
- ¿Quieres colaborar? → [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Seguridad → [SECURITY.md](SECURITY.md)
- Referencia completa de cada campo → [`docs/FIELDS.md`](docs/FIELDS.md)
- Historial de cambios → [CHANGELOG.md](CHANGELOG.md) · [página de versiones](https://github.com/TonyMontania/Omnio/releases)
