// One-to-one ports of the shared helpers in `electron/util.ts`. Kept
// alone so `handlers/*.rs` stays focused on business logic. Every
// helper here is pure or takes its side-effect surface (a mutex, a
// path) explicitly through a parameter — no module-scope singletons
// beyond the SHA-1 dedup map that lives in `AppState`.
//
// The `dead_code` allow is deliberate: several helpers here
// (`sha1_hex`, `safe_relative`, `write_if_changed`, `build_asset_filename`,
// `next_available_asset_name`, `rename_asset_file`, the ext-maps)
// have no callers YET — they land alongside data.ts (Fase B step 4)
// and images.ts (step 5). Porting them now avoids doubling back into
// this file per step and lets each future handler port stay under
// 250 LoC.
#![allow(dead_code)]

use crate::paths;
use crate::state::AppState;
use regex::Regex;
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use std::sync::LazyLock as Lazy;
use tauri::State;
use tokio::fs;
use uuid::Uuid;

// -- sanitize_asset_name ---------------------------------------------
//
// Mirrors `electron/util.ts` sanitizeAssetName. Strips filesystem-
// reserved characters (Windows is the strictest), folds fullwidth
// CJK punctuation to ASCII, collapses whitespace runs, trims edges,
// prefixes bare DOS device names (CON, PRN, …) with `_`, and clamps
// to 80 chars — same limit as the TS side so both backends pick
// identical on-disk names for identical titles.

static BAD_CHARS: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"[<>:"/\\|?*\x00-\x1f]"#).expect("BAD_CHARS regex"));
static COLLAPSE_WS: Lazy<Regex> = Lazy::new(|| Regex::new(r"\s+").expect("COLLAPSE_WS regex"));
static TRAILING: Lazy<Regex> = Lazy::new(|| Regex::new(r"[. ]+$").expect("TRAILING regex"));
static DOS_RESERVED: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$").expect("DOS_RESERVED regex")
});

pub fn sanitize_asset_name(raw: &str) -> String {
    if raw.is_empty() {
        return String::new();
    }
    // Fold fullwidth CJK punctuation (U+FF01..U+FF5E) to ASCII by
    // subtracting the 0xFEE0 offset — mirrors the character-map
    // replace in the TS version so save files keep their original
    // title on Japanese Windows.
    let folded: String = raw
        .chars()
        .map(|c| {
            let cp = c as u32;
            if (0xFF01..=0xFF5E).contains(&cp) {
                char::from_u32(cp - 0xFEE0).unwrap_or(c)
            } else {
                c
            }
        })
        .collect();

    let step1 = BAD_CHARS.replace_all(&folded, " ");
    let step2 = COLLAPSE_WS.replace_all(&step1, " ");
    let step3 = step2.trim().to_string();
    let step4 = TRAILING.replace_all(&step3, "").to_string();
    let prefixed = if DOS_RESERVED.is_match(&step4) {
        format!("_{step4}")
    } else {
        step4
    };
    // Clamp to 80 CHARACTERS (not bytes) to match JS `String.slice(0, 80)`.
    prefixed.chars().take(80).collect()
}

// Same as `sanitizeAssetName` but more permissive — spaces and
// parentheses are kept so blob-dir names browsing under Explorer stay
// readable. Mirrors safeAssetFragment in electron/util.ts.
static FRAGMENT_BAD: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"[\\/:*?"<>|]+"#).expect("FRAGMENT_BAD regex"));

pub fn safe_asset_fragment(s: &str) -> String {
    let step1 = FRAGMENT_BAD.replace_all(s, "_");
    let step2 = COLLAPSE_WS.replace_all(&step1, " ");
    step2.trim().to_string()
}

// -- SHA-1 -----------------------------------------------------------
//
// Content hash for split-file write dedup. Same algorithm the TS
// `crypto.createHash('sha1')` produces so a mixed-backend save (rare
// but possible during migration) doesn't double-write on the first
// hand-off.
pub fn sha1_hex(s: &str) -> String {
    let mut h = Sha1::new();
    h.update(s.as_bytes());
    hex(&h.finalize())
}

fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{:02x}", b));
    }
    out
}

// -- File existence --------------------------------------------------
//
// True when `p` exists — file, dir, symlink, whatever. Same "if it's
// not there that's fine" probe the TS `fileExists` provides.
pub async fn file_exists(p: &Path) -> bool {
    fs::metadata(p).await.is_ok()
}

