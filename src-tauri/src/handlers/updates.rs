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
// plugin needs Ed25519-signed artifacts and a `latest.json` manifest, and
// it has no answer for the portable ZIP or the .deb / .rpm packages.
// Omnio polls GitHub Releases directly instead, one command per phase:
//
//   updates_check          — GET the latest release, compare semver
//   updates_install_kind   — which build did the user install
//   updates_open_url       — open a URL in the default browser
//   updates_download       — stream the asset to the cache with progress,
//                            then check its SHA-256 against GitHub's digest
//   updates_reveal         — show the downloaded file in the file manager
//   updates_apply          — install the verified file the way that build
//                            was installed, quit, and open the new version
//
// Progress events go through the standard Tauri event bus
// (`AppHandle::emit`); the renderer listens for `updates:progress`.

use crate::net::get_http_client;
use crate::state::AppState;

use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, USER_AGENT};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
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
    /// Lowercase hex SHA-256 from GitHub's asset `digest`, when present.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
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
    Ok { ok: bool, path: String, size: u64, verified: bool },
    Err { ok: bool, error: String },
}

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
    /// `"sha256:<hex>"`, computed by GitHub for every uploaded asset.
    #[serde(default)]
    digest: Option<String>,
}

fn sha256_from_digest(digest: Option<String>) -> Option<String> {
    let d = digest?;
    let hex = d.strip_prefix("sha256:")?.trim().to_lowercase();
    (hex.len() == 64 && hex.chars().all(|c| c.is_ascii_hexdigit())).then_some(hex)
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
        .map(|a| ReleaseAssetOut {
            name: a.name,
            url: a.browser_download_url,
            size: a.size,
            sha256: sha256_from_digest(a.digest),
        })
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
    match crate::paths::windows_install_kind(&exe) {
        Some(crate::paths::WindowsInstall::Msi) => ("win-msi", ".msi"),
        Some(crate::paths::WindowsInstall::Nsis) => ("win-nsis", "-setup.exe"),
        _ => ("win-portable", "windows-portable.zip"),
    }
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
    // Both `.deb` and `.rpm` install the binary under `/usr/bin/` (or
    // `/usr/local/bin/` if built from source with a custom prefix). To
    // pick the right update asset we peek at `/etc/os-release` and read
    // the distro's `ID` / `ID_LIKE`.
    if path.starts_with("/usr/bin/") || path.starts_with("/usr/local/bin/") {
        return match detect_linux_package_family() {
            LinuxPackageFamily::Rpm => ("linux-rpm", ".rpm"),
            LinuxPackageFamily::Deb => ("linux-deb", ".deb"),
        };
    }
    // Fallback: AppImage. Covers users who moved the AppImage payload
    // out of its default location and lost the $APPIMAGE env var.
    ("linux-appimage", ".AppImage")
}

enum LinuxPackageFamily {
    Deb,
    Rpm,
}

/// Read `/etc/os-release` and decide whether the distro belongs to the
/// rpm family (Fedora, RHEL, CentOS, Rocky, AlmaLinux, openSUSE…) or
/// the deb family (Debian, Ubuntu, Mint, Pop!_OS…). Anything else falls
/// back to deb — Debian's userbase is the larger of the two, so a
/// mis-detected obscure distro at least gets the more likely artifact.
fn detect_linux_package_family() -> LinuxPackageFamily {
    let content = match std::fs::read_to_string("/etc/os-release") {
        Ok(s) => s,
        Err(_) => return LinuxPackageFamily::Deb,
    };
    // The file is shell-style `KEY=value` with optional quotes. We only
    // care about `ID` and `ID_LIKE`; parse simply.
    let mut id = String::new();
    let mut id_like = String::new();
    for line in content.lines() {
        let (k, v) = match line.split_once('=') {
            Some(kv) => kv,
            None => continue,
        };
        let v = v.trim_matches('"').trim_matches('\'').to_lowercase();
        match k {
            "ID" => id = v,
            "ID_LIKE" => id_like = v,
            _ => {}
        }
    }
    // Union both fields so an id_like="fedora rhel" derivative still hits.
    let haystack = format!("{id} {id_like}");
    const RPM_MARKERS: &[&str] = &[
        "fedora", "rhel", "centos", "rocky", "almalinux", "amazon",
        "opensuse", "suse", "mandriva", "openmandriva", "mageia",
    ];
    for marker in RPM_MARKERS {
        if haystack.contains(marker) {
            return LinuxPackageFamily::Rpm;
        }
    }
    LinuxPackageFamily::Deb
}

