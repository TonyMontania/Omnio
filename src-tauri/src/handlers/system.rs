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

