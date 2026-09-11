// Auto-update polling + assisted download — Rust port of
// `electron/handlers/updates.ts`.
//
// The three `Shell::open` calls below flag as deprecated — Tauri v2's
// current guidance is to use `tauri-plugin-opener` instead, which also
// exposes a cross-platform `reveal_item_in_dir`. Adding that plugin
// is a separate refactor (new npm dep, plugin registration in main.rs,
// touch images.rs reveal too). Silenced here with an allow so the POC
// stays warning-clean; migration tracked as a follow-up.
#![allow(deprecated)]
//
// We deliberately do NOT switch to `tauri-plugin-updater` here. That
// plugin assumes signed artifacts with a specific manifest format
// (Ed25519 signatures, latest.json shape) and Omnio's builds are
// unsigned across every target (portable EXE, DMG without notarisation,
// AppImage). The TS side polls GitHub Releases directly and lets the
// user download the matching asset themselves — same approach ported
// here, one command per phase of the flow:
//
//   updates_check          — GET the latest release, compare semver
//   updates_install_kind   — which build did the user install
//   updates_open_url       — open a URL in the default browser
//   updates_download       — stream the asset to ~/Downloads with progress
//   updates_reveal         — show the downloaded file in the file manager
//   updates_launch_installer — Windows: kick off NSIS setup then quit
//   updates_appimage_swap  — Linux: chmod + spawn new AppImage + quit
//   updates_open_dmg       — macOS: open .dmg for the Finder drag flow
//
// Progress events go through the standard Tauri event bus
// (`AppHandle::emit`); the renderer listens for `updates:progress`
// exactly the same way it listens today.

use crate::net::get_http_client;
use crate::state::AppState;

