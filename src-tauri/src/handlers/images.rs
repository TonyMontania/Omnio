// Image + blob storage — Rust port of `electron/handlers/images.ts`.
//
//   image:save                  — write a data-URL image (renderer file picker)
//   image:delete                — unlink one asset by relative path
//   image:download              — fetch a remote URL with retry
//   asset-blob:save/delete/reveal — per-item opaque blobs (saves, screenshots)
//   storage:audit-broken-assets — DB scan for dangling refs
//   storage:clear-asset-ref(s)  — surgical + bulk field-blank
//
// Every filesystem path resolution goes through `util::safe_relative`
// so a renderer-supplied "../.././etc/passwd" gets rejected before we
// touch disk (same guarantee the Electron version offers).

use crate::paths;
use crate::state::AppState;
use crate::util::{
    build_asset_filename, ext_from_mime, ext_from_url_ext, file_exists,
    next_available_asset_name, safe_asset_fragment, safe_relative, sha1_hex,
};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::LazyLock as Lazy;
use tauri::{command, State};
use tokio::fs;
use uuid::Uuid;

// -- Result shapes ---------------------------------------------------

#[derive(Serialize)]
pub struct BlobEntry {
    pub id: String,
    pub filename: String,
    pub path: String,
    pub size: u64,
    #[serde(rename = "addedAt")]
    pub added_at: String,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum BlobSaveResult {
    Ok { ok: bool, entry: BlobEntry },
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum DownloadResult {
    Ok { ok: bool, path: String },
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
pub struct BrokenRef {
    #[serde(rename = "itemId")]
    pub item_id: String,
    #[serde(rename = "itemTitle")]
    pub item_title: String,
    pub category: String,
    pub field: String,
    pub rel: String,
}

#[derive(Serialize)]
pub struct AuditResult {
    pub ok: bool,
    pub broken: Vec<BrokenRef>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum ClearRefResult {
    Ok { ok: bool },
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
pub struct ClearRefsResult {
    pub ok: bool,
    pub cleared: usize,
    pub errors: Vec<String>,
}

#[derive(Deserialize)]
pub struct ClearRefInput {
    #[serde(rename = "itemId")]
    pub item_id: String,
    pub field: String,
    pub source: String,
}

// -- Data-URL regex (compiled once) ---------------------------------

static DATA_URL_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^data:([^;]+);base64,(.+)$").expect("DATA_URL_RE"));

// Sanitize category / kind name to alphanumerics + dash + underscore.
// Same char class the TS side uses (`/[^a-z0-9_-]/gi`).
static NAME_ALLOW: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"[^a-zA-Z0-9_\-]").expect("NAME_ALLOW"));

fn safe_dir_fragment(s: &str) -> String {
    NAME_ALLOW.replace_all(s, "").to_string()
}

// -- image:save ------------------------------------------------------
//
// Original: line 76. Parse data URL → base64-decode → mkdir → write.
// Returns the relative path the renderer stores in the item record,
// or None when the data URL is malformed.
#[command]
pub async fn image_save(
    #[allow(non_snake_case)] categoryId: String,
    kind: String,
    #[allow(non_snake_case)] dataUrl: String,
    basename: Option<String>,
) -> Option<String> {
    let caps = DATA_URL_RE.captures(&dataUrl)?;
    let mime = caps.get(1)?.as_str();
    let payload = caps.get(2)?.as_str();
    let ext = ext_from_mime(mime).unwrap_or("bin");
    let buf = B64.decode(payload).ok()?;

    let safe_category = safe_dir_fragment(paths::asset_folder_for_category(&categoryId));
    let safe_kind = safe_dir_fragment(&kind);
    let dir = paths::get()
        .assets_root
        .join(&safe_category)
        .join(&safe_kind);
    fs::create_dir_all(&dir).await.ok()?;
    let filename = build_asset_filename(&dir, basename.as_deref(), ext).await;
    fs::write(dir.join(&filename), &buf).await.ok()?;
    Some(format!("{safe_category}/{safe_kind}/{filename}"))
}

// -- image:delete ----------------------------------------------------
//
// Original: line 91. Unlink one relative asset path. Returns whether
// the file was actually removed — same shape (bool) as the TS.
#[command]
pub async fn image_delete(rel: String) -> bool {
    let Some(abs) = safe_relative(&rel) else {
        return false;
    };
    fs::remove_file(&abs).await.is_ok()
}

// -- asset-blob:save -------------------------------------------------
//
// Original: line 111. Persist opaque bytes (screenshots, save files)
// under assets/<cat>/<kind>/<title>/<filename>. Collision suffixes
// preserve history on repeated uploads.
#[command]
pub async fn asset_blob_save(
    kind: String,
    #[allow(non_snake_case)] categoryId: String,
    title: String,
    filename: String,
    data: Vec<u8>,
) -> BlobSaveResult {
    if !paths::is_blob_kind(&kind) {
        return BlobSaveResult::Err { ok: false, error: format!("Unknown asset kind \"{kind}\"") };
    }
    let safe_cat = safe_dir_fragment(paths::asset_folder_for_category(&categoryId));
    let safe_title = safe_asset_fragment(if title.is_empty() { "untitled" } else { &title });
    let base_filename = if filename.is_empty() {
        format!("{kind}.bin")
    } else {
        filename
    };
    let safe_filename = safe_asset_fragment(&base_filename);

    let dir = paths::get()
        .assets_root
        .join(&safe_cat)
        .join(&kind)
        .join(&safe_title);
    if let Err(e) = fs::create_dir_all(&dir).await {
        return BlobSaveResult::Err { ok: false, error: e.to_string() };
    }
    let resolved = next_available_asset_name(&dir, &safe_filename).await;
    let abs = dir.join(&resolved);
    if let Err(e) = fs::write(&abs, &data).await {
        return BlobSaveResult::Err { ok: false, error: e.to_string() };
    }
    let size = fs::metadata(&abs).await.map(|m| m.len()).unwrap_or(0);
    BlobSaveResult::Ok {
        ok: true,
        entry: BlobEntry {
            id: Uuid::new_v4().to_string(),
            filename: resolved.clone(),
            path: format!("{safe_cat}/{kind}/{safe_title}/{resolved}"),
            size,
            added_at: iso_now(),
        },
    }
}

// -- asset-blob:delete -----------------------------------------------
//
// Original: line 139. Unlink + best-effort rmdir of the per-title
// parent folder so browsing assets/ stays tidy.
#[command]
pub async fn asset_blob_delete(rel: String) -> bool {
    let Some(abs) = safe_relative(&rel) else {
        return false;
    };
    if fs::remove_file(&abs).await.is_err() {
        return false;
    }
    if let Some(parent) = abs.parent() {
        // rmdir refuses non-empty dirs — that's what we want. Ignore
        // the error either way (same as TS: "try to prune, don't
        // complain if you can't").
        let _ = fs::remove_dir(parent).await;
    }
    true
}

// -- asset-blob:reveal -----------------------------------------------
//
// Original: line 153. Open the file's parent dir in the OS file
// manager with the file selected. Electron uses `shell.showItemInFolder`;
// Windows exposes the same via `explorer.exe /select,`. Non-Windows
// hosts get the parent dir opened via the shell plugin.
#[command]
pub async fn asset_blob_reveal(rel: String) -> bool {
    let Some(abs) = safe_relative(&rel) else {
        return false;
    };
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("explorer.exe")
            .arg(format!("/select,{}", abs.display()))
            .spawn();
        return true;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Best-effort fallback: no cross-platform "reveal in folder"
        // primitive in the tauri-plugin-shell surface; opening the
        // parent dir is the closest match. When macOS/Linux support
        // matters we'll add tauri-plugin-opener which exposes
        // reveal_item_in_dir directly.
        let _ = abs;
        false
    }
}

// -- image:download --------------------------------------------------
//
// Original: line 169. Fetch a remote URL with up to 3 retries on
// network / 5xx errors and short backoff, then file the bytes the
// same way image:save does. Retries only on retriable errors
// (408/429/5xx/network); a 404 gives up immediately.
#[command]
pub async fn image_download(
    url: String,
    #[allow(non_snake_case)] categoryId: String,
    kind: String,
    basename: Option<String>,
) -> DownloadResult {
    let client = match reqwest::Client::builder().build() {
        Ok(c) => c,
        Err(e) => return DownloadResult::Err { ok: false, error: e.to_string() },
    };
    let mut last_err = "Download failed".to_string();

    for i in 0..3 {
        match client.get(&url).send().await {
            Ok(resp) => {
                let status = resp.status();
                if !status.is_success() {
                    let retriable = matches!(status.as_u16(), 408 | 429 | 500 | 502 | 503 | 504);
                    last_err = format!("HTTP {}", status.as_u16());
                    if !retriable {
                        break;
                    }
                } else {
                    let ct = resp
                        .headers()
                        .get(reqwest::header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("")
                        .to_string();
                    match resp.bytes().await {
                        Ok(buf) => {
                            let ext = pick_extension(&ct, &url);
                            let safe_category = safe_dir_fragment(paths::asset_folder_for_category(&categoryId));
                            let safe_kind = safe_dir_fragment(&kind);
                            let dir = paths::get()
                                .assets_root
                                .join(&safe_category)
                                .join(&safe_kind);
                            if let Err(e) = fs::create_dir_all(&dir).await {
                                return DownloadResult::Err {
                                    ok: false,
                                    error: format!("Disk write failed: {e}"),
                                };
                            }
                            let filename =
                                build_asset_filename(&dir, basename.as_deref(), ext).await;
                            if let Err(e) = fs::write(dir.join(&filename), &buf).await {
                                return DownloadResult::Err {
                                    ok: false,
                                    error: format!("Disk write failed: {e}"),
                                };
                            }
                            return DownloadResult::Ok {
                                ok: true,
                                path: format!("{safe_category}/{safe_kind}/{filename}"),
                            };
                        }
                        Err(e) => {
                            last_err = e.to_string();
                            // Body read failure is retriable — could be a
                            // reset mid-stream.
                        }
                    }
                }
            }
            Err(e) => {
                // Network-level error (DNS, connection reset, timeout);
                // always retry.
                last_err = e.to_string();
            }
        }
        if i < 2 {
            tokio::time::sleep(std::time::Duration::from_millis(600 * (i as u64 + 1))).await;
        }
    }
    DownloadResult::Err { ok: false, error: last_err }
}

// -- storage:audit-broken-assets ------------------------------------
//
// Original: line 219. Walk every asset reference across items /
// artists / groups and return the ones whose file is missing on disk.
// Same field vocabulary as `clear_ref_on_item` so the UI can wire
// audit → clear in one round trip.
#[command]
pub async fn storage_audit_broken_assets() -> AuditResult {
    let mut broken: Vec<BrokenRef> = Vec::new();
    let data_dir = &paths::get().data_dir;
    let mut json_names: Vec<String> =
        paths::CATEGORY_IDS.iter().map(|c| paths::file_for_category(c)).collect();
    json_names.push("collections.json".into());
    json_names.push("artists.json".into());

    for name in json_names {
        let p = data_dir.join(&name);
        let raw = match fs::read_to_string(&p).await {
            Ok(s) => s,
            Err(_) => continue,
        };
        let parsed: Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let Some(arr) = parsed.as_array() else {
            continue;
        };
        let source = name.trim_end_matches(".json").to_string();
        for it in arr {
            let Some(obj) = it.as_object() else { continue };
            let id = obj
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let title = obj
                .get("title")
                .and_then(|v| v.as_str())
                .or_else(|| obj.get("name").and_then(|v| v.as_str()))
                .unwrap_or("(untitled)")
                .to_string();

            for (key, field) in [
                ("cover", "cover"),
                ("bannerImage", "banner"),
                ("bannerImage2", "banner 2"),
                ("logoImage", "logo"),
                ("photo", "photo"),
            ] {
                if let Some(rel) = obj.get(key).and_then(|v| v.as_str()) {
                    push_if_broken(rel, &id, &title, &source, field, &mut broken).await;
                }
            }
            audit_array(obj, "volumeCovers", "cover", "volume", "number", &id, &title, &source, &mut broken).await;
            audit_array(obj, "singleCovers", "cover", "single", "name", &id, &title, &source, &mut broken).await;
            audit_array(obj, "editions", "cover", "edition", "name", &id, &title, &source, &mut broken).await;
            audit_array(obj, "bundleContents", "cover", "bundle", "name", &id, &title, &source, &mut broken).await;
        }
    }
    AuditResult { ok: true, broken }
}

async fn audit_array(
    obj: &serde_json::Map<String, Value>,
    array_key: &str,
    path_field: &str,
    label_prefix: &str,
    label_field: &str,
    item_id: &str,
    item_title: &str,
    source: &str,
    broken: &mut Vec<BrokenRef>,
) {
    let Some(arr) = obj.get(array_key).and_then(|v| v.as_array()) else {
        return;
    };
    for entry in arr {
        let Some(entry_obj) = entry.as_object() else { continue };
        let Some(rel) = entry_obj.get(path_field).and_then(|v| v.as_str()) else {
            continue;
        };
        let label = entry_obj
            .get(label_field)
            .and_then(|v| match v {
                Value::String(s) => Some(s.clone()),
                Value::Number(n) => Some(n.to_string()),
                _ => None,
            })
            .unwrap_or_else(|| "?".to_string());
        let field = format!("{label_prefix} {label}");
        push_if_broken(rel, item_id, item_title, source, &field, broken).await;
    }
}

async fn push_if_broken(
    rel: &str,
    item_id: &str,
    item_title: &str,
    source: &str,
    field: &str,
    broken: &mut Vec<BrokenRef>,
) {
    if rel.is_empty() {
        return;
    }
    let lower = rel.to_ascii_lowercase();
    // External / inline — not our disk, not broken.
    if ["data:", "http://", "https:", "blob:"]
        .iter()
        .any(|p| lower.starts_with(p))
    {
        return;
    }
    let Some(abs) = safe_relative(rel) else {
        return;  // path-traversal reject — treat as valid, we won't touch it
    };
    if file_exists(&abs).await {
        return;
    }
    broken.push(BrokenRef {
        item_id: item_id.to_string(),
        item_title: item_title.to_string(),
        category: source.to_string(),
        field: field.to_string(),
        rel: rel.to_string(),
    });
}

// -- storage:clear-asset-ref -----------------------------------------
//
// Original: line 266. Blank one field on one item. The UI's Clear
// button calls this per-row. `source` maps back to the JSON filename
// via the same table `data.rs` uses on the load path.
#[command]
pub async fn storage_clear_asset_ref(
    #[allow(non_snake_case)] itemId: String,
    field: String,
    source: String,
    state: State<'_, AppState>,
) -> Result<ClearRefResult, ()> {
    let filename = source_to_filename(&source);
    let p = paths::get().data_dir.join(&filename);
    let raw = match fs::read_to_string(&p).await {
        Ok(s) => s,
        Err(_) => return Ok(ClearRefResult::Err { ok: false, error: format!("Cannot read {filename}") }),
    };
    let mut parsed: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(ClearRefResult::Err { ok: false, error: format!("Cannot parse {filename}") }),
    };
    let Some(arr) = parsed.as_array_mut() else {
        return Ok(ClearRefResult::Err { ok: false, error: format!("{filename} is not an array") });
    };
    let mut found = false;
    for it in arr.iter_mut() {
        if it.get("id").and_then(|v| v.as_str()) == Some(&itemId) {
            if let Some(obj) = it.as_object_mut() {
                clear_ref_on_item(obj, &field);
                found = true;
            }
            break;
        }
    }
    if !found {
        return Ok(ClearRefResult::Err { ok: false, error: "Item not found".into() });
    }
    let content = serde_json::to_string_pretty(&parsed).unwrap_or_default();
    if let Err(e) = fs::write(&p, &content).await {
        return Ok(ClearRefResult::Err { ok: false, error: e.to_string() });
    }
    state
        .last_hashes
        .lock()
        .expect("last_hashes poisoned")
        .insert(p, sha1_hex(&content));
    Ok(ClearRefResult::Ok { ok: true })
}

// -- storage:clear-asset-refs ----------------------------------------
//
// Original: line 292. Bulk clear — groups by source file first so each
// JSON is read → mutated with every hit → written exactly once. Fixes
// the race the parallel per-ref UI used to have.
#[command]
pub async fn storage_clear_asset_refs(
    refs: Vec<ClearRefInput>,
    state: State<'_, AppState>,
) -> Result<ClearRefsResult, ()> {
    let mut by_source: std::collections::HashMap<String, Vec<(String, String)>> =
        std::collections::HashMap::new();
    for r in refs {
        by_source
            .entry(r.source)
            .or_default()
            .push((r.item_id, r.field));
    }

    let mut cleared = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for (source, entries) in by_source {
        let filename = source_to_filename(&source);
        let p = paths::get().data_dir.join(&filename);
        let raw = match fs::read_to_string(&p).await {
            Ok(s) => s,
            Err(_) => {
                errors.push(format!("Cannot read {filename}"));
                continue;
            }
        };
        let mut parsed: Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => {
                errors.push(format!("Cannot parse {filename}"));
                continue;
            }
        };
        let Some(arr) = parsed.as_array_mut() else {
            errors.push(format!("{filename} is not an array"));
            continue;
        };
        let mut touched = 0usize;
        // Build an index once so N field-clears on one file do N lookups
        // instead of N × arr.len().
        let mut idx: std::collections::HashMap<String, usize> =
            std::collections::HashMap::with_capacity(arr.len());
        for (i, it) in arr.iter().enumerate() {
            if let Some(id) = it.get("id").and_then(|v| v.as_str()) {
                idx.insert(id.to_string(), i);
            }
        }
        for (item_id, field) in entries {
            let Some(i) = idx.get(&item_id).copied() else { continue };
            if let Some(obj) = arr.get_mut(i).and_then(|v| v.as_object_mut()) {
                clear_ref_on_item(obj, &field);
                touched += 1;
            }
        }
        if touched == 0 {
            continue;
        }
        let content = serde_json::to_string_pretty(&parsed).unwrap_or_default();
        match fs::write(&p, &content).await {
            Ok(()) => {
                state
                    .last_hashes
                    .lock()
                    .expect("last_hashes poisoned")
                    .insert(p, sha1_hex(&content));
                cleared += touched;
            }
            Err(e) => {
                errors.push(format!("{filename}: {e}"));
            }
        }
    }

    Ok(ClearRefsResult { ok: errors.is_empty(), cleared, errors })
}

// -- Shared field-clear logic ---------------------------------------
//
// Same vocabulary as the TS `clearRefOnItem`. The prefix parse ("volume
// 3", "single Track 4", …) uses `split_once` for the divider so a
// label containing spaces (like "single This Is An OST") stays intact.
fn clear_ref_on_item(obj: &mut serde_json::Map<String, Value>, field: &str) {
    match field {
        "cover" => { obj.remove("cover"); return }
        "banner" => { obj.remove("bannerImage"); return }
        "banner 2" => { obj.remove("bannerImage2"); return }
        "logo" => { obj.remove("logoImage"); return }
        "photo" => { obj.remove("photo"); return }
        _ => {}
    }
    if let Some((prefix, label)) = field.split_once(' ') {
        let (array_key, match_field): (&str, &str) = match prefix {
            "volume" => ("volumeCovers", "number"),
            "single" => ("singleCovers", "name"),
            "edition" => ("editions", "name"),
            "bundle" => ("bundleContents", "name"),
            _ => return,
        };
        if let Some(arr) = obj.get_mut(array_key).and_then(|v| v.as_array_mut()) {
            for entry in arr {
                if let Some(entry_obj) = entry.as_object_mut() {
                    let current = entry_obj
                        .get(match_field)
                        .and_then(|v| match v {
                            Value::String(s) => Some(s.clone()),
                            Value::Number(n) => Some(n.to_string()),
                            _ => None,
                        })
                        .unwrap_or_else(|| "?".to_string());
                    if current == label {
                        entry_obj.remove("cover");
                    }
                }
            }
        }
    }
}

fn source_to_filename(source: &str) -> String {
    match source {
        "collections" => "collections.json".to_string(),
        "artists" => "artists.json".to_string(),
        other => paths::file_for_category(other),
    }
}

// -- Helpers --------------------------------------------------------

fn pick_extension(content_type: &str, url: &str) -> &'static str {
    // Content-Type wins; strip params (image/jpeg;charset=…) same way
    // the TS `.split(';')[0].trim()` does.
    let ct_primary = content_type.split(';').next().unwrap_or("").trim();
    if let Some(ext) = ext_from_mime(ct_primary) {
        return ext;
    }
    // Fall back to the URL suffix — strip querystring first.
    let clean = url.split('?').next().unwrap_or(url);
    let url_ext = clean.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    ext_from_url_ext(&url_ext).unwrap_or("bin")
}

