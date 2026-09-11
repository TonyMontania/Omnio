// Generic sandbox for locally-installed plugins. Each plugin identifies
// itself by a `slug` (letters + digits + `_` + `-`) and gets:
//
//   * `data/plugins/<slug>.json`               — its own state file
//   * `assets/plugins/<slug>/<kind>/<file>`    — its own asset folder
//   * `saves/plugins/<slug>/<title>/<file>`    — per-item opaque blobs
//
// Every command below is fully generic: nothing about any specific
// plugin is hard-coded here. Plugins live 100% in the renderer under
// `src/categories/<name>/` (gitignored on the public repo) and drive
// these commands to read/write their state.
//
// Sandboxing: every user-supplied path is scoped to the plugin's
// subtree via `plugin_root`. A slug is validated to a small charset
// so a caller can't escape via `../` or slashes.

use crate::paths;

use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{command, AppHandle};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tokio::fs;
use tokio::sync::oneshot;

// -- Sandbox helpers -----------------------------------------------

fn is_valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug.len() <= 40
        && slug.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn plugin_data_dir() -> PathBuf {
    paths::get().data_dir.join("plugins")
}

fn plugin_asset_root(slug: &str) -> Option<PathBuf> {
    if !is_valid_slug(slug) { return None }
    Some(paths::get().assets_root.join("plugins").join(slug))
}

fn plugin_saves_root(slug: &str) -> Option<PathBuf> {
    if !is_valid_slug(slug) { return None }
    Some(paths::get().storage_root.join("saves").join("plugins").join(slug))
}

// Sanitize one path segment (folder name / filename fragment). Same
// rule as util::safe_asset_fragment but stricter: also rejects `..`
// and leading dots.
fn safe_segment(s: &str) -> String {
    let trimmed = s.trim().replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
    let trimmed = trimmed.trim_start_matches('.').to_string();
    trimmed.chars().take(120).collect()
}

// -- Result shapes -------------------------------------------------

