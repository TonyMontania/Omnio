// Port of `electron/handlers/system.ts` — 6 misc host-integration
// commands. Each Rust command corresponds to exactly one
// `typedHandle('name', …)` on the Electron side; the docs above each fn
// point at the original for side-by-side diffing during the migration.
//
// Return shapes match `IpcContract` in `electron/contract.ts` byte for
// byte, so the renderer's `invoke()` helper doesn't care which backend
// answered — an { ok: true, path: '/x' } stays { ok: true, path: '/x' }
// whether it came from `dialog.showSaveDialog` or `dialog().save_file`.

use crate::net;
use crate::paths;
use crate::state::AppState;
use crate::util::{copy_dir_recursive, sanitize_asset_name};

use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tokio::sync::oneshot;

// -- Shared result shapes --------------------------------------------
//
// Same envelope the Electron handlers use: { ok } + payload or
// { ok: false, error/canceled }. Kept per-handler because each
// carries slightly different data on success and inventing one
// generic Envelope<T> only hides that.

#[derive(Serialize)]
#[serde(untagged)]
pub enum SimpleResult {
    Ok { ok: bool },
    Err { ok: bool, error: String },
}

impl SimpleResult {
    fn ok() -> Self {
        Self::Ok { ok: true }
    }
    fn err(msg: impl Into<String>) -> Self {
        Self::Err {
            ok: false,
            error: msg.into(),
        }
    }
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum PathResult {
    Ok { ok: bool, path: String },
    Canceled { ok: bool, canceled: bool },
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum CsvResult {
    Ok { ok: bool, path: String, count: usize },
    Err { ok: bool, error: String },
}

// -- proxy:apply -----------------------------------------------------
//
// Original: `electron/handlers/system.ts` line 18. Electron used
// `session.defaultSession.setProxy` to install the URL on every
// subsequent net request; here we just stash it in AppState. The
// reqwest client that will replace `electron/net.ts` (Fase B step 6)
// reads this on each call, so the effect stays the same as today.
// Sync (not `async fn`) because rebuilding the reqwest Client is a
// synchronous config operation and Tauri requires async commands with
// reference args to return Result. Delegates the actual work to net.rs
// so the proxy state (http_client) stays owned by one module.
#[tauri::command]
pub fn proxy_apply(url: Option<String>, state: State<'_, AppState>) -> SimpleResult {
    match net::apply_proxy_setting(&state, url.as_deref()) {
        Ok(()) => SimpleResult::ok(),
        Err(e) => SimpleResult::err(e),
    }
}

// -- cache:clear-searches --------------------------------------------
//
// Original: `electron/handlers/system.ts` line 26. Drops every entry
// from the (source, query) → hits map fetchers share. Fires from
// Settings → Maintenance → Clear cached searches.
// Async because net::clear_search_cache also unlinks the on-disk
// snapshot — the in-memory clear alone would leak stale entries on
// next boot. Result<_, ()> is a Tauri-shape requirement for async
// commands with reference args; the outer error variant never fires.
#[tauri::command]
pub async fn cache_clear_searches(state: State<'_, AppState>) -> Result<SimpleResult, ()> {
    net::clear_search_cache(&state).await;
    Ok(SimpleResult::ok())
}

// -- item:export-json ------------------------------------------------
//
// Original: `electron/handlers/system.ts` line 37. Opens a Save
// dialog with `<safeName>.json` pre-filled, writes the caller-supplied
// object as pretty-printed JSON. `item` arrives as
// `serde_json::Value` so we don't need a schema — the renderer
// controls exactly what lands on disk, same as the Electron version.
#[tauri::command]
pub async fn item_export_json(
    app: AppHandle,
    item: serde_json::Value,
    suggested_name: String,
) -> PathResult {
    let safe = {
        let s = sanitize_asset_name(&suggested_name);
        if s.is_empty() {
            "item".to_string()
        } else {
            s
        }
    };
    let default_name = format!("{safe}.json");

    // Tauri's file dialog resolves via callback; bridge it into async
    // land with a oneshot channel so the command can `.await` the
    // user's pick.
    let (tx, rx) = oneshot::channel::<Option<FilePath>>();
    app.dialog()
        .file()
        .set_title("Export item as JSON")
        .set_file_name(&default_name)
        .add_filter("JSON", &["json"])
        .save_file(move |picked| {
            let _ = tx.send(picked);
        });

    let picked = match rx.await {
        Ok(v) => v,
        Err(_) => return PathResult::Err { ok: false, error: "dialog dropped".into() },
    };
    let Some(file_path) = picked else {
        return PathResult::Canceled { ok: false, canceled: true };
    };
    let Some(target) = file_path_to_pathbuf(&file_path) else {
        return PathResult::Err { ok: false, error: "unsupported destination path".into() };
    };

    let body = match serde_json::to_string_pretty(&item) {
        Ok(s) => s,
        Err(e) => return PathResult::Err { ok: false, error: format!("serialize: {e}") },
    };
    if let Err(e) = tokio::fs::write(&target, body).await {
        return PathResult::Err { ok: false, error: e.to_string() };
    }
    PathResult::Ok { ok: true, path: target.display().to_string() }
}

// -- library:export-text ---------------------------------------------
//
// Sprint G — generic "save this string to a file the user picks"
// handler. Renderer sends the file body verbatim + a suggested
// filename + a filter label (e.g. "CSV", "HTML"). Powers the CSV
// and multi-item HTML exports without needing one Tauri command per
// format. Mirrors the item_export_json shape (same PathResult),
// same sanitize + fallback rules.
#[tauri::command]
pub async fn library_export_text(
    app: AppHandle,
    body: String,
    suggested_name: String,
    filter_label: String,
    extension: String,
) -> PathResult {
    let safe = {
        let s = sanitize_asset_name(&suggested_name);
        if s.is_empty() { "omnio-export".to_string() } else { s }
    };
    let default_name = format!("{safe}.{extension}");

    let (tx, rx) = oneshot::channel::<Option<FilePath>>();
    app.dialog()
        .file()
        .set_title(&format!("Export as {filter_label}"))
        .set_file_name(&default_name)
        .add_filter(&filter_label, &[extension.as_str()])
        .save_file(move |picked| {
            let _ = tx.send(picked);
        });

    let picked = match rx.await {
        Ok(v) => v,
        Err(_) => return PathResult::Err { ok: false, error: "dialog dropped".into() },
    };
    let Some(file_path) = picked else {
        return PathResult::Canceled { ok: false, canceled: true };
    };
    let Some(target) = file_path_to_pathbuf(&file_path) else {
        return PathResult::Err { ok: false, error: "unsupported destination path".into() };
    };

    if let Err(e) = tokio::fs::write(&target, body.as_bytes()).await {
        return PathResult::Err { ok: false, error: e.to_string() };
    }
    PathResult::Ok { ok: true, path: target.display().to_string() }
}

// -- library:save-text-to --------------------------------------------
//
// Sprint G polish — write a UTF-8 blob to a specific path the
// renderer already knows (no OS save dialog). Powers the in-app
// export modal: the modal builds `<exportFolder>/<filename>.<ext>`
// itself, then hands us the finished path so the write feels like
// a native app action instead of a Windows Save-As window.
//
// Safety: the write refuses to overwrite an existing file unless
// the caller sets `overwrite: true`. Callers ask the user first
// through the in-app confirm dialog.
#[tauri::command]
pub async fn library_save_text_to(
    target_path: String,
    body: String,
    overwrite: bool,
) -> PathResult {
    let target = std::path::PathBuf::from(&target_path);
    // Parent must exist. We create the parent chain here (mkdir -p)
    // so a user's chosen "Omnio Exports" folder can grow subfolders
    // ("games/", "movies/") without an explicit provisioning step.
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            if let Err(e) = tokio::fs::create_dir_all(parent).await {
                return PathResult::Err { ok: false, error: format!("mkdir parent: {e}") };
            }
        }
    }
    if !overwrite {
        if let Ok(true) = tokio::fs::try_exists(&target).await {
            return PathResult::Err { ok: false, error: "exists".into() };
        }
    }
    if let Err(e) = tokio::fs::write(&target, body.as_bytes()).await {
        return PathResult::Err { ok: false, error: e.to_string() };
    }
    PathResult::Ok { ok: true, path: target.display().to_string() }
}

