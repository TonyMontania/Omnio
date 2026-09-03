// Split-file storage — Rust port of `electron/handlers/data.ts`.
//
// Owns:
//   - read_split_data / migrate_legacy_if_needed (load path)
//   - rename_all_assets + write_split_data (save path with title-based
//     asset renames + snapshot rotation)
//   - the one-shot 0.1.7 → 0.1.7.1 filename migrator and 0.2.0 → 0.2.1
//     asset-folder migrator (both idempotent)
//   - data:save / data:load / data:list-backups / data:restore-backup
//
// `read_split_data` and `rename_all_assets` are exposed for
// `storage::storage_rename_all_assets` to reuse — same relationship
// data.ts and storage.ts have on the Electron side.
//
// JSON round-trips go through `serde_json::Value`. A stricter port
// would define the full `Item` discriminated enum (Fase 2 in the
// original plan) and let serde do the shape check — deferred until the
// bag→variant swap in Fase 3 gates it.

use crate::paths;
use crate::schemas::{
    parse_or, pick_valid, validate_arcade_game, validate_collection, validate_custom_orders,
    validate_item, validate_music_artist, validate_settings, warn_invalid,
};
use crate::state::AppState;
use crate::util::{
    file_exists, rename_asset_file, safe_relative, sanitize_asset_name, sha1_hex,
    write_if_changed,
};

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::path::{Path, PathBuf};
use std::sync::LazyLock as Lazy;
use tauri::{command, State};
use tokio::fs;

// -- Public types ----------------------------------------------------

/// One rewrite the renderer needs to apply after save: old relative
/// path → new relative path. Handed back so the in-memory state can be
/// patched without a full reload.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Rewrite {
    pub from: String,
    pub to: String,
}

#[derive(Serialize)]
pub struct SaveResult {
    pub ok: bool,
    pub rewrites: Vec<Rewrite>,
}

#[derive(Serialize)]
pub struct BackupEntry {
    pub file: String,
    pub mtime: f64,  // ms since epoch — matches Electron's stat.mtimeMs
    pub size: u64,
}

// -- Static regexes / prefix sets -----------------------------------

// Same "external URL scheme" set the TS side excludes — anything
// matching skips the asset-rename pass.
static EXTERNAL_URL_PREFIXES: [&str; 6] = [
    "data:", "http://", "https:", "file:", "blob:", "omnio-asset:",
];

// Strips filesystem-reserved chars + trailing dots/spaces for the
// clean_base used in the rename short-circuit. Matches the ad-hoc
// version inside renameRelIfNeeded on the TS side.
static BAD_CHARS: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"[<>:"/\\|?*\x00-\x1f]"#).expect("BAD_CHARS regex"));
static TRAILING: Lazy<Regex> = Lazy::new(|| Regex::new(r"[. ]+$").expect("TRAILING regex"));

// -- Legacy migrators (0.1.7 → 0.1.7.1) -----------------------------
//
// Renames per-category shards from Spanish (videojuegos.json) to
// English (games.json) both in `data/` and in every snapshot slot.
// Idempotent — runs on every boot, no-op after the first success.
async fn rename_legacy_category_files() -> std::io::Result<()> {
    let renames: [(&str, &str); 3] = [
        ("videojuegos.json", "games.json"),
        ("musica.json", "music.json"),
        ("peliculas.json", "movies.json"),
    ];
    rename_in_dir(&paths::get().data_dir, &renames).await;
    // Snapshot dirs too so restores keep working after the migration.
    for i in 1..=paths::BACKUP_COUNT {
        let slot = paths::get().backups_dir.join(i.to_string());
        if file_exists(&slot).await {
            rename_in_dir(&slot, &renames).await;
        }
    }
    Ok(())
}

async fn rename_in_dir(dir: &Path, renames: &[(&str, &str)]) {
    for (old_name, new_name) in renames {
        let old_p = dir.join(old_name);
        let new_p = dir.join(new_name);
        if file_exists(&old_p).await && !file_exists(&new_p).await {
            let _ = fs::rename(&old_p, &new_p).await;
        }
    }
}

// -- Legacy migrator (0.2.0 → 0.2.1) --------------------------------
//
// Renames assets/{videojuegos,musica,peliculas} → English AND
// rewrites the "cat/kind/…" prefix inside every category JSON so
// existing covers still resolve. Marker file skips the entire scan
// on subsequent boots.
const ASSET_FOLDER_MIGRATION_MARKER: &str = ".asset-folders-english-v1";