#[derive(Serialize)]
#[serde(untagged)]
pub enum SimpleOk {
    Ok { ok: bool },
    Err { ok: bool, error: String },
}
impl SimpleOk {
    fn ok() -> Self { Self::Ok { ok: true } }
    fn err(msg: impl Into<String>) -> Self { Self::Err { ok: false, error: msg.into() } }
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum StringResult {
    Ok(String),
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
pub struct SaveFileInfo {
    pub name: String,
    pub size: u64,
    pub mtime: u64,  // ms since UNIX_EPOCH
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum SavesAddResult {
    Ok { ok: bool, added: Vec<String> },
    Canceled { ok: bool, canceled: bool },
    Err { ok: bool, error: String },
}

// -- data:load / data:save (per-plugin JSON file) ------------------

#[command]
pub async fn plugin_data_load(slug: String) -> Option<serde_json::Value> {
    if !is_valid_slug(&slug) { return None; }
    let path = plugin_data_dir().join(format!("{slug}.json"));
    let raw = fs::read_to_string(&path).await.ok()?;
    serde_json::from_str(&raw).ok()
}

#[command]
pub async fn plugin_data_save(slug: String, data: serde_json::Value) -> SimpleOk {
    if !is_valid_slug(&slug) { return SimpleOk::err("invalid slug"); }
    let dir = plugin_data_dir();
    if let Err(e) = fs::create_dir_all(&dir).await {
        return SimpleOk::err(format!("mkdir: {e}"));
    }
    let path = dir.join(format!("{slug}.json"));
    let json = match serde_json::to_string_pretty(&data) {
        Ok(s) => s,
        Err(e) => return SimpleOk::err(format!("serialize: {e}")),
    };
    match fs::write(&path, json).await {
        Ok(()) => SimpleOk::ok(),
        Err(e) => SimpleOk::err(e.to_string()),
    }
}

// -- Asset download (HTTP) ------------------------------------------

#[command]
pub async fn plugin_asset_download(
    slug: String,
    kind: String,
    url: String,
    basename: String,
    referer: Option<String>,
    cookie: Option<String>,
) -> StringResult {
    let Some(root) = plugin_asset_root(&slug) else {
        return StringResult::Err { ok: false, error: "invalid slug".into() };
    };
    let safe_kind = safe_segment(&kind);
    let safe_base = safe_segment(&basename);
    if safe_kind.is_empty() || safe_base.is_empty() {
        return StringResult::Err { ok: false, error: "invalid kind/basename".into() };
    }
    let client = reqwest::Client::builder().build();
    let client = match client {
        Ok(c) => c,
        Err(e) => return StringResult::Err { ok: false, error: e.to_string() },
    };
    let mut req = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36");
    if let Some(r) = referer {
        req = req.header("Referer", r);
    }
    if let Some(c) = cookie {
        if !c.trim().is_empty() {
            req = req.header("Cookie", c);
        }
    }
    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => return StringResult::Err { ok: false, error: e.to_string() },
    };
    if !resp.status().is_success() {
        return StringResult::Err { ok: false, error: format!("HTTP {}", resp.status().as_u16()) };
    }
    // Derive extension from Content-Type, fall back to URL.
    //
    // We trust the server's Content-Type over the URL path — F95's
    // image CDN transcodes uploads to AVIF and serves `image/avif`
    // for URLs that still carry a `.png` / `.jpg` suffix. Saving the
    // AVIF bytes as `.png` produces a file the webview refuses to
    // render (mismatched magic bytes vs. mime).
    let ct = resp.headers().get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok()).unwrap_or("").to_lowercase();
    // If the response is clearly HTML/JSON/etc — not an image — bail
    // out with a clear message instead of writing junk bytes to disk
    // that the webview will refuse to render. Attachment CDNs behind
    // a login wall serve login pages this way; the caller can retry
    // with cookies (or skip the cover entirely).
    let looks_html = ct.contains("text/html") || ct.contains("application/json");
    let url_has_ext = {
        let clean = url.split('?').next().unwrap_or(&url).to_lowercase();
        matches!(clean.rsplit('.').next().unwrap_or(""), "png"|"gif"|"webp"|"jpg"|"jpeg"|"bmp")
    };
    if looks_html && !url_has_ext {
        return StringResult::Err {
            ok: false,
            error: format!("respuesta no es una imagen (content-type: {}) — el server puede pedir login", ct),
        };
    }
    let ext = if ct.contains("avif") { "avif" }
              else if ct.contains("png") { "png" }
              else if ct.contains("gif") { "gif" }
              else if ct.contains("webp") { "webp" }
              else if ct.contains("jpeg") || ct.contains("jpg") { "jpg" }
              else if ct.contains("bmp") { "bmp" }
              else if let Some(sub) = ct.strip_prefix("image/") {
                  // Any other `image/<x>` MIME — trust the server and
                  // keep the sub-type as the extension. Falls through
                  // to URL-based detection below when the sub-type is
                  // empty or invalid.
                  let clean: String = sub.split(';').next().unwrap_or("").trim()
                      .chars().filter(|c| c.is_ascii_alphanumeric()).collect();
                  match clean.as_str() {
                      "" => "jpg",
                      "svgxml" => "svg",
                      _ => Box::leak(clean.into_boxed_str()),
                  }
              }
              else {
                  let clean = url.split('?').next().unwrap_or(&url);
                  match clean.rsplit('.').next().unwrap_or("").to_ascii_lowercase().as_str() {
                      "png" => "png", "gif" => "gif", "webp" => "webp", "avif" => "avif",
                      "jpg" | "jpeg" => "jpg", "bmp" => "bmp",
                      _ => "jpg",
                  }
              };
    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => return StringResult::Err { ok: false, error: e.to_string() },
    };
    let dir = root.join(&safe_kind);
    if let Err(e) = fs::create_dir_all(&dir).await {
        return StringResult::Err { ok: false, error: e.to_string() };
    }
    // Remove prior variants of this basename before writing new one.
    let _ = remove_existing_variants(&dir, &safe_base).await;
    let filename = format!("{safe_base}.{ext}");
    let path = dir.join(&filename);
    if let Err(e) = fs::write(&path, &bytes).await {
        return StringResult::Err { ok: false, error: e.to_string() };
    }
    StringResult::Ok(filename)
}