// -- system:reveal ---------------------------------------------------
//
// Open the OS file explorer at the given path so a "Reveal in
// Explorer" affordance can follow a successful export. Best-effort:
// falls back to opening the parent directory when the shell APIs
// can't highlight the file itself.
#[tauri::command]
pub async fn system_reveal(path: String) -> SimpleResult {
    let target = std::path::PathBuf::from(&path);
    #[cfg(target_os = "windows")]
    {
        // /select, highlights the file inside its folder.
        let _ = std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&target)
            .spawn();
        return SimpleResult::ok();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("-R")
            .arg(&target)
            .spawn();
        return SimpleResult::ok();
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        // Linux — try xdg-open on the parent so the folder opens even
        // if the FM can't select individual files.
        let parent = target.parent().map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        let _ = std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn();
        SimpleResult::ok()
    }
}

// -- fs:list-dir -----------------------------------------------------
//
// In-app file browser plumbing. Reads a directory and returns a
// name-sorted list of entries — folders first, then files, both
// case-insensitive alphabetical. Every entry carries whether it's
// a directory and its size in bytes (0 for directories). Hidden
// items (starting with a dot on Unix or with the Windows hidden
// attribute) are elided unless `include_hidden` is true.
//
// Errors bubble up as { ok: false, error } instead of panicking so
// the renderer can render an inline "cannot read this folder" state
// (permission denied on a system directory, missing removable drive)
// without needing a global error boundary.
#[derive(serde::Serialize)]
pub struct DirEntryOut {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(serde::Serialize)]
#[serde(untagged)]
pub enum ListDirResult {
    Ok { ok: bool, entries: Vec<DirEntryOut> },
    Err { ok: bool, error: String },
}