async fn rename_legacy_asset_folders(state: &State<'_, AppState>) -> std::io::Result<()> {
    let marker = paths::get().data_dir.join(ASSET_FOLDER_MIGRATION_MARKER);
    if file_exists(&marker).await {
        return Ok(());
    }
    let renames: [(&str, &str); 3] = [
        ("videojuegos", "games"),
        ("musica", "music"),
        ("peliculas", "movies"),
    ];
    let assets_root = &paths::get().assets_root;
    for (old_name, new_name) in renames {
        let old_p = assets_root.join(old_name);
        let new_p = assets_root.join(new_name);
        if file_exists(&old_p).await && !file_exists(&new_p).await {
            let _ = fs::rename(&old_p, &new_p).await;
        }
    }
    // Rewrite paths inside every category JSON. Match at the start of
    // any string field (`"videojuegos/`) to avoid mangling arbitrary
    // text — item titles that happen to contain the word are untouched.
    for cat in paths::CATEGORY_IDS {
        let p = paths::get().data_dir.join(paths::file_for_category(cat));
        let raw = match fs::read_to_string(&p).await {
            Ok(s) => s,
            Err(_) => continue,
        };
        let mut changed = raw.clone();
        for (old_name, new_name) in &renames {
            changed = changed.replace(&format!("\"{old_name}/"), &format!("\"{new_name}/"));
        }
        if changed != raw {
            if fs::write(&p, &changed).await.is_ok() {
                let mut cache = state.last_hashes.lock().expect("last_hashes poisoned");
                cache.insert(p.clone(), sha1_hex(&changed));
            }
        }
    }
    // Drop the marker last — a crash mid-migration leaves it absent
    // and the migration retries on next boot.
    let now = chrono_ish_now();
    let _ = fs::write(&marker, now).await;
    Ok(())
}

// Tiny replacement for a chrono dep — we just want *any* ISO-ish
// stamp inside the marker file. Not consumed by anything but a human
// reading `.asset-folders-english-v1`.
fn chrono_ish_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("migrated at unix seconds {secs}")
}

// -- Load path ------------------------------------------------------
//
// Walk every per-category shard + top-level slice, parse them, filter
// via the schema validators, hash the raw string into `last_hashes` so
// the next writeIfChanged can short-circuit.
pub async fn read_split_data(
    state: &State<'_, AppState>,
) -> std::io::Result<Option<Map<String, Value>>> {
    let data_dir = &paths::get().data_dir;
    if !file_exists(data_dir).await {
        return Ok(None);
    }
    let _ = rename_legacy_category_files().await;
    let _ = rename_legacy_asset_folders(state).await;

    let mut items: Vec<Value> = Vec::new();
    for cat in paths::CATEGORY_IDS {
        let p = data_dir.join(paths::file_for_category(cat));
        let raw = match fs::read_to_string(&p).await {
            Ok(s) => s,
            Err(_) => continue,
        };
        let parsed: Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let label = format!("items:{cat}");
        let valid = pick_valid(&parsed, validate_item, &label);
        items.extend(valid);
        state
            .last_hashes
            .lock()
            .expect("last_hashes poisoned")
            .insert(p, sha1_hex(&raw));
    }

    let mut out: Map<String, Value> = Map::new();
    out.insert("items".into(), Value::Array(items));

    for key in paths::TOP_SLICES {
        let p = data_dir.join(format!("{key}.json"));
        let raw = match fs::read_to_string(&p).await {
            Ok(s) => s,
            Err(_) => continue,
        };
        let parsed: Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let validated = match *key {
            "collections" => Value::Array(pick_valid(&parsed, validate_collection, "collections")),
            "artists" => Value::Array(pick_valid(&parsed, validate_music_artist, "artists")),
            "arcadeGames" => Value::Array(pick_valid(&parsed, validate_arcade_game, "arcadeGames")),
            "customOrders" => parse_or(&parsed, validate_custom_orders, Value::Object(Map::new()), "customOrders"),
            "settings" => parse_or(&parsed, validate_settings, Value::Object(Map::new()), "settings"),
            _ => parsed,
        };
        out.insert((*key).to_string(), validated);
        state
            .last_hashes
            .lock()
            .expect("last_hashes poisoned")
            .insert(p, sha1_hex(&raw));
    }

    Ok(Some(out))
}