// Save a data URL (data:image/xxx;base64,YYY) to the plugin's asset
// folder — used when the renderer already has the bytes (e.g. user
// dropped an image into the editor).
#[command]
pub async fn plugin_asset_save_data_url(
    slug: String,
    kind: String,
    #[allow(non_snake_case)] dataUrl: String,
    basename: String,
) -> StringResult {
    use base64::{engine::general_purpose::STANDARD as B64, Engine};

    let Some(root) = plugin_asset_root(&slug) else {
        return StringResult::Err { ok: false, error: "invalid slug".into() };
    };
    let safe_kind = safe_segment(&kind);
    let safe_base = safe_segment(&basename);
    if safe_kind.is_empty() || safe_base.is_empty() {
        return StringResult::Err { ok: false, error: "invalid kind/basename".into() };
    }
    // Parse the data URL. Pattern: `data:<mime>;base64,<payload>`.
    let rest = match dataUrl.strip_prefix("data:") {
        Some(r) => r,
        None => return StringResult::Err { ok: false, error: "not a data URL".into() },
    };
    let (mime_part, payload) = match rest.split_once(",") {
        Some(p) => p,
        None => return StringResult::Err { ok: false, error: "malformed data URL".into() },
    };
    let mime = mime_part.split(';').next().unwrap_or("").to_lowercase();
    let ext = match mime.as_str() {
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/bmp" => "bmp",
        _ => "bin",
    };
    let bytes = match B64.decode(payload) {
        Ok(b) => b,
        Err(e) => return StringResult::Err { ok: false, error: e.to_string() },
    };
    let dir = root.join(&safe_kind);
    if let Err(e) = fs::create_dir_all(&dir).await {
        return StringResult::Err { ok: false, error: e.to_string() };
    }
    let _ = remove_existing_variants(&dir, &safe_base).await;
    let filename = format!("{safe_base}.{ext}");
    let path = dir.join(&filename);
    if let Err(e) = fs::write(&path, &bytes).await {
        return StringResult::Err { ok: false, error: e.to_string() };
    }
    StringResult::Ok(filename)
}

// Copy a local file (picked from a dialog) into the plugin's asset
// folder — used when the user picks an image via file picker.
#[command]
pub async fn plugin_asset_save_from_file(
    slug: String,
    kind: String,
    #[allow(non_snake_case)] sourcePath: String,
    basename: String,
) -> StringResult {
    let Some(root) = plugin_asset_root(&slug) else {
        return StringResult::Err { ok: false, error: "invalid slug".into() };
    };
    let safe_kind = safe_segment(&kind);
    let safe_base = safe_segment(&basename);
    if safe_kind.is_empty() || safe_base.is_empty() {
        return StringResult::Err { ok: false, error: "invalid kind/basename".into() };
    }
    let src = PathBuf::from(&sourcePath);
    if !src.exists() {
        return StringResult::Err { ok: false, error: "source not found".into() };
    }
    let ext = src.extension().and_then(|s| s.to_str()).unwrap_or("bin").to_ascii_lowercase();
    let dir = root.join(&safe_kind);
    if let Err(e) = fs::create_dir_all(&dir).await {
        return StringResult::Err { ok: false, error: e.to_string() };
    }
    let _ = remove_existing_variants(&dir, &safe_base).await;
    let filename = format!("{safe_base}.{ext}");
    let dst = dir.join(&filename);
    if let Err(e) = fs::copy(&src, &dst).await {
        return StringResult::Err { ok: false, error: e.to_string() };
    }
    StringResult::Ok(filename)
}

#[command]
pub async fn plugin_asset_delete(slug: String, kind: String, basename: String) -> bool {
    let Some(root) = plugin_asset_root(&slug) else { return false };
    let safe_kind = safe_segment(&kind);
    let safe_base = safe_segment(&basename);
    if safe_kind.is_empty() || safe_base.is_empty() { return false }
    remove_existing_variants(&root.join(&safe_kind), &safe_base).await.is_ok()
}