#[tauri::command]
pub async fn fs_list_dir(path: String, include_hidden: bool) -> ListDirResult {
    let target = std::path::PathBuf::from(&path);
    let mut rd = match tokio::fs::read_dir(&target).await {
        Ok(v) => v,
        Err(e) => return ListDirResult::Err { ok: false, error: e.to_string() },
    };
    let mut entries: Vec<DirEntryOut> = Vec::new();
    loop {
        let next = match rd.next_entry().await {
            Ok(v) => v,
            Err(_) => break,
        };
        let Some(entry) = next else { break; };
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip Unix dotfiles unless explicitly asked. Windows-side we
        // rely on the hidden attribute check below.
        if !include_hidden && name.starts_with('.') {
            continue;
        }
        let meta = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x00000002;
            if !include_hidden && (meta.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0 {
                continue;
            }
        }
        let is_dir = meta.is_dir();
        entries.push(DirEntryOut {
            name,
            is_dir,
            size: if is_dir { 0 } else { meta.len() },
        });
    }
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    ListDirResult::Ok { ok: true, entries }
}

// -- fs:read-text-file -----------------------------------------------
//
// Read a text file from disk and return its UTF-8 contents. Used by
// the in-app file picker's "open" mode when the caller wants the
// text of the picked file (import a CSV, an XML, a JSON dump) —
// same round-trip as the OS <input type="file">' FileReader read
// but through the app-styled picker instead of the OS dialog.
//
// Errors bubble as { ok: false, error } so the caller can inline a
// friendly "could not read this file" message.
#[derive(serde::Serialize)]
#[serde(untagged)]
pub enum ReadTextResult {
    Ok { ok: bool, text: String },
    Err { ok: bool, error: String },
}

#[tauri::command]
pub async fn fs_read_text_file(path: String) -> ReadTextResult {
    match tokio::fs::read_to_string(&path).await {
        Ok(text) => ReadTextResult::Ok { ok: true, text },
        Err(e) => ReadTextResult::Err { ok: false, error: e.to_string() },
    }
}