// -- Path safety -----------------------------------------------------
//
// Resolve a caller-supplied relative asset path to an absolute one,
// refusing anything that escapes ASSETS_ROOT. Every command that reads
// or writes an asset by relative path goes through this — a renderer
// (or the future Rust IPC) that supplies "../.././etc/passwd" gets
// None back before we touch disk. Mirrors safeRelative in
// electron/util.ts.
pub fn safe_relative(rel: &str) -> Option<PathBuf> {
    let assets_root = &paths::get().assets_root;
    // Strip any leading path separators the same way the TS code does
    // (`replace(/^([\/\\])+/, '')`).
    let stripped = rel.trim_start_matches(|c| c == '/' || c == '\\');
    let joined = assets_root.join(stripped);
    // `canonicalize` would refuse missing files. We match TS
    // `path.resolve` semantics with a manual normalization pass — join
    // then walk components dropping `..` unless it escapes.
    let normalized = normalize_no_follow(&joined);
    // Rejection: any resolved path that doesn't start with the assets
    // root. Compare canonicalized roots to defeat symlink shenanigans
    // to the extent std::path allows without touching disk.
    let root_abs = normalize_no_follow(assets_root);
    if !normalized.starts_with(&root_abs) {
        return None;
    }
    Some(normalized)
}