// -- Legacy monolithic-file migrator --------------------------------
//
// Pre-0.1.7 stored everything in one `data.json`. On first boot with a
// split-aware version, read it, write it out through writeSplitData
// (which produces the per-category shards + snapshots), and rename the
// original to `data.pre-split.json` as a safety net.
async fn migrate_legacy_if_needed(
    state: &State<'_, AppState>,
) -> Option<Map<String, Value>> {
    let legacy = &paths::get().legacy_data_file;
    if !file_exists(legacy).await {
        return None;
    }
    let raw = fs::read_to_string(legacy).await.ok()?;
    let parsed: Value = serde_json::from_str(&raw).ok()?;
    let obj = parsed.as_object()?.clone();
    let _ = write_split_data(state, &obj).await;
    let backup = paths::get().storage_root.join("data.pre-split.json");
    let _ = fs::rename(legacy, &backup).await;
    Some(obj)
}

// -- Save path ------------------------------------------------------
//
// Split payload into per-category shards + top-level slices, rotate
// snapshots if any file will change, write only the shards whose
// content differs from the last write.
pub async fn write_split_data(
    state: &State<'_, AppState>,
    payload: &Map<String, Value>,
) -> std::io::Result<Vec<Rewrite>> {
    let data_dir = &paths::get().data_dir;
    fs::create_dir_all(data_dir).await?;

    // Pre-write validation pass. Logs only — never drops.
    if let Some(v) = payload.get("items") {
        warn_invalid(v, validate_item, "items");
    }
    if let Some(v) = payload.get("collections") {
        warn_invalid(v, validate_collection, "collections");
    }
    if let Some(v) = payload.get("artists") {
        warn_invalid(v, validate_music_artist, "artists");
    }
    if let Some(v) = payload.get("arcadeGames") {
        warn_invalid(v, validate_arcade_game, "arcadeGames");
    }

    // The rename pass mutates items in-place (updates cover/photo/etc
    // to their new relative paths). Clone into a working copy so the
    // caller's payload isn't touched — matches the TS which mutates
    // through the same references but takes an already-cloned object
    // through the JSON serialize round-trip.
    let mut working = payload.clone();
    let rewrites = rename_all_assets(&mut working).await;

    // Build the write plan: per-category shards + top-level slices.
    let mut plans: Vec<(PathBuf, String)> = Vec::new();

    if let Some(items) = working.get("items").and_then(|v| v.as_array()).cloned() {
        let mut by_slice: std::collections::HashMap<String, Vec<Value>> =
            paths::CATEGORY_IDS.iter().map(|c| ((*c).to_string(), Vec::new())).collect();
        for it in items {
            let Some(cat) = it.get("categoryId").and_then(|v| v.as_str()).map(String::from) else {
                continue;
            };
            if let Some(bucket) = by_slice.get_mut(&cat) {
                bucket.push(it);
            }
        }
        for cat in paths::CATEGORY_IDS {
            let arr = by_slice.remove(*cat).unwrap_or_default();
            let path = data_dir.join(paths::file_for_category(cat));
            let content = serde_json::to_string_pretty(&Value::Array(arr))
                .expect("serialize slice");
            plans.push((path, content));
        }
    }

    for key in paths::TOP_SLICES {
        let Some(value) = working.get(*key) else {
            continue;  // undefined key → don't wipe on-disk file
        };
        let path = data_dir.join(format!("{key}.json"));
        let content = serde_json::to_string_pretty(value).expect("serialize slice");
        plans.push((path, content));
    }

    // If any file will actually change, rotate snapshots first so the
    // pre-write state gets captured in slot 1.
    let will_change = {
        let cache = state.last_hashes.lock().expect("last_hashes poisoned");
        plans
            .iter()
            .any(|(p, c)| cache.get(p) != Some(&sha1_hex(c)))
    };
    if will_change {
        rotate_snapshots().await;
    }

    for (p, c) in &plans {
        let _ = write_if_changed(state, p, c).await?;
    }

    Ok(rewrites)
}