use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{command, AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::ShellExt;
use tokio::fs;
use tokio::io::AsyncWriteExt;

const GITHUB_LATEST_RELEASE: &str =
    "https://api.github.com/repos/TonyMontania/Omnio/releases/latest";

// -- Result shapes ---------------------------------------------------

#[derive(Serialize)]
pub struct ReleaseAssetOut {
    pub name: String,
    pub url: String,
    pub size: u64,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum UpdatesCheckResult {
    Ok {
        ok: bool,
        #[serde(rename = "hasUpdate")]
        has_update: bool,
        current: String,
        latest: String,
        #[serde(rename = "htmlUrl", skip_serializing_if = "Option::is_none")]
        html_url: Option<String>,
        #[serde(rename = "publishedAt", skip_serializing_if = "Option::is_none")]
        published_at: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        notes: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        assets: Option<Vec<ReleaseAssetOut>>,
    },
    Err { ok: bool, error: String },
}

#[derive(Serialize)]
pub struct InstallKindResult {
    pub kind: &'static str,
    #[serde(rename = "assetHint")]
    pub asset_hint: &'static str,
    pub platform: &'static str,
    pub arch: &'static str,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum DownloadResult {
    Ok { ok: bool, path: String, size: u64 },
    Err { ok: bool, error: String },
}

// Ok variant only fires on Unix targets (AppImage is Linux-only);
// silence "never constructed" on Windows.
#[allow(dead_code)]
#[derive(Serialize)]
#[serde(untagged)]
pub enum SimpleOk {
    Ok { ok: bool },
    Err { ok: bool, error: String },
}

#[derive(Serialize, Clone)]
pub struct ProgressEvent {
    pub received: u64,
    pub total: u64,
}

// -- GitHub release DTO ---------------------------------------------
//
// Same field subset the TS reads. `#[serde(default)]` on optionals
// keeps parsing forgiving — GitHub occasionally omits `body` or
// `published_at` for a draft, and we shouldn't crash the check.

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    assets: Vec<ReleaseAsset>,
}

#[derive(Deserialize)]
struct ReleaseAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

// -- Semver comparison ----------------------------------------------
//
// Same "strip leading v, split on ., pad to 3, compare left to right"
// scheme as the TS `parseSemver` / `isNewer`. Rejects anything that
// doesn't parse to at most 3 numeric parts — a malformed tag is
// treated as "not newer" so a bad release doesn't nag the user.

fn parse_semver(v: &str) -> Option<[u32; 3]> {
    let clean = v.trim().trim_start_matches(|c| c == 'v' || c == 'V');
    let mut out = [0u32; 3];
    for (i, part) in clean.split('.').enumerate() {
        if i >= 3 {
            break;
        }
        // Strip anything after the first non-digit run so
        // "0.4.1-beta" parses as [0, 4, 1]. Same forgiving stance TS
        // has via parseInt.
        let digits: String = part.chars().take_while(|c| c.is_ascii_digit()).collect();
        if digits.is_empty() {
            return None;
        }
        out[i] = digits.parse().ok()?;
    }
    Some(out)
}

fn is_newer(latest: &str, current: &str) -> bool {
    let Some(a) = parse_semver(latest) else { return false };
    let Some(b) = parse_semver(current) else { return false };
    for i in 0..3 {
        if a[i] > b[i] { return true }
        if a[i] < b[i] { return false }
    }
    false
}

// -- updates:check ---------------------------------------------------

#[command]
pub async fn updates_check(
    #[allow(non_snake_case)] currentVersion: String,
    state: State<'_, AppState>,
) -> Result<UpdatesCheckResult, ()> {
    let client = get_http_client(&state);
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/vnd.github+json"));
    headers.insert(USER_AGENT, HeaderValue::from_static("Omnio-update-check"));

    let resp = match client.get(GITHUB_LATEST_RELEASE).headers(headers).send().await {
        Ok(r) => r,
        Err(e) => return Ok(UpdatesCheckResult::Err { ok: false, error: e.to_string() }),
    };
    if !resp.status().is_success() {
        return Ok(UpdatesCheckResult::Err {
            ok: false,
            error: format!("HTTP {}", resp.status().as_u16()),
        });
    }
    let json: GithubRelease = match resp.json().await {
        Ok(j) => j,
        Err(e) => return Ok(UpdatesCheckResult::Err { ok: false, error: e.to_string() }),
    };
    if json.draft || json.prerelease {
        // Same non-error, "no update" shape the TS returns for drafts.
        return Ok(UpdatesCheckResult::Ok {
            ok: true,
            has_update: false,
            current: currentVersion,
            latest: json.tag_name,
            html_url: None,
            published_at: None,
            notes: None,
            assets: None,
        });
    }
    let has_update = is_newer(&json.tag_name, &currentVersion);
    let assets: Vec<ReleaseAssetOut> = json
        .assets
        .into_iter()
        .map(|a| ReleaseAssetOut { name: a.name, url: a.browser_download_url, size: a.size })
        .collect();
    Ok(UpdatesCheckResult::Ok {
        ok: true,
        has_update,
        current: currentVersion,
        latest: json.tag_name,
        html_url: Some(json.html_url),
        published_at: json.published_at,
        notes: json.body,
        assets: Some(assets),
    })
}

// -- updates:install-kind -------------------------------------------
//
// Which build did the user actually install? Fed into the "download
// this asset" hint in the update dialog so a portable user doesn't get
// pointed at the NSIS setup by mistake, and vice versa for MSI + .deb.
//
// Detection is done by inspecting `current_exe()` against the default
// install directories the Tauri v2 bundlers use:
//
//   Windows
//     * NSIS  → `%LOCALAPPDATA%\Programs\<ProductName>\`
//     * MSI   → `%ProgramFiles%\<ProductName>\` (or `Program Files (x86)`)
//     * anything else → treat as portable (zip extracted somewhere)
//   Linux
//     * AppImage → the runtime sets `$APPIMAGE` to the .AppImage path
//     * .deb    → installs binary to `/usr/bin/` (or `/usr/local/bin/`)
//     * anything else → default to AppImage (safest fallback)
//   macOS
//     * arm64 vs x64 → uses arch alone (single .app bundle format)
//
// The asset-hint strings are matched against release asset filenames
// with `endsWith` on the renderer side, so they must line up with what
// `.github/workflows/release.yml` publishes.
#[command]
pub fn updates_install_kind() -> InstallKindResult {
    let platform = std::env::consts::OS;      // "windows" / "macos" / "linux"
    let arch = std::env::consts::ARCH;         // "x86_64" / "aarch64"
    let platform_node = match platform {
        "windows" => "win32",
        "macos" => "darwin",
        other => other,
    };
    let arch_node = match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => other,
    };

    let (kind, asset_hint): (&'static str, &'static str) = match platform_node {
        "win32" => detect_windows_install_kind(),
        "darwin" => match arch_node {
            // Suffix strings match Tauri v2's default DMG naming
            // (`Omnio_<version>_aarch64.dmg` / `Omnio_<version>_x64.dmg`).
            "arm64" => ("mac-arm64", "aarch64.dmg"),
            _ => ("mac-x64", "x64.dmg"),
        },
        "linux" => detect_linux_install_kind(),
        _ => ("unknown", ""),
    };
    InstallKindResult {
        kind,
        asset_hint,
        platform: platform_node,
        arch: arch_node,
    }
}