// -- fs:mkdir --------------------------------------------------------
//
// Create a directory (and any missing parents) at the given path.
// Used by the in-app file picker's "New folder" affordance so the
// user can spin off a fresh subdirectory without leaving the picker.
#[tauri::command]
pub async fn fs_mkdir(path: String) -> SimpleResult {
    let target = std::path::PathBuf::from(&path);
    match tokio::fs::create_dir_all(&target).await {
        Ok(()) => SimpleResult::ok(),
        Err(e) => SimpleResult::err(e.to_string()),
    }
}

// -- fs:common-locations ---------------------------------------------
//
// Bundle of well-known folders the in-app picker's sidebar highlights
// so the user doesn't have to type a full path to reach their Home /
// Desktop / Downloads. Missing folders are omitted (a fresh Linux
// container without a Desktop still gets a working sidebar).
#[derive(serde::Serialize)]
pub struct CommonLocation {
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub async fn fs_common_locations() -> Vec<CommonLocation> {
    let mut out: Vec<CommonLocation> = Vec::new();
    let push = |out: &mut Vec<CommonLocation>, name: &str, p: Option<std::path::PathBuf>| {
        if let Some(p) = p {
            if p.exists() {
                out.push(CommonLocation {
                    name: name.to_string(),
                    path: p.display().to_string(),
                });
            }
        }
    };
    push(&mut out, "Home", dirs::home_dir());
    push(&mut out, "Desktop", dirs::desktop_dir());
    push(&mut out, "Documents", dirs::document_dir());
    push(&mut out, "Downloads", dirs::download_dir());
    push(&mut out, "Pictures", dirs::picture_dir());
    push(&mut out, "Music", dirs::audio_dir());
    push(&mut out, "Videos", dirs::video_dir());
    #[cfg(target_os = "windows")]
    {
        // Enumerate top-level drive roots so the user can hop between
        // C:\ and D:\ without typing.
        for letter in b'A'..=b'Z' {
            let root = format!("{}:\\", letter as char);
            let path = std::path::PathBuf::from(&root);
            if path.exists() {
                out.push(CommonLocation { name: format!("{}:", letter as char), path: root });
            }
        }
    }
    out
}

// -- fs:path-info ----------------------------------------------------
//
// Renderer helper — resolve a raw string into a canonical absolute
// path (walking .., ~ and env vars where possible), report whether
// it exists, and report whether it's a directory or a file. Used by
// the picker's breadcrumb input so typing a partial path gives
// live feedback.
#[derive(serde::Serialize)]
pub struct PathInfoOut {
    pub exists: bool,
    pub is_dir: bool,
    pub canonical: String,
    pub parent: Option<String>,
}

#[tauri::command]
pub async fn fs_path_info(path: String) -> PathInfoOut {
    let raw = std::path::PathBuf::from(&path);
    let expanded = if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            let rest = path.trim_start_matches('~').trim_start_matches(['/', '\\']);
            home.join(rest)
        } else {
            raw.clone()
        }
    } else {
        raw.clone()
    };
    let canonical = tokio::fs::canonicalize(&expanded).await.ok().unwrap_or(expanded.clone());
    let exists = canonical.exists();
    let is_dir = canonical.is_dir();
    let parent = canonical.parent().map(|p| p.display().to_string());
    PathInfoOut {
        exists,
        is_dir,
        canonical: canonical.display().to_string(),
        parent,
    }
}

// -- dialog:pick-directory -------------------------------------------
//
// Original: `electron/handlers/system.ts` line 56. Returns the picked
// folder path as a string, or null when the user cancels — same as
// the Electron version, so the renderer's null-check works unchanged.
#[tauri::command]
pub async fn dialog_pick_directory(app: AppHandle, title: Option<String>) -> Option<String> {
    let (tx, rx) = oneshot::channel::<Option<FilePath>>();
    let dialog_title = title.unwrap_or_else(|| "Choose a folder".to_string());
    app.dialog()
        .file()
        .set_title(&dialog_title)
        .pick_folder(move |picked| {
            let _ = tx.send(picked);
        });
    let picked = rx.await.ok().flatten()?;
    file_path_to_pathbuf(&picked).map(|p| p.display().to_string())
}