// -- Snapshot rotation ---------------------------------------------
//
// Slot N-1 → N (dropping the oldest), then copy current data files
// into a fresh slot 1. Snapshots are directories so restore is one
// atomic operation from the user's point of view.
async fn rotate_snapshots() {
    let backups_dir = &paths::get().backups_dir;
    let _ = fs::create_dir_all(backups_dir).await;
    // Walk from highest to lowest so we don't clobber slot N with slot
    // N-1 before slot N has been aged out.
    let n = paths::BACKUP_COUNT;
    for i in (2..=n).rev() {
        let src = backups_dir.join((i - 1).to_string());
        let dst = backups_dir.join(i.to_string());
        if file_exists(&src).await {
            let _ = fs::remove_dir_all(&dst).await;
            let _ = fs::rename(&src, &dst).await;
        }
    }
    // Take a fresh snapshot of the current on-disk state into slot 1.
    let slot1 = backups_dir.join("1");
    let data_dir = &paths::get().data_dir;
    let mut entries = match fs::read_dir(data_dir).await {
        Ok(e) => e,
        Err(_) => return,
    };
    let mut json_files: Vec<PathBuf> = Vec::new();
    while let Ok(Some(e)) = entries.next_entry().await {
        let name = e.file_name();
        if name.to_string_lossy().ends_with(".json") {
            json_files.push(e.path());
        }
    }
    if json_files.is_empty() {
        return;  // first save ever — nothing to snapshot
    }
    let _ = fs::create_dir_all(&slot1).await;
    for src in json_files {
        if let Some(name) = src.file_name() {
            let _ = fs::copy(&src, slot1.join(name)).await;
        }
    }
}

// -- Title-based asset rename ---------------------------------------
//
// Runs before every write: rename every UUID-named (or stale-title-
// named) asset file to match the current item / artist / group title.
// Returns the rewrites so the renderer can update its in-memory state
// without a reload. Mirrors renameAllAssets in electron/handlers/data.ts.
pub async fn rename_all_assets(payload: &mut Map<String, Value>) -> Vec<Rewrite> {
    let mut rewrites: Vec<Rewrite> = Vec::new();

    if let Some(items) = payload.get_mut("items").and_then(|v| v.as_array_mut()) {
        for it in items {
            if let Some(obj) = it.as_object_mut() {
                rename_item_assets(obj, &mut rewrites).await;
            }
        }
    }
    if let Some(artists) = payload.get_mut("artists").and_then(|v| v.as_array_mut()) {
        for a in artists {
            if let Some(obj) = a.as_object_mut() {
                rename_artist_assets(obj, &mut rewrites).await;
            }
        }
    }
    if let Some(collections) = payload.get_mut("collections").and_then(|v| v.as_array_mut()) {
        for g in collections {
            if let Some(obj) = g.as_object_mut() {
                rename_group_assets(obj, &mut rewrites).await;
            }
        }
    }
    rewrites
}

// -- Per-entity asset walkers ---------------------------------------

async fn rename_item_assets(it: &mut Map<String, Value>, rewrites: &mut Vec<Rewrite>) {
    let title_raw = it.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let title = sanitize_asset_name(&title_raw);
    if title.is_empty() {
        return;
    }

    // Scalar asset fields — one path per Item field.
    rename_scalar_field(it, "cover", &format!("{title} cover"), rewrites).await;
    rename_scalar_field(it, "bannerImage", &format!("{title} banner"), rewrites).await;
    rename_scalar_field(it, "bannerImage2", &format!("{title} banner 2"), rewrites).await;
    rename_scalar_field(it, "logoImage", &format!("{title} logo"), rewrites).await;

    // Array asset fields — each element carries one path under a sub-key
    // and (usually) a label field that shapes the on-disk name.
    rename_array_field(it, "volumeCovers", "cover", |entry| {
        let num = entry.get("number").and_then(|v| stringify_scalar(v));
        num.filter(|n| !n.is_empty())
            .map(|n| format!("{title} volume {}", sanitize_asset_name(&n)))
    }, rewrites)
    .await;

    rename_array_field(it, "singleCovers", "cover", |entry| {
        let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let label = sanitize_asset_name(name);
        if label.is_empty() {
            None
        } else {
            Some(format!("{title} single {label}"))
        }
    }, rewrites)
    .await;

    rename_array_field(it, "editions", "cover", |entry| {
        let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let label = sanitize_asset_name(name);
        if label.is_empty() {
            None
        } else {
            Some(format!("{title} edition {label}"))
        }
    }, rewrites)
    .await;

    // Bundle sub-covers use the sub-game name (not the parent bundle
    // title) so browsing games/bundle/ reads as one file per sub-game.
    rename_array_field(it, "bundleContents", "cover", |entry| {
        let name = entry.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let label = sanitize_asset_name(name);
        if label.is_empty() {
            None
        } else {
            Some(format!("{label} cover"))
        }
    }, rewrites)
    .await;
}