// Walk components, resolving `.` and `..` without touching disk. Used
// by safe_relative so we don't require the target file to exist yet
// (image:save writes brand new paths).
fn normalize_no_follow(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in p.components() {
        use std::path::Component;
        match c {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

// -- writeIfChanged --------------------------------------------------
//
// Write `content` to `filepath` iff its hash differs from the last
// value we recorded for the same path. Returns true when the write
// happened, false when it was skipped. Creates parent dirs as needed.
// State lives in `AppState.last_hashes` — the Mutex means concurrent
// writes to different files never block each other on the hash check.
pub async fn write_if_changed(
    state: &State<'_, AppState>,
    filepath: &Path,
    content: &str,
) -> std::io::Result<bool> {
    let hash = sha1_hex(content);
    {
        let cache = state.last_hashes.lock().expect("last_hashes poisoned");
        if cache.get(filepath).map(|v| v == &hash).unwrap_or(false) {
            return Ok(false);
        }
    }
    if let Some(parent) = filepath.parent() {
        fs::create_dir_all(parent).await?;
    }
    fs::write(filepath, content).await?;
    let mut cache = state.last_hashes.lock().expect("last_hashes poisoned");
    cache.insert(filepath.to_path_buf(), hash);
    Ok(true)
}

// -- MIME / extension maps -------------------------------------------
//
// Every value is a lossless format — same map as EXT_FROM_MIME in
// electron/util.ts. Used by the image:save handler (not ported yet)
// to turn a data-URL mime into the file extension we write.
pub fn ext_from_mime(mime: &str) -> Option<&'static str> {
    match mime {
        "image/png" => Some("png"),
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        "image/svg+xml" => Some("svg"),
        "image/avif" => Some("avif"),
        "image/bmp" => Some("bmp"),
        _ => None,
    }
}

// Reverse look-up used by image:download when the remote server
// refuses a Content-Type header. Keys are the extension *without* the
// leading dot, matching EXT_FROM_URL in electron/util.ts.
pub fn ext_from_url_ext(ext: &str) -> Option<&'static str> {
    match ext.to_ascii_lowercase().as_str() {
        "png" => Some("png"),
        "jpg" | "jpeg" => Some("jpg"),
        "webp" => Some("webp"),
        "gif" => Some("gif"),
        "avif" => Some("avif"),
        "bmp" => Some("bmp"),
        "svg" => Some("svg"),
        _ => None,
    }
}

// -- Asset filename builders ----------------------------------------
//
// Compose an on-disk filename for a new asset. When `basename` is
// present (e.g. "Metro 2033 Redux cover"), uses it with a
// numeric-suffix collision handler; when absent, falls back to a UUID
// so callers without the item title still work. Mirrors
// buildAssetFilename in electron/util.ts.
pub async fn build_asset_filename(
    dir: &Path,
    basename: Option<&str>,
    ext: &str,
) -> String {
    let clean = basename.map(|b| sanitize_asset_name(b)).unwrap_or_default();
    if clean.is_empty() {
        return format!("{}.{}", Uuid::new_v4(), ext);
    }
    let primary = format!("{clean}.{ext}");
    if !file_exists(&dir.join(&primary)).await {
        return primary;
    }
    for n in 2..1000 {
        let candidate = format!("{clean} {n}.{ext}");
        if !file_exists(&dir.join(&candidate)).await {
            return candidate;
        }
    }
    // 1000 same-name files is basically never; fall back to UUID
    // suffix like the TS side does.
    let uuid = Uuid::new_v4().simple().to_string();
    format!("{clean} {}.{}", &uuid[..8], ext)
}

// Append " (2)", " (3)"… before the extension until unused. Preserves
// the original filename when there's no conflict. Used by asset-blob
// saves where the user picked the source filename. Mirrors
// nextAvailableAssetName in electron/util.ts.
pub async fn next_available_asset_name(dir: &Path, original: &str) -> String {
    if !file_exists(&dir.join(original)).await {
        return original.to_string();
    }
    let (stem, ext) = match original.rfind('.') {
        Some(i) if i > 0 => (&original[..i], &original[i..]),
        _ => (original, ""),
    };
    for n in 2..1000 {
        let candidate = format!("{stem} ({n}){ext}");
        if !file_exists(&dir.join(&candidate)).await {
            return candidate;
        }
    }
    let uuid = Uuid::new_v4().simple().to_string();
    format!("{stem}-{}{ext}", &uuid[..8])
}

// Rename `file_abs` to a title-based name in the same directory.
// Returns the new absolute path — or the original when the rename
// wasn't needed or failed. Collision policy: append " 2", " 3"… before
// the extension when a *different* file already occupies the desired
// name; a hit on the current file is a no-op. Mirrors renameAssetFile
// in electron/util.ts.
pub async fn rename_asset_file(file_abs: &Path, desired_base: &str) -> PathBuf {
    let dir = match file_abs.parent() {
        Some(d) => d,
        None => return file_abs.to_path_buf(),
    };
    let ext = file_abs.extension().and_then(|s| s.to_str()).unwrap_or("");
    let ext_with_dot = if ext.is_empty() { String::new() } else { format!(".{ext}") };
    let current_name = file_abs.file_name().and_then(|s| s.to_str()).unwrap_or("");

    // Strip filesystem-reserved chars + trailing dots/spaces the same
    // way the TS side does (a lightweight version of
    // `sanitizeAssetName` without the CJK fold, matching the original).
    let step1 = BAD_CHARS.replace_all(desired_base, " ");
    let step2 = TRAILING.replace_all(&step1, "").to_string();
    let clean_base = step2.trim().to_string();
    if clean_base.is_empty() {
        return file_abs.to_path_buf();
    }

    let primary = format!("{clean_base}{ext_with_dot}");
    if current_name == primary {
        return file_abs.to_path_buf();
    }

    let mut candidate = dir.join(&primary);
    let mut n = 2u32;
    while file_exists(&candidate).await {
        // Same-file hit → no-op. `canonicalize` is not always
        // possible (Windows short-path quirks); compare normalized
        // logical paths as a best-effort match.
        if normalize_no_follow(&candidate) == normalize_no_follow(file_abs) {
            return file_abs.to_path_buf();
        }
        candidate = dir.join(format!("{clean_base} {n}{ext_with_dot}"));
        n += 1;
        if n > 999 {
            return file_abs.to_path_buf();
        }
    }

    match fs::rename(file_abs, &candidate).await {
        Ok(()) => candidate,
        Err(_) => file_abs.to_path_buf(),
    }
}

// -- Recursive directory copy ---------------------------------------
//
// Rust std has no `fs.cp(..., { recursive: true })` — walk it
// ourselves with tokio::fs so the whole tree stays non-blocking. Same
// semantics as Electron's `fs.cp(..., { recursive: true, force: true })`:
// destination files are overwritten. `Box::pin` inside is required by
// async recursion (the returned Future would otherwise be infinitely
// sized).
pub async fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst).await?;
    let mut entries = fs::read_dir(src).await?;
    while let Some(entry) = entries.next_entry().await? {
        let ty = entry.file_type().await?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            Box::pin(copy_dir_recursive(&src_path, &dst_path)).await?;
        } else {
            fs::copy(&src_path, &dst_path).await?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_reserved_chars() {
        assert_eq!(sanitize_asset_name("a/b?c*d"), "a b c d");
    }

    #[test]
    fn collapses_and_trims() {
        assert_eq!(sanitize_asset_name("  hi   there  "), "hi there");
    }

    #[test]
    fn escapes_dos_names() {
        assert_eq!(sanitize_asset_name("con"), "_con");
        assert_eq!(sanitize_asset_name("LPT3"), "_LPT3");
    }

    #[test]
    fn clamps_length() {
        let s = "a".repeat(200);
        assert_eq!(sanitize_asset_name(&s).chars().count(), 80);
    }

    #[test]
    fn folds_fullwidth_cjk_punct() {
        // U+FF01 FULLWIDTH EXCLAMATION MARK → '!' (ASCII). `!` isn't
        // in the bad-chars set, so it survives — this just checks
        // the fold half of the pipeline runs. U+FF1F FULLWIDTH
        // QUESTION MARK folds to '?' which IS a bad char and gets
        // stripped, tested in `strips_reserved_chars` indirectly.
        assert_eq!(sanitize_asset_name("hi\u{FF01}"), "hi!");
    }

    #[test]
    fn empty_stays_empty() {
        assert_eq!(sanitize_asset_name(""), "");
    }

    #[test]
    fn safe_fragment_keeps_spaces_and_parens() {
        assert_eq!(safe_asset_fragment("Metro 2033 (Redux)"), "Metro 2033 (Redux)");
    }

    #[test]
    fn safe_fragment_replaces_reserved_with_underscore() {
        assert_eq!(safe_asset_fragment("a/b:c"), "a_b_c");
    }

    #[test]
    fn sha1_matches_known_digest() {
        // Same digest the TS `crypto.createHash('sha1').update('abc')` produces.
        assert_eq!(sha1_hex("abc"), "a9993e364706816aba3e25717850c26c9cd0d89d");
    }
}