// -- export:site -----------------------------------------------------
//
// Original: `electron/handlers/system.ts` line 68. Writes
// `index.html` into `target_dir` and mirrors the assets folder
// alongside so the exported page keeps its covers when zipped and
// handed off.
//
// The assets source lives at the app data root — same location the
// Electron main resolves through `ASSETS_ROOT`. In Tauri v2 that's
// `app_data_dir()/assets`.
#[tauri::command]
pub async fn export_site(target_dir: String, html_content: String) -> PathResult {
    let target = PathBuf::from(&target_dir);
    if let Err(e) = tokio::fs::create_dir_all(&target).await {
        return PathResult::Err { ok: false, error: e.to_string() };
    }
    if let Err(e) =
        tokio::fs::write(target.join("index.html"), &html_content).await
    {
        return PathResult::Err { ok: false, error: e.to_string() };
    }

    // Best-effort copy of the assets/ tree. The Electron version
    // swallows failures here ("nothing to copy is fine"); we do the
    // same — a fresh install has no assets yet and that's not an
    // export error. Source path comes from the paths singleton so
    // portable / packaged / dev all resolve identically.
    let src_assets = &paths::get().assets_root;
    if src_assets.is_dir() {
        let dst_assets = target.join("assets");
        let _ = copy_dir_recursive(src_assets, &dst_assets).await;
    }

    PathResult::Ok { ok: true, path: target.display().to_string() }
}

// -- export:csv ------------------------------------------------------
//
// Original: `electron/handlers/system.ts` line 87. Writes every
// entry of the (filename → contents) map into `target_dir`, skipping
// names that don't end in `.csv` and stripping any path components
// (renderer-supplied names are not trusted).
#[tauri::command]
pub async fn export_csv(
    target_dir: String,
    files: std::collections::HashMap<String, String>,
) -> CsvResult {
    if target_dir.is_empty() {
        return CsvResult::Err { ok: false, error: "No folder chosen".into() };
    }
    let target = PathBuf::from(&target_dir);
    if let Err(e) = tokio::fs::create_dir_all(&target).await {
        return CsvResult::Err { ok: false, error: e.to_string() };
    }
    let mut written = 0usize;
    for (name, content) in files.into_iter() {
        // Strip any directory components — the renderer's name is
        // untrusted user data. `Path::file_name` returns None for
        // names like `..` or `.`, which is exactly what we want.
        let Some(basename) = Path::new(&name).file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        if !basename.ends_with(".csv") {
            continue;
        }
        if let Err(e) = tokio::fs::write(target.join(basename), &content).await {
            return CsvResult::Err { ok: false, error: e.to_string() };
        }
        written += 1;
    }
    CsvResult::Ok { ok: true, path: target.display().to_string(), count: written }
}

// -- music:scan_folder ------------------------------------------------
//
// Walks a local music root and returns one entry per album folder it
// finds. Two layouts are supported side-by-side — plenty of libraries
// mix them:
//
//   Root/Artist Name/Album Name/track.mp3     (nested)
//   Root/Artist - Album Name/track.mp3        (flat)
//
// Recognized audio extensions: mp3, flac, m4a, mp4, aac, ogg, opus,
// wav, wma. Cover art detection is a name check for
// cover|folder|front|album|artwork in jpg/png/webp.
//
// Depth is capped so a very deep tree (someone pointing at a whole
// disk) doesn't spin. Directories that look like non-music junk
// (`.git`, `Recycle Bin`, `System Volume Information`) are skipped.

const MAX_SCAN_DEPTH: usize = 4;
const AUDIO_EXTS: &[&str] = &["mp3", "flac", "m4a", "mp4", "aac", "ogg", "opus", "wav", "wma"];
const COVER_STEMS: &[&str] = &["cover", "folder", "front", "album", "artwork"];
const COVER_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp"];

#[derive(serde::Serialize)]
pub struct MusicAlbumOut {
    pub artist: String,
    pub album: String,
    pub year: Option<String>,
    pub track_count: usize,
    pub folder_path: String,
    pub cover_path: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(untagged)]