async fn rename_artist_assets(a: &mut Map<String, Value>, rewrites: &mut Vec<Rewrite>) {
    let name_raw = a.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let name = sanitize_asset_name(&name_raw);
    if name.is_empty() {
        return;
    }
    rename_scalar_field(a, "photo", &format!("{name} photo"), rewrites).await;
    rename_scalar_field(a, "bannerImage", &format!("{name} banner"), rewrites).await;
}

async fn rename_group_assets(g: &mut Map<String, Value>, rewrites: &mut Vec<Rewrite>) {
    // Groups store their label under `name`; historical data may use
    // `title` — try both to match the TS.
    let raw = g
        .get("name")
        .and_then(|v| v.as_str())
        .or_else(|| g.get("title").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    let name = sanitize_asset_name(&raw);
    if name.is_empty() {
        return;
    }
    rename_scalar_field(g, "cover", &format!("{name} cover"), rewrites).await;
}

// Rename one scalar field in-place. No-op if the field is missing or
// not a string.
async fn rename_scalar_field(
    obj: &mut Map<String, Value>,
    key: &str,
    desired_base: &str,
    rewrites: &mut Vec<Rewrite>,
) {
    let old = match obj.get(key).and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => return,
    };
    if let Some(new) = rename_rel_if_needed(&old, desired_base, rewrites).await {
        if new != old {
            obj.insert(key.to_string(), Value::String(new));
        }
    }
}

// Rename each element's `sub` field via `basename_fn(entry) -> Option<base>`.
// The Option lets an entry opt out (empty label, missing number, etc)
// without special-casing at the call site.
async fn rename_array_field<F>(
    obj: &mut Map<String, Value>,
    key: &str,
    sub: &str,
    basename_fn: F,
    rewrites: &mut Vec<Rewrite>,
) where
    F: Fn(&Map<String, Value>) -> Option<String>,
{
    let arr = match obj.get_mut(key).and_then(|v| v.as_array_mut()) {
        Some(a) => a,
        None => return,
    };
    for entry in arr.iter_mut() {
        let Some(entry_obj) = entry.as_object_mut() else { continue };
        let old = match entry_obj.get(sub).and_then(|v| v.as_str()) {
            Some(s) if !s.is_empty() => s.to_string(),
            _ => continue,
        };
        let Some(desired) = basename_fn(entry_obj) else { continue };
        if let Some(new) = rename_rel_if_needed(&old, &desired, rewrites).await {
            if new != old {
                entry_obj.insert(sub.to_string(), Value::String(new));
            }
        }
    }
}