// -- updates:open-url -----------------------------------------------

#[command]
pub async fn updates_open_url(url: String, app: AppHandle) -> bool {
    app.shell().open(url, None).is_ok()
}

// Downloads go to `<app cache>/updates/`, emptied on the next start
// (see `cleanup_after_update`). Nothing is written next to the install
// until the file has passed its SHA-256 check.
fn updates_cache_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("omnio"))
        .join("updates")
}

async fn sha256_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).await.map_err(|e| e.to_string())?;
    let hash = tokio::task::spawn_blocking(move || {
        Sha256::digest(&bytes).iter().map(|b| format!("{b:02x}")).collect::<String>()
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(hash)
}

// -- updates:download ------------------------------------------------
//
// Streaming download with progress events (`updates:progress`). When
// `sha256` is given the finished file is hashed and compared; a
// mismatch deletes the file and reports `checksum-mismatch`, so a
// corrupted or tampered download is never installed. `verified: false`
// means the release had no digest to compare against; the renderer then
// offers only "Show in folder", never an automatic install.
#[command]
pub async fn updates_download(
    url: String,
    filename: String,
    sha256: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DownloadResult, ()> {
    let target_dir = updates_cache_dir(&app);
    if let Err(e) = fs::create_dir_all(&target_dir).await {
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
    let target = target_dir.join(&safe_name);

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
        // Throttle progress events to ~10 per MiB so a fast mirror
        // doesn't drown the renderer in messages.
        if received - last_report > 200_000 {
            let _ = app.emit("updates:progress", ProgressEvent { received, total });
            last_report = received;
        }
    }
    if let Err(e) = file.flush().await {
        return Ok(DownloadResult::Err { ok: false, error: e.to_string() });
    }
    drop(file);
    // Final progress event so the bar hits 100% even when the last
    // chunk lands under the 200KB threshold.
    let _ = app.emit(
        "updates:progress",
        ProgressEvent { received, total: if total == 0 { received } else { total } },
    );

    let verified = match sha256.as_deref().map(str::to_lowercase) {
        Some(expected) => {
            let actual = match sha256_file(&target).await {
                Ok(h) => h,
                Err(e) => return Ok(DownloadResult::Err { ok: false, error: e }),
            };
            if actual != expected {
                let _ = fs::remove_file(&target).await;
                return Ok(DownloadResult::Err { ok: false, error: "checksum-mismatch".into() });
            }
            true
        }
        None => false,
    };
    Ok(DownloadResult::Ok {
        ok: true,
        path: target.display().to_string(),
        size: received,
        verified,
    })
}

// -- updates:reveal --------------------------------------------------
//
// Shows the downloaded file in the file manager.
#[command]
pub async fn updates_reveal(#[allow(non_snake_case)] filePath: String) -> bool {
    crate::reveal::reveal_file(std::path::Path::new(&filePath))
}

// -- updates:apply ---------------------------------------------------
//
// Installs a downloaded, verified update the same way the running build
// was installed, then quits so the new version can start:
//
//   win-nsis       setup.exe /P /R /UPDATE — Tauri's NSIS template runs
//                  passive (progress bar only) and reopens Omnio (/R)
//   win-msi        msiexec /passive AUTOLAUNCHAPP=True — Windows may ask
//                  for permission once (per-machine install)
//   win-portable   unzip, rename the running exe to `.old`, write the new
//                  one in its place; the data folder is never touched
//   mac-*          mount the DMG, swap the .app bundle, unmount, reopen
//   linux-appimage replace the AppImage file in place, reopen
//   linux-deb/rpm  dpkg -i / rpm -U through pkexec (password prompt)
//
// Wherever Omnio has to reopen itself, a small detached shell waits for
// this process to exit first so two instances never write the library
// at the same time.
#[command]
pub async fn updates_apply(
    #[allow(non_snake_case)] filePath: String,
    kind: String,
    app: AppHandle,
) -> SimpleOk {
    let path = PathBuf::from(&filePath);
    if !path.starts_with(updates_cache_dir(&app)) || !path.is_file() {
        return SimpleOk::Err { ok: false, error: "Update file not found".into() };
    }
    let result = match kind.as_str() {
        "win-nsis" => apply_windows_installer(&path, &["/P", "/R", "/UPDATE"]),
        "win-msi" => apply_windows_msi(&path),
        "win-portable" => apply_windows_portable(&path),
        "mac-arm64" | "mac-x64" => apply_mac_dmg(&path).await,
        "linux-appimage" => apply_appimage(&path),
        "linux-deb" | "linux-rpm" => apply_linux_package(&path, &kind).await,
        _ => Err("This build can't be updated automatically".into()),
    };
    match result {
        Ok(()) => {
            let handle = app.clone();
            tokio::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(400)).await;
                handle.exit(0);
            });
            SimpleOk::Ok { ok: true }
        }
        Err(error) => SimpleOk::Err { ok: false, error },
    }
}

