# Historial de cambios

Versión en español de las notas de cada versión, la que muestra Omnio cuando la interfaz está en español. La referencia es [CHANGELOG.md](CHANGELOG.md), que también es el texto de cada [versión en GitHub](https://github.com/TonyMontania/Omnio/releases).

## v0.5.8 — 2026-10-27

### Novedades

- **Omnio en español.** Configuración → Apariencia → Idioma cambia toda la interfaz entre inglés y español. Las bibliotecas se ordenan alfabéticamente en el idioma que elijas y las fechas siguen su formato. Omnio se recarga una vez al cambiar.
- **Las actualizaciones se instalan solas.** Cuando sale una versión nueva, Omnio descarga la que corresponde a cómo la instalaste, la verifica con el SHA-256 que GitHub publica para cada archivo, la instala y se vuelve a abrir: instalador de Windows, MSI, ZIP portable, app de macOS, AppImage, `.deb` y `.rpm`. Si la descarga no coincide, se borra y nunca se instala. Esto funciona desde la 0.5.8, así que la actualización a la 0.5.8 todavía usa el método anterior.
- **Próximo episodio de lo que está en emisión.** Las tarjetas de anime y donghua muestran el próximo episodio y cuánto falta para que salga, según AniList. El calendario de lanzamientos también muestra los próximos episodios exactos: de AniList para anime y de TMDb para series (con tu clave de TMDb).
- **Notificaciones de escritorio para episodios nuevos** de los animes, donghuas y series que estás viendo, mientras Omnio está abierto. Se activan en Configuración → Comportamiento.
- **Explorar la temporada en AniList** desde el tablero Esta temporada y agregar series directamente desde ahí.
- **Importar una lista pública de VNDB** en Novelas Visuales. Los estados salen de tus etiquetas de VNDB y los votos se convierten en estrellas; las novelas visuales que ya tienes se asocian por id de VNDB o por título y solo reciben tu estado, calificación y fechas.
- **Archivo de configuración.** Configuración → Datos → Importar y compartir exporta tu tema, el diseño del Inicio, los campos de las tarjetas, los atajos, las plantillas, los campos personalizados, el árbol de etiquetas y las listas inteligentes a un archivo que puedes importar en otra computadora. Las claves de API quedan afuera salvo que las pidas.
- **Fotos y banners de artistas desde Deezer y TheAudioDB.** "Buscar en línea" en el editor de artistas muestra las imágenes de los dos sitios y guarda la que elijas con tu biblioteca.
- **Nuevos widgets en el Inicio:** Agregados hace poco, Fijados (clic derecho en cualquier tarjeta → Fijar en el Inicio) y 1cc recientes de Arcade. Cada widget se puede limitar a las bibliotecas que elijas, y el menú Agregar widget muestra un pequeño dibujo de cada uno. El Inicio también abre con un saludo corto sobre algo de tu biblioteca.
- **Tiempo invertido por biblioteca** al principio de Estadísticas.
- **Gráfico de progreso de puntajes** para cada juego de Arcade.
- **Barra de título con el estilo de la app** en Windows y Linux: minimizar, maximizar y cerrar están en la barra superior de Omnio en lugar del marco del sistema.
- **Actualizaciones delta del AppImage.** El AppImage incluye su información de actualización y cada versión publica un archivo `.zsync`, así AppImageUpdate y Gear Lever pueden actualizarlo.

### Cambios

- **Nuevo diseño en toda la app.** Cada biblioteca tiene una barra superior de una sola fila con búsqueda, filtros por estado, opciones de vista y acciones; las tarjetas priorizan la portada y muestran un punto de estado; cada página de detalle, incluidos artistas y juegos de Arcade, abre con un banner, la portada, datos rápidos y pestañas. El editor tiene pestañas con vista previa en vivo de la tarjeta y del detalle, y **Ctrl+S** guarda desde cualquier pestaña. Inicio, Calendario de lanzamientos, Listas, Estadísticas, Al azar, Agregado rápido, Buscar, Configuración, Esta temporada, Kanban, Diario, Línea de tiempo, las ventanas de diálogo y las listas inteligentes siguen el mismo diseño.
- **Íconos de línea en lugar de emojis** en toda la interfaz.
- **Las portadas de los grupos muestran el logo completo.** Los logos anchos o altos quedan centrados con margen sobre un fondo difuminado en lugar de recortarse; las portadas cuadradas con fondo propio ocupan todo el cuadro.
- **Se quitó HowLongToBeat.** Ya no están su búsqueda, su importador, su campo en el editor ni sus opciones de orden, y se quitan los tiempos de HowLongToBeat guardados en tus juegos.

### Correcciones

- **Abrir carpeta y Mostrar en la carpeta abren la carpeta correcta en Windows.** Antes abrían Documentos en lugar de la carpeta pedida.
- **La barra de desplazamiento se ve en la densidad compacta.**
- **El borde superior del resaltado de las tarjetas** se cortaba.
- **Los números de pista y de episodio ya no se cortan** en las listas de temas y de episodios; la columna se ensancha según la cantidad de dígitos.
- **Limpiar imágenes huérfanas conserva las imágenes de artistas y grupos.**
- **La vista previa del editor muestra valores legibles** ("Propio", "Original", "T (Adolescentes)") en lugar de los valores internos.
- **La pantalla de bienvenida explica dónde se guardan tus datos** para cada tipo de instalación.