#[command]
pub async fn plugin_asset_rename(
    slug: String, kind: String,
    #[allow(non_snake_case)] oldBasename: String,
    #[allow(non_snake_case)] newBasename: String,
) -> Option<String> {
    let root = plugin_asset_root(&slug)?;
    let safe_kind = safe_segment(&kind);
    let old_base = safe_segment(&oldBasename);
    let new_base = safe_segment(&newBasename);
    if safe_kind.is_empty() || old_base.is_empty() || new_base.is_empty() || old_base == new_base { return None }
    let dir = root.join(&safe_kind);
    let mut entries = fs::read_dir(&dir).await.ok()?;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&format!("{old_base}.")) {
            let ext = name.rsplit('.').next().unwrap_or("bin");
            let new_name = format!("{new_base}.{ext}");
            let new_path = dir.join(&new_name);
            fs::rename(entry.path(), &new_path).await.ok()?;
            return Some(new_name);
        }
    }
    None
}

// -- Save-files sandbox -------------------------------------------

fn saves_folder(slug: &str, game_name: &str) -> Option<PathBuf> {
    let root = plugin_saves_root(slug)?;
    let safe_name = safe_segment(game_name);
    if safe_name.is_empty() { return None }
    Some(root.join(safe_name))
}

#[command]
pub async fn plugin_saves_list(
    slug: String, #[allow(non_snake_case)] gameName: String,
) -> Vec<SaveFileInfo> {
    let Some(folder) = saves_folder(&slug, &gameName) else { return Vec::new() };
    let mut out = Vec::new();
    let mut entries = match fs::read_dir(&folder).await { Ok(e) => e, Err(_) => return out };
    while let Ok(Some(entry)) = entries.next_entry().await {
        if let Ok(meta) = entry.metadata().await {
            if meta.is_file() {
                let mtime = meta.modified().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                out.push(SaveFileInfo {
                    name: entry.file_name().to_string_lossy().to_string(),
                    size: meta.len(),
                    mtime,
                });
            }
        }
    }
    out.sort_by(|a, b| b.mtime.cmp(&a.mtime));
    out
}

#[command]
pub async fn plugin_saves_add(
    slug: String, #[allow(non_snake_case)] gameName: String,
    app: AppHandle,
) -> SavesAddResult {
    let Some(folder) = saves_folder(&slug, &gameName) else {
        return SavesAddResult::Err { ok: false, error: "invalid slug/game".into() };
    };
    let (tx, rx) = oneshot::channel::<Option<Vec<FilePath>>>();
    app.dialog()
        .file()
        .set_title("Elegir savefile")
        .pick_files(move |paths| { let _ = tx.send(paths); });
    let picked = match rx.await {
        Ok(p) => p,
        Err(_) => return SavesAddResult::Err { ok: false, error: "dialog dropped".into() },
    };
    let files = match picked {
        Some(f) if !f.is_empty() => f,
        _ => return SavesAddResult::Canceled { ok: false, canceled: true },
    };
    if let Err(e) = fs::create_dir_all(&folder).await {
        return SavesAddResult::Err { ok: false, error: e.to_string() };
    }
    let mut added = Vec::new();
    for fp in files {
        let src = match fp {
            FilePath::Path(p) => p,
            _ => continue,
        };
        let base = match src.file_name().and_then(|s| s.to_str()) {
            Some(b) => b.to_string(),
            None => continue,
        };
        let mut dst_name = base.clone();
        let mut dst = folder.join(&dst_name);
        let mut n = 1u32;
        while dst.exists() {
            let (stem, ext) = match base.rsplit_once('.') {
                Some((s, e)) => (s, format!(".{e}")),
                None => (base.as_str(), String::new()),
            };
            dst_name = format!("{stem} ({n}){ext}");
            dst = folder.join(&dst_name);
            n += 1;
        }
        if fs::copy(&src, &dst).await.is_ok() {
            added.push(dst_name);
        }
    }
    SavesAddResult::Ok { ok: true, added }
}