#[allow(dead_code)]
fn detached(cmd: &mut std::process::Command) -> &mut std::process::Command {
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
}

#[cfg(windows)]
fn apply_windows_installer(setup: &Path, args: &[&str]) -> Result<(), String> {
    detached(std::process::Command::new(setup).args(args))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn apply_windows_msi(msi: &Path) -> Result<(), String> {
    detached(
        std::process::Command::new("msiexec")
            .arg("/i")
            .arg(msi)
            .args(["/passive", "AUTOLAUNCHAPP=True"]),
    )
    .spawn()
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn apply_windows_portable(zip_path: &Path) -> Result<(), String> {
    use std::io::Read;
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let index = (0..archive.len())
        .find(|&i| {
            archive
                .by_index(i)
                .map(|f| f.name().to_lowercase().ends_with(".exe"))
                .unwrap_or(false)
        })
        .ok_or("The portable ZIP has no .exe inside")?;
    let mut bytes = Vec::new();
    archive
        .by_index(index)
        .map_err(|e| e.to_string())?
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;

    // A running exe can be renamed on Windows but not overwritten: move
    // it aside, write the new one under the original name, and put the
    // old one back if anything fails.
    let old = exe.with_extension("exe.old");
    let _ = std::fs::remove_file(&old);
    std::fs::rename(&exe, &old).map_err(|e| e.to_string())?;
    if let Err(e) = std::fs::write(&exe, &bytes) {
        let _ = std::fs::rename(&old, &exe);
        return Err(e.to_string());
    }
    relaunch_after_exit(&exe)
}

#[cfg(windows)]
fn relaunch_after_exit(exe: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let script = format!(
        "$p = {pid}; while (Get-Process -Id $p -ErrorAction SilentlyContinue) {{ Start-Sleep -Milliseconds 300 }}; Start-Process -FilePath '{exe}'",
        pid = std::process::id(),
        exe = exe.display().to_string().replace('\'', "''"),
    );
    detached(
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW),
    )
    .spawn()
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[cfg(unix)]
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Waits for this process to exit, then runs `then` in a detached shell.
#[cfg(unix)]
fn after_exit(then: &str) -> Result<(), String> {
    let script = format!(
        "while kill -0 {pid} 2>/dev/null; do sleep 0.3; done; {then}",
        pid = std::process::id(),
    );
    detached(std::process::Command::new("sh").args(["-c", &script]))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
async fn apply_mac_dmg(dmg: &Path) -> Result<(), String> {
    // .../Omnio.app/Contents/MacOS/omnio → .../Omnio.app
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let bundle = exe
        .ancestors()
        .find(|p| p.extension().map(|e| e == "app").unwrap_or(false))
        .ok_or("Omnio isn't running from an .app bundle")?
        .to_path_buf();
    let parent = bundle.parent().ok_or("No parent folder")?;
    let probe = parent.join(".omnio-update-write-probe");
    if std::fs::write(&probe, b"").is_err() {
        return Err(format!("No permission to write to {}", parent.display()));
    }
    let _ = std::fs::remove_file(&probe);

    let mount = std::env::temp_dir().join(format!("omnio-update-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&mount);
    let status = tokio::process::Command::new("hdiutil")
        .args(["attach", "-nobrowse", "-readonly", "-mountpoint"])
        .arg(&mount)
        .arg(dmg)
        .status()
        .await
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("Couldn't open the disk image".into());
    }
    let new_app = std::fs::read_dir(&mount)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .find(|p| p.extension().map(|e| e == "app").unwrap_or(false));
    let Some(new_app) = new_app else {
        let _ = std::process::Command::new("hdiutil").arg("detach").arg(&mount).arg("-quiet").status();
        return Err("The disk image has no app inside".into());
    };
    let (b, n, m) = (
        shell_quote(&bundle.display().to_string()),
        shell_quote(&new_app.display().to_string()),
        shell_quote(&mount.display().to_string()),
    );
    // Keep the old bundle until the copy succeeded; restore it otherwise.
    after_exit(&format!(
        "rm -rf {b}.old; mv {b} {b}.old && if ditto {n} {b}; then rm -rf {b}.old; else rm -rf {b}; mv {b}.old {b}; fi; \
         hdiutil detach {m} -quiet; xattr -cr {b} 2>/dev/null; open {b}"
    ))
}

#[cfg(target_os = "linux")]
fn apply_appimage(new_file: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let target = std::env::var("APPIMAGE")
        .ok()
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .ok_or("Omnio isn't running from an AppImage")?;
    // Copy next to the target first so the final rename stays on one
    // filesystem; renaming over a running AppImage is safe on Linux.
    let staged = target.with_extension("AppImage.new");
    std::fs::copy(new_file, &staged).map_err(|e| e.to_string())?;
    std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    std::fs::rename(&staged, &target).map_err(|e| {
        let _ = std::fs::remove_file(&staged);
        e.to_string()
    })?;
    after_exit(&format!("nohup {} >/dev/null 2>&1 &", shell_quote(&target.display().to_string())))
}

#[cfg(target_os = "linux")]
async fn apply_linux_package(pkg: &Path, kind: &str) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut cmd = tokio::process::Command::new("pkexec");
    if kind == "linux-deb" {
        cmd.arg("dpkg").arg("-i").arg(pkg);
    } else {
        cmd.args(["rpm", "-U", "--replacepkgs"]).arg(pkg);
    }
    let status = cmd.status().await.map_err(|_| "pkexec isn't available on this system".to_string())?;
    match status.code() {
        Some(0) => {}
        // pkexec: 126 = the password dialog was dismissed, 127 = not authorized.
        Some(126) | Some(127) => return Err("The installation was canceled".into()),
        _ => return Err("The package manager couldn't install the update".into()),
    }
    after_exit(&format!("nohup {} >/dev/null 2>&1 &", shell_quote(&exe.display().to_string())))
}

// Stubs for the platforms each installer doesn't apply to, so
// `updates_apply` compiles everywhere and reports a plain error.
#[cfg(not(windows))]
fn apply_windows_installer(_: &Path, _: &[&str]) -> Result<(), String> { Err("Windows only".into()) }
#[cfg(not(windows))]
fn apply_windows_msi(_: &Path) -> Result<(), String> { Err("Windows only".into()) }
#[cfg(not(windows))]
fn apply_windows_portable(_: &Path) -> Result<(), String> { Err("Windows only".into()) }
#[cfg(not(target_os = "macos"))]
async fn apply_mac_dmg(_: &Path) -> Result<(), String> { Err("macOS only".into()) }
#[cfg(not(target_os = "linux"))]
fn apply_appimage(_: &Path) -> Result<(), String> { Err("Linux only".into()) }
#[cfg(not(target_os = "linux"))]
async fn apply_linux_package(_: &Path, _: &str) -> Result<(), String> { Err("Linux only".into()) }

/// Startup housekeeping after an in-app update: removes the portable
/// build's `.old` exe and the downloaded installers.
pub fn cleanup_after_update(app: &AppHandle) {
    if let Ok(exe) = std::env::current_exe() {
        let _ = std::fs::remove_file(exe.with_extension("exe.old"));
    }
    let _ = std::fs::remove_dir_all(updates_cache_dir(app));
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
    fn digest_parses_github_sha256() {
        let hex = "a".repeat(64);
        assert_eq!(sha256_from_digest(Some(format!("sha256:{hex}"))), Some(hex.clone()));
        assert_eq!(sha256_from_digest(Some(format!("sha256:{}", hex.to_uppercase()))), Some(hex));
        assert_eq!(sha256_from_digest(Some("sha512:abc".into())), None);
        assert_eq!(sha256_from_digest(Some("sha256:xyz".into())), None);
        assert_eq!(sha256_from_digest(None), None);
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