pub enum MusicScanResult {
    Ok { ok: bool, albums: Vec<MusicAlbumOut> },
    Err { ok: bool, error: String },
}

fn is_audio_file(name: &str) -> bool {
    if let Some(dot) = name.rfind('.') {
        let ext = name[dot + 1..].to_ascii_lowercase();
        return AUDIO_EXTS.iter().any(|e| *e == ext);
    }
    false
}

fn detect_cover(entries: &[(String, bool)]) -> Option<String> {
    // Prefer files whose stem matches one of our cover-name hints.
    for (name, is_dir) in entries {
        if *is_dir { continue; }
        let lower = name.to_ascii_lowercase();
        let dot = match lower.rfind('.') { Some(i) => i, None => continue };
        let stem = &lower[..dot];
        let ext = &lower[dot + 1..];
        if !COVER_EXTS.iter().any(|e| *e == ext) { continue; }
        if COVER_STEMS.iter().any(|s| stem == *s || stem.starts_with(*s)) {
            return Some(name.clone());
        }
    }
    // Fall back to any image in the folder.
    for (name, is_dir) in entries {
        if *is_dir { continue; }
        let lower = name.to_ascii_lowercase();
        let dot = match lower.rfind('.') { Some(i) => i, None => continue };
        let ext = &lower[dot + 1..];
        if COVER_EXTS.iter().any(|e| *e == ext) { return Some(name.clone()); }
    }
    None
}

fn parse_flat_folder(name: &str) -> Option<(String, String, Option<String>)> {
    // "Artist - Album" or "Artist - Album (Year)". Split on the FIRST
    // " - " so an album with a hyphen in the name doesn't get chopped.
    let sep = name.find(" - ")?;
    let artist = name[..sep].trim().to_string();
    let rest = name[sep + 3..].trim().to_string();
    if artist.is_empty() || rest.is_empty() { return None; }
    // "1999 - Album" (year prefix) is the "Year - Album" convention,
    // not "Artist - Album". Reject the flat parse and let the caller
    // fall through to the nested-layout branch which will pick up the
    // real artist from the parent folder.
    if artist.len() == 4 && artist.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let (album, year) = split_year_suffix(&rest);
    Some((artist, album, year))
}

// Detect "YYYY - Album" or "YYYY. Album" folder shapes and pull out
// both parts. Used when parse_flat_folder rejected the name because
// the first segment was a year.
fn split_year_prefix(name: &str) -> Option<(String, String)> {
    let bytes = name.as_bytes();
    if bytes.len() < 5 { return None; }
    if !bytes[..4].iter().all(|b| b.is_ascii_digit()) { return None; }
    // Accept " - ", " – ", " — ", ". " or " " as the year/album separator.
    let tail = &name[4..];
    for sep in &[" - ", " – ", " — ", ". ", " "] {
        if let Some(stripped) = tail.strip_prefix(*sep) {
            let album = stripped.trim().to_string();
            if !album.is_empty() {
                return Some((name[..4].to_string(), album));
            }
        }
    }
    None
}

fn split_year_suffix(s: &str) -> (String, Option<String>) {
    // "Album Name (2015)" → ("Album Name", Some("2015")). Only matches
    // a 4-digit year in parens at the tail.
    if let Some(open) = s.rfind('(') {
        if s.ends_with(')') {
            let inner = &s[open + 1..s.len() - 1];
            if inner.len() == 4 && inner.chars().all(|c| c.is_ascii_digit()) {
                return (s[..open].trim().to_string(), Some(inner.to_string()));
            }
        }
    }
    (s.to_string(), None)
}

fn should_skip(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    matches!(lower.as_str(),
        ".git" | "$recycle.bin" | "system volume information"
        | "node_modules" | ".ds_store" | "thumbs.db"
    )
}