#[command]
pub async fn plugin_saves_delete(
    slug: String, #[allow(non_snake_case)] gameName: String, #[allow(non_snake_case)] fileName: String,
) -> bool {
    let Some(folder) = saves_folder(&slug, &gameName) else { return false };
    let safe = safe_segment(&fileName);
    if safe.is_empty() { return false }
    let target = folder.join(&safe);
    // Must be inside `folder`
    match (target.canonicalize().ok(), folder.canonicalize().ok()) {
        (Some(t), Some(f)) if t.starts_with(&f) => fs::remove_file(&target).await.is_ok(),
        _ => false,
    }
}

#[command]
pub async fn plugin_saves_open_folder(
    slug: String, #[allow(non_snake_case)] gameName: String,
) -> bool {
    let Some(folder) = saves_folder(&slug, &gameName) else { return false };
    let _ = fs::create_dir_all(&folder).await;
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer.exe").arg(&folder).spawn().is_ok()
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = folder;
        false
    }
}

#[command]
pub async fn plugin_saves_reveal(
    slug: String, #[allow(non_snake_case)] gameName: String, #[allow(non_snake_case)] fileName: String,
) -> bool {
    let Some(folder) = saves_folder(&slug, &gameName) else { return false };
    let safe = safe_segment(&fileName);
    if safe.is_empty() { return false }
    let target = folder.join(&safe);
    if !target.exists() { return false }
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer.exe").arg(format!("/select,{}", target.display())).spawn().is_ok()
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = target;
        false
    }
}

#[command]
pub async fn plugin_saves_rename_folder(
    slug: String,
    #[allow(non_snake_case)] oldName: String,
    #[allow(non_snake_case)] newName: String,
) -> bool {
    let Some(old_folder) = saves_folder(&slug, &oldName) else { return false };
    let Some(new_folder) = saves_folder(&slug, &newName) else { return false };
    if old_folder == new_folder { return false }
    if !old_folder.exists() { return false }
    fs::rename(&old_folder, &new_folder).await.is_ok()
}

#[command]
pub async fn plugin_saves_delete_all(
    slug: String, #[allow(non_snake_case)] gameName: String,
) -> bool {
    let Some(folder) = saves_folder(&slug, &gameName) else { return false };
    if !folder.exists() { return false }
    fs::remove_dir_all(&folder).await.is_ok()
}

// -- Generic HTTP text fetch ---------------------------------------

// GET a URL and return the response body as a String. Used by plugins
// that need to scrape HTML (e.g. an update checker that reads
// version info from a forum thread). Public generic infra; nothing
// plugin-specific here.
//
// Uses the shared reqwest client from `AppState` — that client has
// keep-alive + HTTP/2 connection pooling on, so a batch of same-host
// requests (like "check every game on F95Zone") reuses TCP + TLS
// across the whole loop instead of paying the handshake per call.
#[command]
pub async fn net_fetch_text(
    url: String,
    headers: Option<std::collections::HashMap<String, String>>,
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<StringResult, String> {
    let client = crate::net::get_http_client(&state);
    let mut req = client.get(&url);
    if let Some(h) = headers {
        for (k, v) in h {
            if let (Ok(name), Ok(value)) = (
                reqwest::header::HeaderName::from_bytes(k.as_bytes()),
                reqwest::header::HeaderValue::from_str(&v),
            ) {
                req = req.header(name, value);
            }
        }
    }
    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) => return Ok(StringResult::Err { ok: false, error: e.to_string() }),
    };
    if !resp.status().is_success() {
        return Ok(StringResult::Err { ok: false, error: format!("HTTP {}", resp.status().as_u16()) });
    }
    Ok(match resp.text().await {
        Ok(t) => StringResult::Ok(t),
        Err(e) => StringResult::Err { ok: false, error: e.to_string() },
    })
}

// -- helpers -----------------------------------------------------

async fn remove_existing_variants(dir: &Path, basename: &str) -> std::io::Result<()> {
    if !dir.exists() { return Ok(()) }
    let prefix = format!("{basename}.");
    let mut entries = fs::read_dir(dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&prefix) {
            let _ = fs::remove_file(entry.path()).await;
        }
    }
    Ok(())
}
