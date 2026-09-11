// Port of `electron/handlers/storage.ts` — maintenance operations the
// user triggers from Settings → Maintenance. Six commands on the TS
// side; five ported here (`storage:rename-all-assets` is deferred to
// Fase B step 4 because it depends on `renameAllAssets` from data.ts).
//
// Every command that walks the assets/ tree does so via `tokio::fs`
// so a large library doesn't block the main thread — Electron's
// `fs.promises.readdir` gave us the same guarantee for free.

use crate::handlers::data::{read_split_data, rename_all_assets, write_split_data, Rewrite};
use crate::paths;
use crate::state::AppState;
use crate::util::copy_dir_recursive;

use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::{command, State};
use tokio::fs;

// -- Result shapes ---------------------------------------------------
//
// Match the Electron IPC contract byte-for-byte. Untagged enums
// serialize as either the ok variant or the err variant with no
// discriminator field — same shape the renderer already destructures.

#[derive(Serialize)]
#[serde(untagged)]
pub enum CopyResult {
    Ok { ok: bool, path: String, files: usize },
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum CleanOrphanResult {
    Ok {
        ok: bool,
        removed: usize,
        bytes: u64,
        referenced: usize,
        scanned: usize,
    },
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum ImportAssetsResult {
    Ok { ok: bool, copied: usize },
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
pub struct CleanupArtifactsResult {
    pub removed: usize,
    pub bytes: u64,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum RenameAllResult {
    Ok { ok: bool, renamed: usize, rewrites: Vec<Rewrite> },
    Err { ok: bool, error: String },
}

// -- Referenced-asset field lists ------------------------------------
//
// Every AnyItem field that can hold an on-disk asset path — kept in
// sync with the TS side. Forgetting to add a new asset-bearing field
// here is a data-loss bug (the orphan sweep would delete the user's
// file), so both sides must edit together.
const SCALAR_ASSET_FIELDS: &[&str] = &[
    "cover", "bannerImage", "bannerImage2", "logoImage", "photo",
];

// (top-level array key, sub-key holding the asset path).
const ARRAY_ASSET_FIELDS: &[(&str, &str)] = &[
    ("volumeCovers", "cover"),
    ("singleCovers", "cover"),
    ("editions", "cover"),
    ("bundleContents", "cover"),
    ("saveFiles", "path"),
    ("screenshots", "path"),
    ("achievements", "icon"),
];

// -- storage:root ----------------------------------------------------
//
// Original: `electron/handlers/storage.ts` line 40. Exposes the
// resolved storage dir so the renderer's "Open in explorer" and
// "Show storage path" affordances can find it.
#[command]
pub async fn storage_root() -> String {
    paths::get().storage_root.display().to_string()
}

// -- storage:copy-data-to --------------------------------------------
//
// Original: line 46. One-click remote backup — copies every JSON
// under data/ plus the assets/ tree into a date-stamped subdir under
// `target_dir`. Users point this at Dropbox / OneDrive / Google Drive
// and the sync agent handles the upload.
#[command]
pub async fn storage_copy_data_to(target_dir: String) -> CopyResult {
    if target_dir.is_empty() {
        return CopyResult::Err { ok: false, error: "No folder chosen".into() };
    }
    // Same date stem the TS side uses: YYYY-MM-DD. std lacks strftime,
    // so we borrow the two datetime crates we already need (chrono
    // isn't in the tree yet — hand-format from SystemTime instead).
    let dest = PathBuf::from(&target_dir).join(format!("omnio-backup-{}", today_iso_date()));
    if let Err(e) = fs::create_dir_all(&dest).await {
        return CopyResult::Err { ok: false, error: e.to_string() };
    }
    let data_dir = &paths::get().data_dir;
    let mut entries = match fs::read_dir(data_dir).await {
        Ok(e) => e,
        Err(e) => return CopyResult::Err { ok: false, error: e.to_string() },
    };
    let mut files = 0usize;
    loop {
        match entries.next_entry().await {
            Ok(Some(e)) => {
                let name = match e.file_name().into_string() {
                    Ok(s) => s,
                    Err(_) => continue,
                };
                if !name.ends_with(".json") {
                    continue;
                }
                let ty = match e.file_type().await {
                    Ok(t) => t,
                    Err(_) => continue,
                };
                if !ty.is_file() {
                    continue;
                }
                if let Err(err) = fs::copy(e.path(), dest.join(&name)).await {
                    return CopyResult::Err { ok: false, error: err.to_string() };
                }
                files += 1;
            }
            Ok(None) => break,
            Err(e) => return CopyResult::Err { ok: false, error: e.to_string() },
        }
    }
    // Include assets so a cold restore on a new machine has covers
    // too. TS swallows failures here ("assets dir may not exist
    // yet") — we do the same.
    let assets = &paths::get().assets_root;
    if assets.is_dir() {
        let _ = copy_dir_recursive(assets, &dest.join("assets")).await;
    }
    CopyResult::Ok { ok: true, path: dest.display().to_string(), files }
}

// -- storage:clean-orphan-assets ------------------------------------
//
// Original: line 80. Walks every file under assets/ and unlinks the
// ones no JSON references — reclaims disk from the pre-"unlink on
// cancel" leak where every re-fetch during an edit session stranded
// an asset on save.
#[command]
pub async fn storage_clean_orphan_assets() -> CleanOrphanResult {
    let referenced = match collect_referenced_assets().await {
        Ok(r) => r,
        Err(e) => return CleanOrphanResult::Err { ok: false, error: e },
    };
    let assets_root = &paths::get().assets_root;
    let mut on_disk: Vec<PathBuf> = Vec::new();
    if let Err(e) = walk_dir(assets_root, &mut on_disk).await {
        return CleanOrphanResult::Err { ok: false, error: e.to_string() };
    }
    let mut removed = 0usize;
    let mut bytes = 0u64;
    for abs in &on_disk {
        // The JSONs store paths in `cat/kind/file.ext` form with
        // forward slashes — normalize regardless of the OS separator
        // so a Windows walk still matches paths written on Linux (or
        // vice versa, for users who cross-restore).
        let rel = match abs.strip_prefix(assets_root) {
            Ok(r) => r.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };
        // Skip anything owned by a plugin — plugin JSONs live under
        // `data/plugins/<slug>.json` and store bare filenames (not the
        // full `plugins/<slug>/<kind>/<file>` path), so the main
        // reference set never sees them. Plugins already manage their
        // own asset lifecycle via `plugin:asset-delete` on remove, so
        // scoping the sweep to non-plugin assets is safe.
        if rel.starts_with("plugins/") {
            continue;
        }
        if referenced.contains(&rel) {
            continue;
        }
        match fs::metadata(abs).await {
            Ok(meta) => {
                if fs::remove_file(abs).await.is_ok() {
                    removed += 1;
                    bytes += meta.len();
                }
                // If the unlink failed (file vanished between stat
                // and unlink, permission race) we silently skip —
                // same as the TS try/catch.
            }
            Err(_) => { /* vanished before we could stat, fine */ }
        }
    }
    CleanOrphanResult::Ok {
        ok: true,
        removed,
        bytes,
        referenced: referenced.len(),
        scanned: on_disk.len(),
    }
}

// -- storage:rename-all-assets --------------------------------------
//
// Original: `electron/handlers/storage.ts` line 147. User-triggered
// "rename every asset now" pass — reads the full library off disk,
// runs the same title-based renamer that the auto-save step uses,
// writes the JSONs back with the new paths, hands the rewrite map to
// the renderer so it can patch its in-memory state without a reload.
//
// Deferred out of Fase B step 3 until data.rs landed — the renamer
// lives in data.rs and re-exporting it here is the same pattern
// storage.ts uses on the Electron side.
#[command]
pub async fn storage_rename_all_assets(state: State<'_, AppState>) -> Result<RenameAllResult, ()> {
    let mut data = match read_split_data(&state).await {
        Ok(Some(d)) => d,
        Ok(None) => return Ok(RenameAllResult::Ok { ok: true, renamed: 0, rewrites: Vec::new() }),
        Err(e) => return Ok(RenameAllResult::Err { ok: false, error: e.to_string() }),
    };
    let rewrites = rename_all_assets(&mut data).await;
    if !rewrites.is_empty() {
        // Persist rewritten paths. write_split_data invokes the
        // renamer a second time, but every file is already correctly
        // named so the short-circuit fires and no extra I/O happens.
        if let Err(e) = write_split_data(&state, &data).await {
            return Ok(RenameAllResult::Err { ok: false, error: e.to_string() });
        }
    }
    Ok(RenameAllResult::Ok { ok: true, renamed: rewrites.len(), rewrites })
}

// -- storage:import-assets-from -------------------------------------
//
// Original: line 170. Bulk copy from `source_assets_dir` into the
// active assets/. Runs after a JSON restore from another install so
// the covers restore alongside the metadata. Overwrites on collision
// (the exporter's copy wins — user just chose it).
#[command]
pub async fn storage_import_assets_from(source_assets_dir: String) -> ImportAssetsResult {
    if source_assets_dir.is_empty() {
        return ImportAssetsResult::Err { ok: false, error: "No folder chosen".into() };
    }
    let src = PathBuf::from(&source_assets_dir);
    match fs::metadata(&src).await {
        Ok(m) if m.is_dir() => {}
        Ok(_) => return ImportAssetsResult::Err { ok: false, error: "Not a directory".into() },
        Err(e) => return ImportAssetsResult::Err { ok: false, error: e.to_string() },
    }
    let assets_root = &paths::get().assets_root;
    if let Err(e) = fs::create_dir_all(assets_root).await {
        return ImportAssetsResult::Err { ok: false, error: e.to_string() };
    }
    if let Err(e) = copy_dir_recursive(&src, assets_root).await {
        return ImportAssetsResult::Err { ok: false, error: e.to_string() };
    }
    // Count what we copied for the toast.
    let mut counted = 0usize;
    if let Err(e) = count_files(&src, &mut counted).await {
        return ImportAssetsResult::Err { ok: false, error: e.to_string() };
    }
    ImportAssetsResult::Ok { ok: true, copied: counted }
}

// -- storage:cleanup-migration-artifacts ----------------------------
//
// Original: line 198. Frees disk from the one-shot restore safety
// nets (`data.pre-split.json`, `data.pre-restore/`) that accumulate
// as users experiment with restore. Never touches the live data/ or
// numbered snapshots under `data/backups/`.
#[command]
pub async fn storage_cleanup_migration_artifacts() -> CleanupArtifactsResult {
    let root = &paths::get().storage_root;
    let targets: [PathBuf; 2] = [
        root.join("data.pre-split.json"),
        root.join("data.pre-restore"),
    ];
    let mut removed = 0usize;
    let mut bytes = 0u64;
    for p in &targets {
        let meta = match fs::metadata(p).await {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.is_dir() {
            // Sum sizes of the top-level entries before rm —
            // matches the TS behavior (doesn't recurse into
            // subdirs for the byte count, which is fine because the
            // pre-restore payload is a flat set of .json files).
            if let Ok(mut entries) = fs::read_dir(p).await {
                while let Ok(Some(e)) = entries.next_entry().await {
                    if let Ok(sub_meta) = e.metadata().await {
                        bytes += sub_meta.len();
                    }
                }
            }
            if fs::remove_dir_all(p).await.is_ok() {
                removed += 1;
            }
        } else {
            bytes += meta.len();
            if fs::remove_file(p).await.is_ok() {
                removed += 1;
            }
        }
    }
    CleanupArtifactsResult { removed, bytes }
}

// -- helpers --------------------------------------------------------

// Read every category / collections / artists JSON off disk, extract
// every asset path they reference, return the union as a HashSet.
// Paths that are data:/https:/blob:/file:/omnio-asset: skip the set —
// those aren't files under assets/ so the orphan sweep would never
// touch them anyway.
async fn collect_referenced_assets() -> Result<HashSet<String>, String> {
    let mut refs: HashSet<String> = HashSet::new();
    let data_dir = &paths::get().data_dir;

    // Same set of JSONs the TS scanner reads: every per-category
    // shard, collections, artists. Settings / customOrders / arcadeGames
    // don't carry asset paths.
    let mut names: Vec<String> =
        paths::CATEGORY_IDS.iter().map(|c| paths::file_for_category(c)).collect();
    names.push("collections.json".into());
    names.push("artists.json".into());

    for name in names {
        let p = data_dir.join(&name);
        let raw = match fs::read_to_string(&p).await {
            Ok(s) => s,
            Err(_) => continue,
        };
        let parsed: serde_json::Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let arr = match parsed.as_array() {
            Some(a) => a,
            None => continue,
        };
        for it in arr {
            let obj = match it.as_object() {
                Some(o) => o,
                None => continue,
            };
            // Scalar fields — one path per Item field.
            for key in SCALAR_ASSET_FIELDS {
                if let Some(v) = obj.get(*key) {
                    push_ref(v, &mut refs);
                }
            }
            // Array fields — each element carries one path under `sub`.
            for (key, sub) in ARRAY_ASSET_FIELDS {
                let entries = obj.get(*key).and_then(|v| v.as_array());
                if let Some(entries) = entries {
                    for entry in entries {
                        if let Some(entry_obj) = entry.as_object() {
                            if let Some(v) = entry_obj.get(*sub) {
                                push_ref(v, &mut refs);
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(refs)
}

fn push_ref(v: &serde_json::Value, refs: &mut HashSet<String>) {
    let s = match v.as_str() {
        Some(s) if !s.is_empty() => s,
        _ => return,
    };
    // Skip anything that isn't a filesystem path under assets/. Same
    // prefix set the TS side excludes so remote covers, data URLs and
    // omnio-asset:// don't get counted as references (they're not
    // files under assets/ anyway).
    let lower = s.to_ascii_lowercase();
    for prefix in &["data:", "http://", "https:", "file:", "blob:", "omnio-asset:"] {
        if lower.starts_with(prefix) {
            return;
        }
    }
    refs.insert(s.to_string());
}

// Recursive walk collecting every file's absolute path. Same shape as
// the TS `walk` closure in storage:clean-orphan-assets.
async fn walk_dir(dir: &Path, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    let mut entries = fs::read_dir(dir).await?;
    while let Some(e) = entries.next_entry().await? {
        let ty = e.file_type().await?;
        let full = e.path();
        if ty.is_dir() {
            Box::pin(walk_dir(&full, out)).await?;
        } else if ty.is_file() {
            out.push(full);
        }
    }
    Ok(())
}

// Recursive walk counting files. Uses a mutable counter so recursion
// doesn't allocate a Vec per level.
async fn count_files(dir: &Path, out: &mut usize) -> std::io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    let mut entries = fs::read_dir(dir).await?;
    while let Some(e) = entries.next_entry().await? {
        let ty = e.file_type().await?;
        if ty.is_dir() {
            Box::pin(count_files(&e.path(), out)).await?;
        } else if ty.is_file() {
            *out += 1;
        }
    }
    Ok(())
}

// Format today's date as YYYY-MM-DD for the backup subdir name.
// Duplicates a tiny slice of what chrono/time crates offer — we don't
// pull those in for one date stem.
fn today_iso_date() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    // Days since 1970-01-01, then convert to Y-M-D via the civil-
    // from-days algorithm (Howard Hinnant's, public domain). Handles
    // every date after 1970 correctly — the app didn't exist before
    // that anyway.
    let days = secs.div_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02}")
}

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
