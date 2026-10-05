// Same reason as util.rs: several exports here (`TOP_SLICES`,
// `is_blob_kind`, `BACKUP_COUNT`, `asset_folder_for_category`, the
// `legacy_data_file` / `backups_dir` fields) land ahead of the
// handlers that need them — data.ts port (Fase B step 4) is the
// first caller for most of them. Silence until then.
#![allow(dead_code)]

// Filesystem layout — Rust port of `electron/paths.ts`.
//
// The Electron file evaluates `getStorageRoot()` at module load, when
// `electron.app` already knows the userData / packaged dir. Rust can't
// do that: nothing about `AppHandle` is ready until Tauri's setup
// callback runs. We solve it with a global `OnceLock<Paths>` set from
// `main()`'s `.setup(|app| paths::init(app.handle()))`, then every
// downstream call reads `paths::get()` — the same "single source of
// truth, initialized once" contract the TS version offers, just made
// explicit by Rust's lifetime rules.
//
// The category-id table and per-category filename map are `const`
// tuples of `&'static str` — the closest analog to the TS
// `as const` tuples. Anywhere we iterate categories (data.ts today,
// storage.ts next) reads them from here.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

// -- The 12 category ids -------------------------------------------
//
// Mirrors CATEGORY_IDS in electron/paths.ts. Kept in the same order
// the TS side lists them so per-slice save/load loops write files in a
// consistent, diff-friendly sequence.
pub const CATEGORY_IDS: &[&str] = &[
    "videojuegos", "musica", "peliculas", "series",
    "anime", "donghua",
    "manga", "manhwa", "manhua", "comics_west",
    "libros",
    "visual_novels",
];

// Category id → on-disk filename stem. Mirrors CATEGORY_FILENAME in
// electron/paths.ts. Not every id has an English alias (donghua,
// manga, manhua stay as-is); the fallback in `file_for_category`
// returns the id verbatim for those.
pub fn category_filename(cat: &str) -> &'static str {
    match cat {
        "videojuegos"   => "games",
        "musica"        => "music",
        "peliculas"     => "movies",
        "anime"         => "anime",
        "donghua"       => "donghua",
        "series"        => "series",
        "manga"         => "manga",
        "manhwa"        => "manhwa",
        "manhua"        => "manhua",
        "comics_west"   => "comics_west",
        "libros"        => "books",
        "visual_novels" => "visual_novels",
        // Unknown category id — return an empty stem so the caller's
        // `.json` suffix becomes an invalid filename it will refuse
        // to write. Matches the "?? cat" fallback in the TS side in
        // spirit: unknown categories don't crash, they just don't
        // participate in the split-file layout.
        _ => "",
    }
}

pub fn file_for_category(cat: &str) -> String {
    let stem = category_filename(cat);
    if stem.is_empty() {
        format!("{cat}.json")
    } else {
        format!("{stem}.json")
    }
}

// assets/ folder names use the same alias map — legacy migrations
// (`renameLegacyAssetFolders` on the TS side) rely on the two staying
// identical so a folder rename doesn't strand JSON paths.
pub fn asset_folder_for_category(cat: &str) -> &'static str {
    category_filename(cat)
}

// Top-level slices persisted at `data/<name>.json` alongside the
// per-category shards. Mirrors TOP_SLICES in electron/paths.ts.
pub const TOP_SLICES: &[&str] = &[
    "collections", "artists", "settings", "customOrders", "arcadeGames", "smartLists", "playlists",
];

// Kinds of asset blobs that live under
// `assets/<category>/<kind>/<title>/<filename>` — mirrors
// ASSET_BLOB_KINDS in electron/paths.ts. Used by images.ts / storage.ts
// (not ported yet) to distinguish opaque uploads from re-encoded covers.
pub fn is_blob_kind(kind: &str) -> bool {
    matches!(kind, "saves" | "screenshots")
}

pub const BACKUP_COUNT: usize = 5;

// -- Resolved paths ------------------------------------------------

pub struct Paths {
    /// Root the user's data lives under. Mirrors STORAGE_ROOT in
    /// electron/paths.ts.
    pub storage_root: PathBuf,
    /// Legacy pre-0.1.7 monolithic data file. Kept so the split-file
    /// migrator (data.ts port) can spot and rename it once.
    pub legacy_data_file: PathBuf,
    /// Where downloaded / uploaded assets live. Served to the renderer
    /// via the `omnio-asset://` protocol (Tauri side will register the
    /// same protocol during data.ts / images.ts port).
    pub assets_root: PathBuf,
    /// Where per-category JSON shards live.
    pub data_dir: PathBuf,
    /// Rotating snapshot slots (5) under `data_dir/backups/N/`.
    pub backups_dir: PathBuf,
}

