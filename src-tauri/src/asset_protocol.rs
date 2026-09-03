// Custom `omnio-asset://` URI scheme — serves files from
// `assets_root` to the webview. This is what makes covers, banners,
// logos and character portraits actually render inside the Tauri
// window.
//
// The Electron side registers the same protocol from `electron/main.ts`:
// `protocol.registerFileProtocol('omnio-asset', ...)`. The rendered
// paths in JSON on disk (`videojuegos/cover/xxx.jpg`) are the same for
// both backends, so no data migration is needed for the switch.
//
// URI layout: `omnio-asset://<category>/<kind>/<filename>`.
//   - `<category>` sits in the URI's HOST slot
//   - `<kind>/<filename>` sits in the PATH slot (leading slash)
// We stitch host + path back into the relative form the JSONs store,
// percent-decode it, resolve through `safe_relative` (path-traversal
// guard), and stream the bytes back with a `Content-Type` derived
// from the extension.

use crate::util::safe_relative;

use tauri::UriSchemeContext;
use tauri::http::{Request, Response, StatusCode};
use tauri::Wry;

fn build_error(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(Vec::new())
        .expect("build error response")
}

/// Synchronous handler — Tauri v2 runs URI-scheme handlers on a
/// dedicated worker thread, so blocking `std::fs::read` is fine here
/// and lets us avoid the ceremony of the async variant. If disk I/O
/// starts to matter for large screenshot galleries this can be
/// switched to `register_asynchronous_uri_scheme_protocol`.
pub fn handle(_ctx: UriSchemeContext<'_, Wry>, req: Request<Vec<u8>>) -> Response<Vec<u8>> {
    // Stitch back the relative path from host + path. The webview
    // request URI looks like `omnio-asset://games/cover/x.jpg` →
    // host = "games", path = "/cover/x.jpg" → rel = "games/cover/x.jpg".
    let uri = req.uri();
    let host = uri.host().unwrap_or("");
    let path = uri.path();
    let rel_encoded = if host.is_empty() {
        // `omnio-asset:///games/cover/x.jpg` — no host, absolute path.
        path.trim_start_matches('/').to_string()
    } else {
        format!("{host}{path}")
    };
    // Percent-decode — filenames commonly carry spaces (`Metro 2033
    // cover.jpg` → `Metro%202033%20cover.jpg`).
    let rel = match urlencoding::decode(&rel_encoded) {
        Ok(s) => s.into_owned(),
        Err(_) => rel_encoded,
    };

    // Path-traversal guard. `safe_relative` refuses anything that
    // resolves outside ASSETS_ROOT, matching the Electron protocol's
    // same defense.
    let Some(abs) = safe_relative(&rel) else {
        return build_error(StatusCode::FORBIDDEN);
    };

    // Read from disk. Missing file → 404 (renderer already tolerates
    // broken image references).
    let bytes = match std::fs::read(&abs) {
        Ok(b) => b,
        Err(err) => {
            // Distinguish "not there" from other IO errors so devtools
            // shows a useful reason in the network panel.
            let status = if err.kind() == std::io::ErrorKind::NotFound {
                StatusCode::NOT_FOUND
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            return build_error(status);
        }
    };

    let mime = mime_guess::from_path(&abs)
        .first_or_octet_stream()
        .as_ref()
        .to_string();

    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", mime)
        // Same permissive cache the Electron protocol uses — the on-
        // disk rename step gives new URLs when a file's asset renames,
        // and stale covers were never a real user complaint.
        .header("Cache-Control", "public, max-age=86400")
        .body(bytes)
        .unwrap_or_else(|_| build_error(StatusCode::INTERNAL_SERVER_ERROR))
}

// Path safety already accepts strings starting with `assets/` etc, but
// `omnio-asset://` URIs from the renderer never carry the `assets/`
// prefix (the folder is implicit in the protocol). Test that the
// stitching + normalize keeps things inside the root.
#[cfg(test)]
mod tests {
    use super::*;

    // We can't easily instantiate a full Tauri URI request in a unit
    // test, but the stitching logic is pure — extract it and test in
    // isolation.
    fn stitch(host: &str, path: &str) -> String {
        if host.is_empty() {
            path.trim_start_matches('/').to_string()
        } else {
            format!("{host}{path}")
        }
    }

    #[test]
    fn stitches_host_and_path() {
        assert_eq!(stitch("games", "/cover/x.jpg"), "games/cover/x.jpg");
        assert_eq!(stitch("", "/games/cover/x.jpg"), "games/cover/x.jpg");
        assert_eq!(stitch("music", "/edition/deluxe.png"), "music/edition/deluxe.png");
    }

    #[test]
    fn percent_decode_spaces() {
        let decoded = urlencoding::decode("Metro%202033%20cover.jpg").unwrap();
        assert_eq!(decoded, "Metro 2033 cover.jpg");
    }
}