fn detect_windows_install_kind() -> (&'static str, &'static str) {
    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return ("win-portable", "windows-portable.zip"),
    };
    let path_lower = exe.to_string_lossy().to_lowercase();
    // MSI's default target on Windows is `%ProgramFiles%` — treat both
    // 32-bit and 64-bit Program Files trees as MSI installs. The asset
    // suffix is `.msi` alone so the match is locale-tolerant (the
    // artifact ships as `Omnio_<version>_x64_en-US.msi` today, but a
    // future locale swap wouldn't break the hint).
    if path_lower.contains("\\program files\\") || path_lower.contains("\\program files (x86)\\") {
        return ("win-msi", ".msi");
    }
    // NSIS's default target is `%LOCALAPPDATA%\Programs\<ProductName>`.
    // (The path may resolve to `\users\<name>\appdata\local\programs\…`.)
    if path_lower.contains("\\appdata\\local\\programs\\") {
        return ("win-nsis", "-setup.exe");
    }
    // Anywhere else the exe lives (Desktop, C:\Tools\Omnio, an external
    // drive, …) means the user ran the portable zip. Match the release
    // asset `Omnio_<version>_windows-portable.zip`.
    ("win-portable", "windows-portable.zip")
}

fn detect_linux_install_kind() -> (&'static str, &'static str) {
    // The AppImage runtime sets `$APPIMAGE` to the .AppImage file's
    // absolute path when it launches the payload. Presence of the var
    // is the canonical way to tell we're running from an AppImage.
    if std::env::var("APPIMAGE").map(|v| !v.is_empty()).unwrap_or(false) {
        return ("linux-appimage", ".AppImage");
    }
    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return ("linux-appimage", ".AppImage"),
    };
    let path = exe.to_string_lossy().to_string();
    // .deb installs the binary under `/usr/bin/` (or `/usr/local/bin/`
    // if built from source with a custom prefix). Match the release
    // asset `omnio_<version>_amd64.deb`.
    if path.starts_with("/usr/bin/") || path.starts_with("/usr/local/bin/") {
        return ("linux-deb", ".deb");
    }
    // Fallback: AppImage. Covers users who moved the AppImage payload
    // out of its default location and lost the $APPIMAGE env var.
    ("linux-appimage", ".AppImage")
}

// -- updates:open-url -----------------------------------------------

#[command]
pub async fn updates_open_url(url: String, app: AppHandle) -> bool {
    app.shell().open(url, None).is_ok()
}

// -- updates:download ------------------------------------------------
//
// Streaming download with progress events. The renderer listens for
// `updates:progress` via `listen('updates:progress', ...)` — the event
// name and payload shape match the TS side byte-for-byte so the front
// wiring stays identical.
#[command]
pub async fn updates_download(
    url: String,
    filename: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DownloadResult, ()> {
    // Downloads dir via Tauri path resolver. `download_dir()` may fail
    // on locked-down configs — fall back to app data root so the
    // download still lands somewhere the user can find.
    let downloads_dir = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")));
    if let Err(e) = fs::create_dir_all(&downloads_dir).await {
        return Ok(DownloadResult::Err { ok: false, error: e.to_string() });
    }
    // Reject filesystem-reserved chars — same char set the TS strips.
    let safe_name: String = filename
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if (c as u32) < 0x20 => '_',
            c => c,
        })
        .collect();
    let target = downloads_dir.join(&safe_name);

    let client = get_http_client(&state);
    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return Ok(DownloadResult::Err { ok: false, error: e.to_string() }),
    };
    if !resp.status().is_success() {
        return Ok(DownloadResult::Err {
            ok: false,
            error: format!("HTTP {}", resp.status().as_u16()),
        });
    }
    let total = resp.content_length().unwrap_or(0);

    let mut file = match fs::File::create(&target).await {
        Ok(f) => f,
        Err(e) => return Ok(DownloadResult::Err { ok: false, error: e.to_string() }),
    };
    let mut stream = resp.bytes_stream();
    let mut received: u64 = 0;
    let mut last_report: u64 = 0;

    while let Some(chunk) = stream.next().await {
        let bytes = match chunk {
            Ok(b) => b,
            Err(e) => return Ok(DownloadResult::Err { ok: false, error: e.to_string() }),
        };
        if let Err(e) = file.write_all(&bytes).await {
            return Ok(DownloadResult::Err { ok: false, error: e.to_string() });
        }
        received += bytes.len() as u64;
        // Throttle progress events to ~10 per MiB — same 200KB
        // threshold as the TS side so a fast mirror doesn't drown
        // the renderer in messages.
        if received - last_report > 200_000 {
            let _ = app.emit("updates:progress", ProgressEvent { received, total });
            last_report = received;
        }
    }
    if let Err(e) = file.flush().await {
        return Ok(DownloadResult::Err { ok: false, error: e.to_string() });
    }
    // Final progress event so the renderer's bar hits 100% even when
    // the last chunk lands under the 200KB threshold.
    let _ = app.emit(
        "updates:progress",
        ProgressEvent { received, total: if total == 0 { received } else { total } },
    );
    Ok(DownloadResult::Ok {
        ok: true,
        path: target.display().to_string(),
        size: received,
    })
}

