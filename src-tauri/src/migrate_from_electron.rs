// Fase E first-boot migration — copies the user's existing Electron
// library into Tauri's storage root the first time the Tauri build
// runs. After that, both installs point to distinct folders and the
// user can uninstall Electron without losing data.
//
// Detection:
//   Windows: %APPDATA%\Omnio
//   macOS:   ~/Library/Application Support/Omnio
//   Linux:   ~/.config/Omnio  (Electron's userData default)
//
// Guards:
//   - Only fire when the Tauri storage root exists but has no `data/`
//     folder yet (fresh install marker)
//   - Never touch anything if a marker file `.migrated-from-electron`
//     is present (idempotency across re-boots)
//   - Never overwrite anything that already exists on the Tauri side
//     (belt-and-braces — the emptiness check above should catch it)
//
// The Electron backend stays untouched throughout — this is a copy,
// not a move, so if the Tauri POC misbehaves the user can go back to
// the Electron build with zero data loss.

use crate::util::copy_dir_recursive;

use std::path::{Path, PathBuf};
use tokio::fs;

const MIGRATION_MARKER: &str = ".migrated-from-electron";

fn electron_storage_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        // Electron's userData on Windows is %APPDATA%\<productName>.
        // Package.json declares "name": "Omnio" — matches.
        std::env::var("APPDATA").ok().map(|s| PathBuf::from(s).join("Omnio"))
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|s| PathBuf::from(s).join("Library").join("Application Support").join("Omnio"))
    }
    #[cfg(target_os = "linux")]
    {
        // Electron uses XDG_CONFIG_HOME/<name> when set, else
        // $HOME/.config/<name>. Same fallback chain here.
        std::env::var("XDG_CONFIG_HOME")
            .ok()
            .map(PathBuf::from)
            .or_else(|| std::env::var("HOME").ok().map(|s| PathBuf::from(s).join(".config")))
            .map(|p| p.join("Omnio"))
    }
}

/// Copy the Electron library into `new_root` if we detect one and the
/// destination is fresh. Returns `Ok(true)` when a migration actually
/// happened, `Ok(false)` when there was nothing to do. Errors are
/// logged and swallowed — a failed migration should never block boot;
/// the user can retry by removing the marker or the destination folder.
pub async fn migrate_if_needed(new_root: &Path) -> bool {
    // Marker already present → migration ran (or was explicitly
    // marked done by the user).
    let marker = new_root.join(MIGRATION_MARKER);
    if fs::metadata(&marker).await.is_ok() {
        return false;
    }
    // Destination already has data → don't overwrite existing user
    // work under any circumstance.
    if fs::metadata(new_root.join("data")).await.is_ok() {
        // Drop the marker so we don't keep checking on every boot.
        let _ = drop_marker(new_root, "destination already populated").await;
        return false;
    }
    // Source not present → nothing to migrate. Skip marker so a user
    // who later installs Electron alongside still gets the migration.
    let Some(src_root) = electron_storage_root() else {
        return false;
    };
    let src_data = src_root.join("data");
    let src_assets = src_root.join("assets");
    if fs::metadata(&src_data).await.is_err() {
        return false;
    }

    // Create the destination root if needed and copy both trees.
    // Assets is best-effort — a user who has never fetched a cover
    // won't have that folder yet, and that's OK.
    if let Err(e) = fs::create_dir_all(new_root).await {
        eprintln!("[migrate] cannot create Tauri storage root {new_root:?}: {e}");
        return false;
    }
    let dst_data = new_root.join("data");
    if let Err(e) = copy_dir_recursive(&src_data, &dst_data).await {
        eprintln!("[migrate] copy data failed: {e}");
        return false;
    }
    if fs::metadata(&src_assets).await.is_ok() {
        let dst_assets = new_root.join("assets");
        if let Err(e) = copy_dir_recursive(&src_assets, &dst_assets).await {
            eprintln!("[migrate] copy assets failed (continuing without): {e}");
        }
    }
    // Success — drop the marker so we don't run again on next boot.
    let _ = drop_marker(new_root, "electron library imported").await;

    eprintln!(
        "[migrate] imported Electron library from {} → {}",
        src_root.display(),
        new_root.display()
    );
    true
}

async fn drop_marker(root: &Path, note: &str) -> std::io::Result<()> {
    let marker = root.join(MIGRATION_MARKER);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    fs::write(&marker, format!("{note}\nunix_seconds: {now}\n")).await
}