impl Paths {
    fn from_root(storage_root: PathBuf) -> Self {
        let data_dir = storage_root.join("data");
        let backups_dir = data_dir.join("backups");
        Self {
            legacy_data_file: storage_root.join("data.json"),
            assets_root: storage_root.join("assets"),
            data_dir,
            backups_dir,
            storage_root,
        }
    }
}

pub enum WindowsInstall {
    Msi,
    Nsis,
    Winget,
}

pub fn windows_install_kind(exe: &Path) -> Option<WindowsInstall> {
    let p = exe.to_string_lossy().to_lowercase().replace('/', "\\");
    if p.contains("\\program files\\") || p.contains("\\program files (x86)\\") {
        Some(WindowsInstall::Msi)
    } else if p.contains("\\appdata\\local\\programs\\") {
        Some(WindowsInstall::Nsis)
    } else if p.contains("\\appdata\\local\\microsoft\\winget\\") {
        Some(WindowsInstall::Winget)
    } else {
        None
    }
}

fn is_dev_binary(exe: &Path) -> bool {
    exe.components().any(|c| c.as_os_str() == "target")
}

fn portable_dir() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("PORTABLE_EXECUTABLE_DIR") {
        if !dir.is_empty() {
            return Some(PathBuf::from(dir));
        }
    }
    if !cfg!(target_os = "windows") {
        return None;
    }
    let exe = std::env::current_exe().ok()?;
    if is_dev_binary(&exe) || windows_install_kind(&exe).is_some() {
        return None;
    }
    exe.parent().map(Path::to_path_buf)
}

// Only the Windows portable ZIP keeps its library next to the executable.
// Installed builds live in folders that are read-only (Program Files,
// /usr/bin, a mounted AppImage), replaced on update (Omnio.app) or wiped
// on uninstall, so they use the OS app-data directory instead.
fn compute_storage_root(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = portable_dir() {
        return Ok(dir);
    }
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

// Builds up to 0.5.6 stored the library next to the executable on every
// platform. Move it into the app-data root the first time a newer build
// starts, unless that root already holds a library.
pub async fn migrate_from_install_dir(root: &Path) {
    let Ok(exe) = std::env::current_exe() else { return };
    let Some(old_root) = exe.parent() else { return };
    if old_root == root || is_dev_binary(&exe) {
        return;
    }
    let old_data = old_root.join("data");
    if tokio::fs::metadata(&old_data).await.is_err() || tokio::fs::metadata(root.join("data")).await.is_ok() {
        return;
    }
    if let Err(e) = tokio::fs::create_dir_all(root).await {
        eprintln!("[paths] cannot create {}: {e}", root.display());
        return;
    }
    for name in ["data", "assets"] {
        let src = old_root.join(name);
        if tokio::fs::metadata(&src).await.is_err() {
            continue;
        }
        let dst = root.join(name);
        if tokio::fs::rename(&src, &dst).await.is_ok() {
            continue;
        }
        if let Err(e) = crate::util::copy_dir_recursive(&src, &dst).await {
            eprintln!("[paths] moving {} failed: {e}", src.display());
            if name == "data" {
                let _ = tokio::fs::remove_dir_all(&dst).await;
                return;
            }
        }
    }
    eprintln!("[paths] moved library from {} to {}", old_root.display(), root.display());
}

// -- Init + accessor ----------------------------------------------

static PATHS: OnceLock<Paths> = OnceLock::new();

/// Called once from `main()`'s `.setup(...)` callback. Panics if
/// invoked twice — the app has exactly one storage root for its
/// lifetime and re-initializing would silently strand cached hashes
/// and file handles.
pub fn init(app: &AppHandle) -> Result<(), String> {
    let root = compute_storage_root(app)?;
    let paths = Paths::from_root(root);
    PATHS.set(paths).map_err(|_| "paths::init called twice".to_string())
}

/// Returns the singleton. Panics if called before `init()` — that's a
/// programming error (a handler running before setup), not a runtime
/// condition we want to defend against on every call.
pub fn get() -> &'static Paths {
    PATHS.get().expect("paths::get called before paths::init")
}