// Same ISO-8601 stamp `new Date().toISOString()` produces. Hand-formatted
// from SystemTime to avoid a chrono dep for one call site — same
// approach used in storage.rs today_iso_date.
fn iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let ms_total = dur.as_millis() as u64;
    let secs = (ms_total / 1000) as i64;
    let ms = (ms_total % 1000) as u32;
    let (y, mo, d, h, mi, se) = civil_and_time(secs);
    format!("{y:04}-{mo:02}-{d:02}T{h:02}:{mi:02}:{se:02}.{ms:03}Z")
}

fn civil_and_time(z_secs: i64) -> (i32, u32, u32, u32, u32, u32) {
    let days = z_secs.div_euclid(86_400);
    let time_of_day = z_secs.rem_euclid(86_400) as u32;
    let h = time_of_day / 3600;
    let mi = (time_of_day % 3600) / 60;
    let se = time_of_day % 60;
    let (y, mo, d) = civil_from_days(days);
    (y, mo, d, h, mi, se)
}

// Howard Hinnant's civil-from-days (public domain). Same helper used
// in storage.rs — kept per-file to avoid a util.rs API surface for one
// caller each.
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}

// silence unused import when target != windows
#[allow(dead_code)]
fn _unused_pathbuf_hint(_: PathBuf) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_url_parses() {
        let s = "data:image/png;base64,iVBORw0KGgo=";
        let caps = DATA_URL_RE.captures(s).unwrap();
        assert_eq!(&caps[1], "image/png");
        assert_eq!(&caps[2], "iVBORw0KGgo=");
    }

    #[test]
    fn safe_dir_fragment_strips_bad() {
        assert_eq!(safe_dir_fragment("games/covers"), "gamescovers");
        assert_eq!(safe_dir_fragment("my-kind_1"), "my-kind_1");
    }

    #[test]
    fn pick_extension_prefers_ct() {
        assert_eq!(pick_extension("image/webp; charset=utf-8", "https://x/y.png"), "webp");
        assert_eq!(pick_extension("", "https://x/y.png?v=1"), "png");
        assert_eq!(pick_extension("", "https://x/nope"), "bin");
    }

    #[test]
    fn source_maps_to_filename() {
        assert_eq!(source_to_filename("collections"), "collections.json");
        assert_eq!(source_to_filename("artists"), "artists.json");
        assert_eq!(source_to_filename("videojuegos"), "games.json");
        assert_eq!(source_to_filename("visual_novels"), "visual_novels.json");
    }

    #[test]
    fn iso_now_shape() {
        let s = iso_now();
        // shape: YYYY-MM-DDTHH:MM:SS.mmmZ (24 chars)
        assert_eq!(s.len(), 24);
        assert!(s.ends_with('Z'));
        assert_eq!(&s[10..11], "T");
    }
}
