// Local install scanner — walks Steam / GOG / Epic library folders on
// the user's machine and returns a flat list of the games it can see
// on disk. Frontend cross-references against the current library to
// flag which ones aren't tracked yet.
//
// Everything is opt-in: the frontend passes the roots to scan (with
// sensible defaults for Windows), and we do a bounded directory
// listing — one level deep for Steam/GOG/Epic style folders that
// each hold `<game name>/` subfolders. We never open the exes.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::command;
use tokio::fs;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedGame {
    pub name: String,
    pub platform: String, // "Steam" | "GOG" | "Epic" | "Custom"
    pub install_path: String,
    // Best-effort primary exe — first `*.exe` we find at the top of the
    // game folder. Not guaranteed to be the actual launcher (game exes
    // often live in `bin/` subdirs), so the frontend treats this as a
    // hint the user can accept or edit later.
    pub exe_path: Option<String>,
    pub size_bytes: Option<u64>,
}

/// Default Windows install roots we probe when the frontend doesn't
/// pass explicit paths. Missing folders are silently ignored — a user
/// without one of the stores just doesn't see hits from it.
fn default_roots() -> Vec<(String, PathBuf)> {
    let mut out: Vec<(String, PathBuf)> = Vec::new();
    let program_files = std::env::var("ProgramFiles").ok();
    let program_files_x86 = std::env::var("ProgramFiles(x86)").ok();
    // Steam: default install has `steamapps/common/<Game>/`. Also
    // check the parsed `libraryfolders.vdf` in a follow-up if wanted;
    // for now the common case (C: install) already covers most users.
    if let Some(pf86) = &program_files_x86 {
        out.push(("Steam".into(), Path::new(pf86).join("Steam").join("steamapps").join("common")));
    }
    if let Some(pf) = &program_files {
        out.push(("Steam".into(), Path::new(pf).join("Steam").join("steamapps").join("common")));
    }
    // GOG: default installer drops games under `<Program Files>/
    // GOG Galaxy/Games` or `<Program Files (x86)>/GOG Games`. Common
    // variants shipped over the years.
    if let Some(pf86) = &program_files_x86 {
        out.push(("GOG".into(), Path::new(pf86).join("GOG Galaxy").join("Games")));
        out.push(("GOG".into(), Path::new(pf86).join("GOG Games")));
    }
    if let Some(pf) = &program_files {
        out.push(("GOG".into(), Path::new(pf).join("GOG Galaxy").join("Games")));
        out.push(("GOG".into(), Path::new(pf).join("GOG Games")));
    }
    // Epic Games Launcher: default `<Program Files>/Epic Games/`.
    if let Some(pf) = &program_files {
        out.push(("Epic".into(), Path::new(pf).join("Epic Games")));
    }
    if let Some(pf86) = &program_files_x86 {
        out.push(("Epic".into(), Path::new(pf86).join("Epic Games")));
    }
    out
}

// Recursively sum file sizes inside a single game folder, bounded to
// a couple of directory levels so a huge modded install doesn't drag
// the scan out for seconds. This is a "how big is it on disk" hint,
// not accounting-grade accuracy.
async fn dir_size(dir: &Path, depth: u32) -> u64 {
    if depth == 0 { return 0 }
    let mut total: u64 = 0;
    let mut stack: Vec<(PathBuf, u32)> = vec![(dir.to_path_buf(), depth)];
    while let Some((d, dep)) = stack.pop() {
        let mut it = match fs::read_dir(&d).await { Ok(x) => x, Err(_) => continue };
        while let Ok(Some(entry)) = it.next_entry().await {
            let ft = match entry.file_type().await { Ok(t) => t, Err(_) => continue };
            if ft.is_file() {
                if let Ok(md) = entry.metadata().await { total += md.len() }
            } else if ft.is_dir() && dep > 1 {
                stack.push((entry.path(), dep - 1))
            }
        }
    }
    total
}

async fn top_level_exe(dir: &Path) -> Option<String> {
    let mut it = fs::read_dir(dir).await.ok()?;
    while let Ok(Some(entry)) = it.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.to_ascii_lowercase().ends_with(".exe") { continue }
        // Skip obvious non-game launchers so the "primary exe" hint is
        // more useful than "UnityCrashHandler.exe".
        let lower = name.to_ascii_lowercase();
        if lower.contains("crash") || lower.contains("unins") || lower.contains("setup") { continue }
        return Some(entry.path().to_string_lossy().to_string())
    }
    None
}

#[command]
#[allow(non_snake_case)]
pub async fn install_scan(customRoots: Option<Vec<String>>) -> Result<Vec<DetectedGame>, String> {
    let mut roots: Vec<(String, PathBuf)> = default_roots();
    if let Some(extra) = customRoots {
        for r in extra {
            let p = PathBuf::from(&r);
            if p.exists() { roots.push(("Custom".into(), p)) }
        }
    }
    let mut out: Vec<DetectedGame> = Vec::new();
    for (platform, root) in roots {
        if !root.exists() { continue }
        let mut it = match fs::read_dir(&root).await { Ok(x) => x, Err(_) => continue };
        while let Ok(Some(entry)) = it.next_entry().await {
            let ft = match entry.file_type().await { Ok(t) => t, Err(_) => continue };
            if !ft.is_dir() { continue }
            let name = entry.file_name().to_string_lossy().to_string();
            // Steam engine folders that aren't games — DRM / redists
            let skip_lower = name.to_ascii_lowercase();
            if platform == "Steam"
                && (skip_lower == "steamworks shared" || skip_lower.contains("redist")) { continue }
            let path = entry.path();
            let exe_path = top_level_exe(&path).await;
            let size_bytes = Some(dir_size(&path, 2).await);
            out.push(DetectedGame {
                name,
                platform: platform.clone(),
                install_path: path.to_string_lossy().to_string(),
                exe_path,
                size_bytes,
            })
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}