async fn read_dir_entries(path: &std::path::Path) -> Option<Vec<(String, bool)>> {
    let mut rd = tokio::fs::read_dir(path).await.ok()?;
    let mut out: Vec<(String, bool)> = Vec::new();
    while let Ok(Some(entry)) = rd.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip(&name) { continue; }
        let meta = match entry.metadata().await { Ok(m) => m, Err(_) => continue };
        out.push((name, meta.is_dir()));
    }
    Some(out)
}

// Recursive walk. `depth` tracks how far we've descended; `artist_hint`
// is the parent folder name when the caller thinks it might be an
// artist (for the nested layout).
async fn scan_directory(
    path: &std::path::Path,
    depth: usize,
    artist_hint: Option<&str>,
    albums: &mut Vec<MusicAlbumOut>,
) {
    if depth > MAX_SCAN_DEPTH { return; }
    let entries = match read_dir_entries(path).await { Some(v) => v, None => return };

    let track_count = entries.iter().filter(|(n, is_dir)| !is_dir && is_audio_file(n)).count();

    if track_count > 0 {
        // This folder is an album. Determine artist + album.
        //
        // Priority order:
        //   1. YYYY - Album prefix, when we know the artist from the parent
        //      folder (nested layout with year-prefixed album names).
        //   2. Artist - Album (flat layout).
        //   3. Just Album (with optional trailing "(Year)"), artist taken
        //      from the parent folder when we have one.
        let folder_name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        let (artist, album, year) = if let (Some((y, a)), Some(hint)) = (split_year_prefix(&folder_name), artist_hint) {
            (hint.to_string(), a, Some(y))
        } else if let Some((a, b, y)) = parse_flat_folder(&folder_name) {
            (a, b, y)
        } else if let Some(a) = artist_hint {
            let (album, year) = split_year_suffix(&folder_name);
            (a.to_string(), album, year)
        } else {
            let (album, year) = split_year_suffix(&folder_name);
            (String::new(), album, year)
        };
        let cover_name = detect_cover(&entries);
        let cover_path = cover_name.map(|n| path.join(&n).to_string_lossy().to_string());
        albums.push(MusicAlbumOut {
            artist,
            album,
            year,
            track_count,
            folder_path: path.to_string_lossy().to_string(),
            cover_path,
        });
        return; // don't descend below an album folder
    }

    // No audio yet — descend. Current folder becomes the artist_hint
    // for its children (nested layout).
    let self_name = path.file_name().map(|n| n.to_string_lossy().to_string());
    for (name, is_dir) in entries {
        if !is_dir { continue; }
        let child = path.join(&name);
        scan_directory_boxed(
            &child,
            depth + 1,
            self_name.as_deref(),
            albums,
        ).await;
    }
}

// Recursion in async fns needs boxing — provide a thin wrapper that
// tokio::spawn's the initial walk so we return through the IPC boundary
// cleanly.
#[tauri::command]
pub async fn music_scan_folder(rootPath: String) -> MusicScanResult {
    let root = std::path::PathBuf::from(&rootPath);
    if !root.exists() {
        return MusicScanResult::Err { ok: false, error: format!("Folder not found: {rootPath}") };
    }
    let mut albums: Vec<MusicAlbumOut> = Vec::new();
    scan_directory_boxed(&root, 0, None, &mut albums).await;
    albums.sort_by(|a, b| a.artist.to_lowercase().cmp(&b.artist.to_lowercase())
        .then(a.album.to_lowercase().cmp(&b.album.to_lowercase())));
    MusicScanResult::Ok { ok: true, albums }
}

fn scan_directory_boxed<'a>(
    path: &'a std::path::Path,
    depth: usize,
    artist_hint: Option<&'a str>,
    albums: &'a mut Vec<MusicAlbumOut>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(scan_directory(path, depth, artist_hint, albums))
}

// -- helpers ---------------------------------------------------------

// Tauri's `FilePath` can be either an OS path or an Android/iOS
// content URI. The desktop POC only cares about OS paths — return
// None for anything else so callers can surface a clear error rather
// than silently writing to /dev/null.
fn file_path_to_pathbuf(fp: &FilePath) -> Option<PathBuf> {
    match fp {
        FilePath::Path(p) => Some(p.clone()),
        _ => None,
    }
}