// -- updates:reveal --------------------------------------------------
//
// Same "reveal in file manager" pattern as asset_blob_reveal — on
// Windows we use `explorer.exe /select,<path>` which selects the file
// in Explorer. On other platforms we fall back to opening the parent
// directory since tauri-plugin-shell doesn't expose a cross-platform
// reveal_item_in_dir.
#[command]
pub async fn updates_reveal(#[allow(non_snake_case)] filePath: String, app: AppHandle) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = app;  // suppress "unused" warning on Windows
        let _ = Command::new("explorer.exe")
            .arg(format!("/select,{filePath}"))
            .spawn();
        return true;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Best-effort: open parent dir via the shell plugin.
        let parent = std::path::Path::new(&filePath).parent().map(|p| p.to_string_lossy().into_owned());
        if let Some(p) = parent {
            return app.shell().open(p, None).is_ok();
        }
        false
    }
}

// -- updates:launch-installer ---------------------------------------
//
// Windows NSIS: open the setup (association handles it) and quit. UAC
// + SmartScreen still appear because the build is unsigned; one
// approval and then it's a normal setup wizard.
#[command]
pub async fn updates_launch_installer(
    #[allow(non_snake_case)] filePath: String,
    app: AppHandle,
) -> bool {
    if app.shell().open(filePath, None).is_err() {
        return false;
    }
    let handle = app.clone();
    // Same 500ms delay as the TS setTimeout — give the OS enough time
    // to hand the process off before we exit.
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        handle.exit(0);
    });
    true
}

// -- updates:appimage-swap -------------------------------------------
//
// Linux: chmod +x the new AppImage, spawn it detached, quit. The new
// process takes over and the old file can be deleted whenever the
// user wants.
#[command]
pub async fn updates_appimage_swap(
    #[allow(non_snake_case)] newPath: String,
    app: AppHandle,
) -> SimpleOk {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let path = std::path::PathBuf::from(&newPath);
        let mut perms = match std::fs::metadata(&path).map(|m| m.permissions()) {
            Ok(p) => p,
            Err(e) => return SimpleOk::Err { ok: false, error: e.to_string() },
        };
        perms.set_mode(0o755);
        if let Err(e) = std::fs::set_permissions(&path, perms) {
            return SimpleOk::Err { ok: false, error: e.to_string() };
        }
        use std::process::Command;
        if let Err(e) = Command::new(&path)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
        {
            return SimpleOk::Err { ok: false, error: e.to_string() };
        }
        let handle = app.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            handle.exit(0);
        });
        SimpleOk::Ok { ok: true }
    }
    #[cfg(not(unix))]
    {
        let _ = newPath;
        let _ = app;
        SimpleOk::Err { ok: false, error: "AppImage swap is Linux-only".into() }
    }
}

// -- updates:open-dmg ------------------------------------------------
//
// macOS: open the .dmg so Finder mounts it. User drags Omnio.app to
// Applications like a normal install.
#[command]
pub async fn updates_open_dmg(#[allow(non_snake_case)] filePath: String, app: AppHandle) -> bool {
    app.shell().open(filePath, None).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semver_parses() {
        assert_eq!(parse_semver("0.4.1"), Some([0, 4, 1]));
        assert_eq!(parse_semver("v0.4.1"), Some([0, 4, 1]));
        assert_eq!(parse_semver("V0.4.1"), Some([0, 4, 1]));
        assert_eq!(parse_semver("0.4"), Some([0, 4, 0]));
        assert_eq!(parse_semver("1"), Some([1, 0, 0]));
        assert_eq!(parse_semver("0.4.1-beta"), Some([0, 4, 1]));
        assert_eq!(parse_semver("garbage"), None);
        assert_eq!(parse_semver(""), None);
    }

    #[test]
    fn is_newer_walks_left_to_right() {
        assert!(is_newer("0.4.2", "0.4.1"));
        assert!(is_newer("0.5.0", "0.4.9"));
        assert!(is_newer("1.0.0", "0.9.9"));
        assert!(!is_newer("0.4.1", "0.4.1"));
        assert!(!is_newer("0.4.0", "0.4.1"));
        // v-prefix normalized on both sides.
        assert!(is_newer("v0.4.2", "0.4.1"));
        assert!(is_newer("0.4.2", "v0.4.1"));
        // Malformed → conservative "not newer".
        assert!(!is_newer("garbage", "0.4.1"));
    }
}