// Numbers-or-strings; some legacy items store `volumeCovers[].number`
// as JSON numbers and newer ones store strings.
fn stringify_scalar(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

// Rename one relative asset path to a title-based name. Returns the
// new relative path — or the original when nothing needs to change.
// Mirrors renameRelIfNeeded in electron/handlers/data.ts one-to-one:
//   - external URLs skip
//   - name already matches (or " N" collision variant) → short-circuit
//   - missing on disk → keep the path (rendered as broken image, but
//     no crash)
//   - actual rename records a Rewrite
async fn rename_rel_if_needed(
    rel: &str,
    desired_base: &str,
    rewrites: &mut Vec<Rewrite>,
) -> Option<String> {
    if rel.is_empty() {
        return Some(rel.to_string());
    }
    // External URL scheme → skip.
    let lower = rel.to_ascii_lowercase();
    if EXTERNAL_URL_PREFIXES.iter().any(|p| lower.starts_with(p)) {
        return Some(rel.to_string());
    }

    // Cheap short-circuit: is the name already correct (or a
    // "Base N" collision variant)?
    let step1 = BAD_CHARS.replace_all(desired_base, " ");
    let step2 = TRAILING.replace_all(&step1, "").to_string();
    let clean_base = step2.trim().to_string();
    if clean_base.is_empty() {
        return Some(rel.to_string());
    }
    let current_name = rel.rsplit('/').next().unwrap_or("");
    let current_base = current_name.rsplit_once('.').map(|(s, _)| s).unwrap_or(current_name);
    let collision_pattern = format!(r"^{}( \d+)?$", regex::escape(&clean_base));
    let collision_re = Regex::new(&collision_pattern).ok()?;
    if current_base == clean_base || collision_re.is_match(current_base) {
        return Some(rel.to_string());
    }

    // Resolve the absolute path (safe_relative rejects escapes).
    let abs = safe_relative(rel)?;
    if !file_exists(&abs).await {
        return Some(rel.to_string());
    }
    let new_abs = rename_asset_file(&abs, desired_base).await;
    if new_abs == abs {
        return Some(rel.to_string());
    }
    // Convert back to the "cat/kind/file.ext" form the JSONs store.
    let assets_root = &paths::get().assets_root;
    let new_rel = new_abs
        .strip_prefix(assets_root)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
    rewrites.push(Rewrite { from: rel.to_string(), to: new_rel.clone() });
    Some(new_rel)
}

// -- Commands -------------------------------------------------------

#[command]
pub async fn data_save(
    data: Option<Map<String, Value>>,
    state: State<'_, AppState>,
) -> Result<SaveResult, String> {
    let payload = data.unwrap_or_default();
    let rewrites = write_split_data(&state, &payload)
        .await
        .map_err(|e| e.to_string())?;
    Ok(SaveResult { ok: true, rewrites })
}

#[command]
pub async fn data_load(state: State<'_, AppState>) -> Result<Option<Map<String, Value>>, String> {
    let split = read_split_data(&state).await.map_err(|e| e.to_string())?;
    if let Some(ref data) = split {
        if data.get("items").and_then(|v| v.as_array()).map_or(false, |a| !a.is_empty()) {
            return Ok(split);
        }
    }
    if let Some(migrated) = migrate_legacy_if_needed(&state).await {
        return Ok(Some(migrated));
    }
    // Nothing on disk (fresh install) — return whatever readSplitData
    // gave us so the renderer sees a consistent (possibly empty) shape.
    Ok(split)
}

#[command]
pub async fn data_list_backups() -> Result<Vec<BackupEntry>, String> {
    let backups_dir = &paths::get().backups_dir;
    let mut results: Vec<BackupEntry> = Vec::new();
    for i in 1..=paths::BACKUP_COUNT {
        let slot = backups_dir.join(i.to_string());
        if !file_exists(&slot).await {
            continue;
        }
        let mut entries = match fs::read_dir(&slot).await {
            Ok(e) => e,
            Err(_) => continue,
        };
        let mut mtime = 0.0f64;
        let mut size = 0u64;
        while let Ok(Some(e)) = entries.next_entry().await {
            let meta = match e.metadata().await {
                Ok(m) => m,
                Err(_) => continue,
            };
            size += meta.len();
            if let Ok(modified) = meta.modified() {
                if let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH) {
                    let m = dur.as_secs_f64() * 1000.0;
                    if m > mtime {
                        mtime = m;
                    }
                }
            }
        }
        results.push(BackupEntry { file: format!("snapshot-{i}"), mtime, size });
    }
    Ok(results)
}

#[command]
pub async fn data_restore_backup(name: String, state: State<'_, AppState>) -> Result<bool, String> {
    // Extract snapshot slot number from the "snapshot-N" name — same
    // format the list command emits.
    static NAME_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^snapshot-([1-5])$").expect("snapshot re"));
    let Some(caps) = NAME_RE.captures(&name) else {
        return Ok(false);
    };
    let slot = paths::get().backups_dir.join(&caps[1]);
    if !file_exists(&slot).await {
        return Ok(false);
    }

    // Preserve current state before overwriting.
    let pre_restore = paths::get().storage_root.join("data.pre-restore");
    let _ = fs::remove_dir_all(&pre_restore).await;
    let _ = crate::util::copy_dir_recursive(&paths::get().data_dir, &pre_restore).await;

    // Wipe current data JSONs (keep backups/ dir untouched), then
    // copy snapshot in.
    if let Ok(mut current) = fs::read_dir(&paths::get().data_dir).await {
        while let Ok(Some(e)) = current.next_entry().await {
            if e.file_name().to_string_lossy().ends_with(".json") {
                let _ = fs::remove_file(e.path()).await;
            }
        }
    }
    if let Ok(mut snap) = fs::read_dir(&slot).await {
        while let Ok(Some(e)) = snap.next_entry().await {
            let name = e.file_name();
            if name.to_string_lossy().ends_with(".json") {
                let _ = fs::copy(e.path(), paths::get().data_dir.join(&name)).await;
            }
        }
    }

    // Invalidate hash cache so the next save can't skip a rewrite.
    state
        .last_hashes
        .lock()
        .expect("last_hashes poisoned")
        .clear();
    Ok(true)
}
