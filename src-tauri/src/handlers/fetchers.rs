// External metadata fetchers — Rust port of
// `electron/handlers/fetchers.ts`. 17 sources, 28 commands. One region
// per source (SteamGridDB, Jikan, Kitsu, MangaDex, ComicVine,
// MusicBrainz, VGMdb, IGDB, TMDb, AniList, Steam, OpenLibrary, VNDB,
// Discogs, lrclib, AniDB, PCGamingWiki).
//
// Structure mirrors the TS 1:1 — same URLs, same headers, same
// pagination caps, same soft-error detection. Every command returns
// `Result<Value, ()>` where the inner Value is the shared envelope
// (`{ ok: true, data }` or `{ ok: false, error }`) the renderer
// already pattern-matches on.
//
// Every JSON fetch goes through `net::proxy_json`; caching for search-
// shaped calls goes through `net::cached_search`; rate-limited
// endpoints (MusicBrainz, AniDB) go through the dedicated throttlers
// in net.rs.

#![allow(non_snake_case)]  // command args match renderer-side names (categoryId, dataUrl, etc.)

use crate::net::{cached_search, get_http_client, proxy_json, ProxyJsonOptions, anidb_throttle, mb_throttle};
use crate::state::AppState;

use reqwest::Method;
use serde_json::{json, Value};
use std::sync::LazyLock as Lazy;
use std::time::{Duration, Instant};
use tauri::{command, State};
use tokio::sync::Mutex as AsyncMutex;

// -- Envelope helpers ------------------------------------------------
//
// Same shape the TS returns: { ok: true, data } | { ok: false, error }.
// Kept generic (`Value`) because every fetcher's success shape is API-
// specific — the renderer already walks the payload manually.

fn ok(data: Value) -> Value {
    json!({ "ok": true, "data": data })
}

fn err(msg: impl Into<String>) -> Value {
    json!({ "ok": false, "error": msg.into() })
}

// URL-encoding — reqwest doesn't ship a public helper, so we hand-roll
// one matching JavaScript's `encodeURIComponent`. Same char set: keep
// A-Z a-z 0-9 - _ . ! ~ * ' ( ), percent-encode everything else.
fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9'
            | b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

// URLSearchParams-style querystring builder for readability.
fn qs(pairs: &[(&str, &str)]) -> String {
    let mut out = String::new();
    for (i, (k, v)) in pairs.iter().enumerate() {
        if i > 0 { out.push('&'); }
        out.push_str(&url_encode(k));
        out.push('=');
        out.push_str(&url_encode(v));
    }
    out
}

// Shared User-Agent used by every free / no-key public API that just
// asks for one. Matches the TS constants.
const OMNIO_UA: &str = "Omnio/0.5.0 ( https://github.com/TonyMontania/Omnio )";

// ===================================================================
// SteamGridDB
// ===================================================================
const SGDB_BASE: &str = "https://www.steamgriddb.com/api/v2";

#[command]
pub async fn sgdb_search(apiKey: String, term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if apiKey.is_empty() || term.trim().is_empty() {
        return Ok(err("Missing API key or search term"));
    }
    let client = get_http_client(&state);
    let url = format!("{SGDB_BASE}/search/autocomplete/{}", url_encode(&term));
    let auth = format!("Bearer {apiKey}");
    let opts = ProxyJsonOptions {
        method: Method::GET,
        headers: vec![("Authorization", &auth)],
        body: None,
        http_error_prefix: "HTTP",
    };
    match proxy_json(&client, &url, opts).await {
        Ok(v) => Ok(ok(v.get("data").cloned().unwrap_or(json!([])))),
        Err(e) => Ok(err(e)),
    }
}

#[command]
pub async fn sgdb_assets(
    apiKey: String,
    kind: String,  // 'grids' | 'heroes' | 'logos'
    gameId: Value,  // number or string
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    let game_id = match &gameId {
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        _ => return Ok(err("Missing API key or game id")),
    };
    if apiKey.is_empty() || game_id.is_empty() {
        return Ok(err("Missing API key or game id"));
    }
    let client = get_http_client(&state);
    let url = format!("{SGDB_BASE}/{kind}/game/{game_id}");
    let auth = format!("Bearer {apiKey}");
    let opts = ProxyJsonOptions {
        method: Method::GET,
        headers: vec![("Authorization", &auth)],
        body: None,
        http_error_prefix: "HTTP",
    };
    match proxy_json(&client, &url, opts).await {
        Ok(v) => Ok(ok(v.get("data").cloned().unwrap_or(json!([])))),
        Err(e) => Ok(err(e)),
    }
}

// ===================================================================
// Jikan v4 — unofficial MyAnimeList proxy with retries on 5xx / 429.
// ===================================================================
#[command]
pub async fn jikan_search(term: String, kind: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let source = format!("jikan:{kind}");
    let key = term.clone();
    let result = cached_search(&state, &source, &key, || async {
        let url = format!(
            "https://api.jikan.moe/v4/{kind}?q={}&limit=12&sfw=false",
            url_encode(term.trim())
        );
        let client = get_http_client(&state);
        let mut last_error = String::from("Search failed");
        for attempt in 0..3usize {
            match client.get(&url).send().await {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    if resp.status().is_success() {
                        match resp.bytes().await {
                            Ok(body) => match serde_json::from_slice::<Value>(&body) {
                                Ok(json) => {
                                    let data = json.get("data").cloned().unwrap_or(json!([]));
                                    return ok(data);
                                }
                                Err(e) => last_error = format!("bad JSON: {e}"),
                            },
                            Err(e) => last_error = e.to_string(),
                        }
                    } else {
                        let hint = match status {
                            504 => " — MAL upstream timed out, retry in a moment",
                            429 => " — Jikan rate limit hit (3/sec, 60/min). Wait a few seconds and retry.",
                            _ => "",
                        };
                        last_error = format!("HTTP {status}{hint}");
                        let retriable = matches!(status, 504 | 502 | 503 | 429 | 408);
                        if !retriable { return err(last_error); }
                    }
                }
                Err(e) => last_error = e.to_string(),
            }
            if attempt < 2 {
                let wait_ms = if last_error.contains("429") {
                    3000 * (attempt as u64 + 1)
                } else {
                    800 * (attempt as u64 + 1)
                };
                tokio::time::sleep(Duration::from_millis(wait_ms)).await;
            }
        }
        err(last_error)
    })
    .await;
    Ok(result)
}

// ===================================================================
// Kitsu — free, no-key anime/manga fallback (JSON:API).
// ===================================================================
const KITSU_BASE: &str = "https://kitsu.io/api/edge";

#[command]
pub async fn kitsu_search(term: String, kind: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let source = format!("kitsu:{kind}");
    let key = term.clone();
    let result = cached_search(&state, &source, &key, || async {
        let query = qs(&[
            ("filter[text]", term.trim()),
            ("page[limit]", "15"),
        ]);
        let url = format!("{KITSU_BASE}/{kind}?{query}");
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::GET,
            headers: vec![("Accept", "application/vnd.api+json")],
            body: None,
            http_error_prefix: "HTTP",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => {
                // Soft error: `{ errors: [{ title, detail }] }`
                if let Some(errs) = v.get("errors").and_then(|e| e.as_array()) {
                    if let Some(first) = errs.first() {
                        let msg = first
                            .get("detail").and_then(|d| d.as_str())
                            .or_else(|| first.get("title").and_then(|d| d.as_str()))
                            .unwrap_or("Kitsu error");
                        return err(msg);
                    }
                }
                ok(v.get("data").cloned().unwrap_or(json!([])))
            }
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

// ===================================================================
// MangaDex — no key. `includes[]` joins cover_art/author/artist so one
// search returns everything needed to build a patch.
// ===================================================================
const MD_BASE: &str = "https://api.mangadex.org";

fn md_soft_error(v: &Value) -> Option<String> {
    if v.get("result").and_then(|r| r.as_str()) == Some("error") {
        let msg = v
            .get("errors").and_then(|a| a.as_array())
            .and_then(|arr| arr.first())
            .and_then(|e| e.get("detail")).and_then(|d| d.as_str())
            .unwrap_or("MangaDex returned an error");
        return Some(msg.to_string());
    }
    None
}

#[command]
pub async fn mangadex_search(term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let key = term.clone();
    let result = cached_search(&state, "mangadex", &key, || async {
        // The query needs multiple `includes[]=X` — qs() can't help because
        // its keys are unique. Build the tail manually.
        let mut query = qs(&[("title", term.trim()), ("limit", "15")]);
        for inc in ["cover_art", "author", "artist"] {
            query.push_str("&includes%5B%5D=");
            query.push_str(&url_encode(inc));
        }
        let url = format!("{MD_BASE}/manga?{query}");
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::GET,
            headers: vec![("User-Agent", OMNIO_UA), ("Accept", "application/json")],
            body: None,
            http_error_prefix: "HTTP",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => {
                if let Some(msg) = md_soft_error(&v) { return err(msg); }
                ok(v.get("data").cloned().unwrap_or(json!([])))
            }
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn mangadex_covers(mangaId: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if mangaId.is_empty() { return Ok(err("Missing manga id")); }
    let mut query = qs(&[("limit", "100"), ("order[volume]", "asc")]);
    query.push_str("&manga%5B%5D=");
    query.push_str(&url_encode(&mangaId));
    let url = format!("{MD_BASE}/cover?{query}");
    let client = get_http_client(&state);
    let opts = ProxyJsonOptions {
        method: Method::GET,
        headers: vec![("User-Agent", OMNIO_UA), ("Accept", "application/json")],
        body: None,
        http_error_prefix: "HTTP",
    };
    match proxy_json(&client, &url, opts).await {
        Ok(v) => {
            if let Some(msg) = md_soft_error(&v) { return Ok(err(msg)); }
            Ok(ok(v.get("data").cloned().unwrap_or(json!([]))))
        }
        Err(e) => Ok(err(e)),
    }
}

// ===================================================================
// ComicVine (GameSpot). Free API key. "Volume" = series.
// ===================================================================
const CV_BASE: &str = "https://comicvine.gamespot.com/api";

fn cv_soft_error(v: &Value) -> Option<String> {
    let e = v.get("error").and_then(|x| x.as_str())?;
    (e != "OK").then(|| e.to_string())
}

#[command]
pub async fn comicvine_search(apiKey: String, term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if apiKey.is_empty() || term.trim().is_empty() {
        return Ok(err("Missing API key or search term"));
    }
    let key = term.clone();
    let result = cached_search(&state, "comicvine", &key, || async {
        let url = format!(
            "{CV_BASE}/search/?api_key={}&format=json&resources=volume&query={}&limit=15&field_list=id,name,deck,start_year,count_of_issues,publisher,image,api_detail_url",
            url_encode(&apiKey), url_encode(term.trim())
        );
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::GET,
            headers: vec![("User-Agent", OMNIO_UA), ("Accept", "application/json")],
            body: None,
            http_error_prefix: "HTTP",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => {
                if let Some(msg) = cv_soft_error(&v) { return err(msg); }
                ok(v.get("results").cloned().unwrap_or(json!([])))
            }
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn comicvine_volume(apiKey: String, id: Value, state: State<'_, AppState>) -> Result<Value, ()> {
    let id_str = match &id {
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        _ => return Ok(err("Missing API key or volume id")),
    };
    if apiKey.is_empty() || id_str.is_empty() {
        return Ok(err("Missing API key or volume id"));
    }
    // Volume ids are prefixed 4050- in ComicVine's canonical URL scheme.
    let url = format!(
        "{CV_BASE}/volume/4050-{id_str}/?api_key={}&format=json&field_list=id,name,deck,description,start_year,count_of_issues,publisher,image,person_credits,character_credits",
        url_encode(&apiKey)
    );
    let client = get_http_client(&state);
    let opts = ProxyJsonOptions {
        method: Method::GET,
        headers: vec![("User-Agent", OMNIO_UA), ("Accept", "application/json")],
        body: None,
        http_error_prefix: "HTTP",
    };
    match proxy_json(&client, &url, opts).await {
        Ok(v) => {
            if let Some(msg) = cv_soft_error(&v) { return Ok(err(msg)); }
            Ok(ok(v.get("results").cloned().unwrap_or(Value::Null)))
        }
        Err(e) => Ok(err(e)),
    }
}

// ===================================================================
// MusicBrainz — 1 req/s throttled. release-group-details is
// multi-stage (find releases → pick official → fetch tracklist →
// optionally enrich with release-group tags).
// ===================================================================
const MB_BASE: &str = "https://musicbrainz.org/ws/2";
fn mb_headers() -> Vec<(&'static str, &'static str)> {
    vec![("User-Agent", OMNIO_UA), ("Accept", "application/json")]
}

#[command]
pub async fn mb_search(term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let key = term.clone();
    let result = cached_search(&state, "mb", &key, || async {
        mb_throttle().await;
        let url = format!(
            "{MB_BASE}/release-group?query={}&limit=15&fmt=json",
            url_encode(term.trim())
        );
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::GET,
            headers: mb_headers(),
            body: None,
            http_error_prefix: "HTTP",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => ok(v.get("release-groups").cloned().unwrap_or(json!([]))),
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn mb_release_group_details(
    releaseGroupId: String,
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    if releaseGroupId.is_empty() { return Ok(err("Missing release-group id")); }
    let client = get_http_client(&state);

    // Step 1 — list releases in the group, prefer the first Official one.
    mb_throttle().await;
    let rg_url = format!(
        "{MB_BASE}/release?release-group={}&fmt=json&limit=25",
        url_encode(&releaseGroupId)
    );
    let rg_opts = ProxyJsonOptions {
        method: Method::GET, headers: mb_headers(), body: None, http_error_prefix: "HTTP",
    };
    let rg = match proxy_json(&client, &rg_url, rg_opts).await {
        Ok(v) => v,
        Err(e) => return Ok(err(e)),
    };
    let releases = rg.get("releases").and_then(|r| r.as_array()).cloned().unwrap_or_default();
    let chosen = releases.iter()
        .find(|r| r.get("status").and_then(|s| s.as_str()) == Some("Official"))
        .or_else(|| releases.first());
    let chosen_id = match chosen.and_then(|c| c.get("id")).and_then(|s| s.as_str()) {
        Some(id) => id.to_string(),
        None => return Ok(err("No releases found in group")),
    };

    // Step 2 — full release payload with all the joins we can pull.
    mb_throttle().await;
    let rel_url = format!(
        "{MB_BASE}/release/{chosen_id}?fmt=json&inc=recordings+artist-credits+labels+release-groups+media+tags+genres+artist-rels+release-group-rels"
    );
    let rel_opts = ProxyJsonOptions {
        method: Method::GET, headers: mb_headers(), body: None, http_error_prefix: "HTTP",
    };
    let mut rel_data = match proxy_json(&client, &rel_url, rel_opts).await {
        Ok(v) => v,
        Err(e) => return Ok(err(e)),
    };

    // Step 3 — enrichment: release-group tags/genres, best-effort.
    let rg_mbid = rel_data.get("release-group")
        .and_then(|rg| rg.get("id")).and_then(|s| s.as_str()).map(String::from);
    if let Some(mbid) = rg_mbid {
        mb_throttle().await;
        let rg2_url = format!("{MB_BASE}/release-group/{mbid}?fmt=json&inc=tags+genres+aliases");
        let rg2_opts = ProxyJsonOptions {
            method: Method::GET, headers: mb_headers(), body: None, http_error_prefix: "HTTP",
        };
        if let Ok(rg2) = proxy_json(&client, &rg2_url, rg2_opts).await {
            if let Some(obj) = rel_data.as_object_mut() {
                obj.insert("_releaseGroup".to_string(), rg2);
            }
        }
    }

    Ok(json!({
        "ok": true,
        "data": rel_data,
        "chosenReleaseId": chosen_id,
        "releaseGroupId": releaseGroupId,
    }))
}

// ===================================================================
// VGMdb (via vgmdb.info community JSON proxy).
// ===================================================================
const VGMDB_BASE: &str = "https://vgmdb.info";

#[command]
pub async fn vgmdb_search(term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let key = term.clone();
    let result = cached_search(&state, "vgmdb", &key, || async {
        let url = format!("{VGMDB_BASE}/search/albums/{}?format=json", url_encode(term.trim()));
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions::default();
        match proxy_json(&client, &url, opts).await {
            Ok(v) => {
                let albums = v.get("results")
                    .and_then(|r| r.get("albums"))
                    .cloned()
                    .unwrap_or(json!([]));
                ok(albums)
            }
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn vgmdb_album(link: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if link.is_empty() { return Ok(err("Missing album link")); }
    let clean = link.trim_start_matches('/');
    let url = format!("{VGMDB_BASE}/{clean}?format=json");
    let client = get_http_client(&state);
    let opts = ProxyJsonOptions::default();
    match proxy_json(&client, &url, opts).await {
        Ok(v) => Ok(ok(v)),
        Err(e) => Ok(err(e)),
    }
}

// ===================================================================
// IGDB — Twitch OAuth two-step (token cached in-memory, ~60 day
// expiry). Search uses POST + Apicalypse body.
// ===================================================================
struct IgdbToken { access_token: String, expires_at: Instant }
static IGDB_TOKEN: Lazy<AsyncMutex<Option<IgdbToken>>> = Lazy::new(|| AsyncMutex::new(None));

async fn ensure_igdb_token(
    client_id: &str, client_secret: &str, http: &reqwest::Client,
) -> Result<String, String> {
    if client_id.is_empty() || client_secret.is_empty() {
        return Err("Missing IGDB Client ID or Secret".to_string());
    }
    // Fast path: reuse cached token if it has ≥60s left.
    {
        let guard = IGDB_TOKEN.lock().await;
        if let Some(t) = guard.as_ref() {
            if t.expires_at > Instant::now() + Duration::from_secs(60) {
                return Ok(t.access_token.clone());
            }
        }
    }
    let url = format!(
        "https://id.twitch.tv/oauth2/token?client_id={}&client_secret={}&grant_type=client_credentials",
        url_encode(client_id), url_encode(client_secret)
    );
    let resp = http.post(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        let snippet = text.chars().take(120).collect::<String>();
        return Err(format!("Twitch OAuth HTTP {status}: {snippet}"));
    }
    let j: Value = resp.json().await.map_err(|e| e.to_string())?;
    let token = j.get("access_token").and_then(|s| s.as_str())
        .ok_or("Twitch response missing access_token")?.to_string();
    let expires_in = j.get("expires_in").and_then(|n| n.as_u64()).unwrap_or(3600);
    let mut guard = IGDB_TOKEN.lock().await;
    *guard = Some(IgdbToken {
        access_token: token.clone(),
        expires_at: Instant::now() + Duration::from_secs(expires_in),
    });
    Ok(token)
}

// Apicalypse field list — same set as the TS. Everything the fetcher
// needs in one call, no follow-up "details" round-trip.
const IGDB_FIELDS: &str = "name,summary,storyline,first_release_date,cover.image_id,artworks.image_id,screenshots.image_id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,platforms.name,genres.name,franchises.name,collection.name,alternative_names.name,alternative_names.comment,age_ratings.*,game_modes.name,themes.name,category,parent_game.name,parent_game.id,total_rating,total_rating_count";

#[command]
pub async fn igdb_search(
    clientId: String, clientSecret: String, term: String,
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let key = term.clone();
    let result = cached_search(&state, "igdb", &key, || async {
        let client = get_http_client(&state);
        let token = match ensure_igdb_token(&clientId, &clientSecret, &client).await {
            Ok(t) => t,
            Err(e) => return err(e),
        };
        let safe_term = term.trim().replace('"', "\\\"");
        let body = format!("search \"{safe_term}\"; fields {IGDB_FIELDS}; limit 12;");
        let auth = format!("Bearer {token}");
        let opts = ProxyJsonOptions {
            method: Method::POST,
            headers: vec![
                ("Client-ID", clientId.as_str()),
                ("Authorization", auth.as_str()),
                ("Accept", "application/json"),
            ],
            body: Some(body),
            http_error_prefix: "IGDB HTTP",
        };
        match proxy_json(&client, "https://api.igdb.com/v4/games", opts).await {
            Ok(v) => ok(v),
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

// ===================================================================
// TMDb — free v3 API key. movie / tv.
// ===================================================================
const TMDB_BASE: &str = "https://api.themoviedb.org/3";

#[command]
pub async fn tmdb_search(
    apiKey: String, term: String, kind: String,
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    if apiKey.is_empty() || term.trim().is_empty() {
        return Ok(err("Missing API key or search term"));
    }
    let source = format!("tmdb:{kind}");
    let key = term.clone();
    let result = cached_search(&state, &source, &key, || async {
        let url = format!(
            "{TMDB_BASE}/search/{kind}?api_key={}&query={}&include_adult=false",
            url_encode(&apiKey), url_encode(term.trim())
        );
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions::default();
        match proxy_json(&client, &url, opts).await {
            Ok(v) => ok(v.get("results").cloned().unwrap_or(json!([]))),
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn tmdb_details(
    apiKey: String, kind: String, id: Value,
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    let id_str = match &id {
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        _ => return Ok(err("Missing API key or id")),
    };
    if apiKey.is_empty() || id_str.is_empty() {
        return Ok(err("Missing API key or id"));
    }
    let extras = if kind == "movie" {
        "credits,images,external_ids,release_dates"
    } else {
        "credits,images,external_ids,content_ratings"
    };
    let url = format!(
        "{TMDB_BASE}/{kind}/{id_str}?api_key={}&append_to_response={extras}",
        url_encode(&apiKey)
    );
    let client = get_http_client(&state);
    let opts = ProxyJsonOptions::default();
    match proxy_json(&client, &url, opts).await {
        Ok(v) => Ok(ok(v)),
        Err(e) => Ok(err(e)),
    }
}

// ===================================================================
// AniList — GraphQL, no API key.
// ===================================================================
const ANILIST_QUERY: &str = r#"
query ($search: String, $type: MediaType) {
  Page(page: 1, perPage: 12) {
    media(search: $search, type: $type) {
      id
      title { romaji english native }
      format status episodes chapters volumes duration
      season seasonYear
      startDate { year month day }
      endDate { year month day }
      description(asHtml: false)
      genres
      studios(isMain: true) { nodes { name } }
      staff(perPage: 10) { edges { role node { name { full } } } }
      source countryOfOrigin
      coverImage { extraLarge large }
      bannerImage synonyms averageScore siteUrl
    }
  }
}"#;

#[command]
pub async fn anilist_search(term: String, kind: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let source = format!("anilist:{kind}");
    let key = term.clone();
    let result = cached_search(&state, &source, &key, || async {
        let body = json!({
            "query": ANILIST_QUERY,
            "variables": { "search": term.trim(), "type": kind },
        }).to_string();
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::POST,
            headers: vec![("Content-Type", "application/json"), ("Accept", "application/json")],
            body: Some(body),
            http_error_prefix: "HTTP",
        };
        match proxy_json(&client, "https://graphql.anilist.co", opts).await {
            Ok(v) => {
                // Soft error: `{ errors: [{ message }] }`
                if let Some(errs) = v.get("errors").and_then(|e| e.as_array()) {
                    if let Some(msg) = errs.first().and_then(|e| e.get("message")).and_then(|s| s.as_str()) {
                        return err(msg);
                    }
                }
                let media = v.pointer("/data/Page/media").cloned().unwrap_or(json!([]));
                ok(media)
            }
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

// ===================================================================
// Steam community XML — raw text return.
// ===================================================================
#[command]
pub async fn steam_library(profileInput: String, state: State<'_, AppState>) -> Result<Value, ()> {
    let raw = profileInput.trim();
    if raw.is_empty() { return Ok(err("Missing profile input")); }
    // Vanity name (bare identifier) → /id/<name>. Otherwise parse the
    // full URL and extract /id/<x> or /profiles/<x>.
    let is_vanity = raw.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    let url = if is_vanity {
        format!("https://steamcommunity.com/id/{raw}/games?tab=all&xml=1")
    } else {
        // steamcommunity.com/(id|profiles)/<slug>
        let re = regex::Regex::new(r"(?i)steamcommunity\.com/(id|profiles)/([^/?#]+)").unwrap();
        match re.captures(raw) {
            Some(caps) => format!(
                "https://steamcommunity.com/{}/{}/games?tab=all&xml=1",
                &caps[1], &caps[2]
            ),
            None => return Ok(err(
                "Could not parse Steam URL. Use https://steamcommunity.com/id/<vanity> or /profiles/<steamid64>."
            )),
        }
    };
    let client = get_http_client(&state);
    match client.get(&url).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                return Ok(err(format!("HTTP {}", resp.status().as_u16())));
            }
            match resp.text().await {
                Ok(xml) => Ok(json!({ "ok": true, "xml": xml })),
                Err(e) => Ok(err(e.to_string())),
            }
        }
        Err(e) => Ok(err(e.to_string())),
    }
}

// ===================================================================
// OpenLibrary — search + work details.
// ===================================================================
const OL_BASE: &str = "https://openlibrary.org";

fn ol_headers() -> Vec<(&'static str, &'static str)> {
    vec![("User-Agent", OMNIO_UA), ("Accept", "application/json")]
}

#[command]
pub async fn openlibrary_search(term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let key = term.clone();
    let result = cached_search(&state, "openlibrary", &key, || async {
        let fields = "key,title,author_name,first_publish_year,publisher,isbn,number_of_pages_median,cover_i,subject,language";
        let url = format!(
            "{OL_BASE}/search.json?q={}&limit=15&fields={fields}",
            url_encode(term.trim())
        );
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::GET, headers: ol_headers(), body: None, http_error_prefix: "HTTP",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => ok(v.get("docs").cloned().unwrap_or(json!([]))),
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn openlibrary_work(workKey: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if workKey.is_empty() { return Ok(err("Missing work key")); }
    let url = format!("{OL_BASE}{workKey}.json");
    let client = get_http_client(&state);
    let opts = ProxyJsonOptions {
        method: Method::GET, headers: ol_headers(), body: None, http_error_prefix: "HTTP",
    };
    match proxy_json(&client, &url, opts).await {
        Ok(v) => Ok(ok(v)),
        Err(e) => Ok(err(e)),
    }
}

// ===================================================================
// VNDB Kana API. POST + JSON body with filters.
// ===================================================================
const VNDB_BASE: &str = "https://api.vndb.org/kana";
const VNDB_VN_FIELDS: &str = "id, title, alttitle, aliases, description, released, olang, languages, platforms, length, length_minutes, length_votes, devstatus, rating, votecount, image.url, image.sexual, image.violence, tags.name, tags.category, tags.spoiler, tags.rating, screenshots.url, screenshots.sexual, screenshots.violence, screenshots.thumbnail, developers.name, developers.original, editions.eid, editions.lang, editions.name, editions.official, staff.name, staff.original, staff.role, staff.note, va.note, va.character.id, va.character.name, va.character.original, va.character.description, va.character.image.url, va.staff.name, va.staff.original, relations.id, relations.title, relations.relation";
const VNDB_RELEASE_FIELDS: &str = "id, title, alttitle, released, official, patch, engine, languages.lang, languages.main, languages.mtl, platforms, images.url, images.type, images.languages, images.sexual, images.violence, producers.id, producers.name, producers.original, producers.developer, producers.publisher";
const VNDB_CHARACTER_FIELDS: &str = "id, name, original, description, gender, image.url, image.sexual, image.violence, vns.id, vns.role";

fn vndb_headers() -> Vec<(&'static str, &'static str)> {
    vec![
        ("User-Agent", OMNIO_UA),
        ("Content-Type", "application/json"),
        ("Accept", "application/json"),
    ]
}

#[command]
pub async fn vndb_search(term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let key = term.clone();
    let result = cached_search(&state, "vndb", &key, || async {
        let body = json!({
            "filters": ["search", "=", term.trim()],
            "fields": VNDB_VN_FIELDS,
            "results": 15,
            "sort": "searchrank",
        }).to_string();
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::POST, headers: vndb_headers(), body: Some(body), http_error_prefix: "HTTP",
        };
        let url = format!("{VNDB_BASE}/vn");
        match proxy_json(&client, &url, opts).await {
            Ok(v) => ok(v.get("results").cloned().unwrap_or(json!([]))),
            Err(e) => err(e),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn vndb_detail(id: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if id.trim().is_empty() { return Ok(err("Missing VNDB id")); }
    let body = json!({
        "filters": ["id", "=", id.trim()],
        "fields": VNDB_VN_FIELDS,
        "results": 1,
    }).to_string();
    let client = get_http_client(&state);
    let opts = ProxyJsonOptions {
        method: Method::POST, headers: vndb_headers(), body: Some(body), http_error_prefix: "HTTP",
    };
    let url = format!("{VNDB_BASE}/vn");
    match proxy_json(&client, &url, opts).await {
        Ok(v) => Ok(ok(v.get("results").cloned().unwrap_or(json!([])))),
        Err(e) => Ok(err(e)),
    }
}

#[command]
pub async fn vndb_characters(vnId: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if vnId.trim().is_empty() { return Ok(err("Missing VNDB id")); }
    let client = get_http_client(&state);
    let url = format!("{VNDB_BASE}/character");
    let mut all: Vec<Value> = Vec::new();
    // Cap at 6 pages (600 characters) — well above every real VN cast.
    for page in 1..=6 {
        let body = json!({
            "filters": ["vn", "=", ["id", "=", vnId.trim()]],
            "fields": VNDB_CHARACTER_FIELDS,
            "results": 100,
            "page": page,
        }).to_string();
        let opts = ProxyJsonOptions {
            method: Method::POST, headers: vndb_headers(), body: Some(body), http_error_prefix: "HTTP",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => {
                if let Some(arr) = v.get("results").and_then(|r| r.as_array()) {
                    all.extend(arr.iter().cloned());
                }
                if v.get("more").and_then(|m| m.as_bool()) != Some(true) { break; }
            }
            Err(e) => return Ok(err(e)),
        }
    }
    Ok(ok(Value::Array(all)))
}

#[command]
pub async fn vndb_releases(vnId: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if vnId.trim().is_empty() { return Ok(err("Missing VNDB id")); }
    let client = get_http_client(&state);
    let url = format!("{VNDB_BASE}/release");
    let mut all: Vec<Value> = Vec::new();
    // Cap defensively at 10 pages (250 releases).
    for page in 1..=10 {
        let body = json!({
            "filters": ["vn", "=", ["id", "=", vnId.trim()]],
            "fields": VNDB_RELEASE_FIELDS,
            "results": 25,
            "page": page,
            "sort": "released",
        }).to_string();
        let opts = ProxyJsonOptions {
            method: Method::POST, headers: vndb_headers(), body: Some(body), http_error_prefix: "HTTP",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => {
                if let Some(arr) = v.get("results").and_then(|r| r.as_array()) {
                    all.extend(arr.iter().cloned());
                }
                if v.get("more").and_then(|m| m.as_bool()) != Some(true) { break; }
            }
            Err(e) => return Ok(err(e)),
        }
    }
    Ok(ok(Value::Array(all)))
}

// ===================================================================
// Discogs — paginated collection reader with Retry-After handling.
// ===================================================================
#[command]
pub async fn discogs_collection(
    username: String, token: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    if username.trim().is_empty() { return Ok(err("Missing username")); }
    let client = get_http_client(&state);
    let auth = token.as_deref().map(str::trim).filter(|t| !t.is_empty()).map(|t| format!("Discogs token={t}"));

    let mut releases: Vec<Value> = Vec::new();
    const MAX_PAGES: u32 = 20;
    let mut page = 1u32;
    let mut pages = 1u32;

    while page <= MAX_PAGES.min(pages) {
        let url = format!(
            "https://api.discogs.com/users/{}/collection/folders/0/releases?per_page=100&page={page}",
            url_encode(username.trim())
        );
        let mut req = client.get(&url).header("User-Agent", OMNIO_UA).header("Accept", "application/json");
        if let Some(ref a) = auth {
            req = req.header("Authorization", a);
        }
        let resp = match req.send().await {
            Ok(r) => r,
            Err(e) => return Ok(err(e.to_string())),
        };
        let status = resp.status().as_u16();
        if status == 401 {
            return Ok(err("Unauthorized — this collection is private. Add a Personal Access Token from your Discogs account (Settings → Developers)."));
        }
        if status == 404 {
            return Ok(err(format!("No collection found for user \"{}\".", username.trim())));
        }
        if status == 429 {
            let retry = resp.headers().get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(5);
            tokio::time::sleep(Duration::from_secs(retry)).await;
            continue;
        }
        if !resp.status().is_success() {
            return Ok(err(format!("HTTP {status}")));
        }
        let j: Value = match resp.json().await {
            Ok(v) => v,
            Err(e) => return Ok(err(e.to_string())),
        };
        if let Some(arr) = j.get("releases").and_then(|r| r.as_array()) {
            releases.extend(arr.iter().cloned());
        }
        pages = j.pointer("/pagination/pages").and_then(|p| p.as_u64()).unwrap_or(1) as u32;
        page += 1;
    }
    Ok(ok(json!({
        "releases": releases,
        "truncated": pages > MAX_PAGES,
        "totalPages": pages,
    })))
}

// ===================================================================
// lrclib.net — free lyrics API.
// ===================================================================
#[command]
pub async fn lrclib_track(
    trackName: String, artistName: String, albumName: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    if trackName.trim().is_empty() || artistName.trim().is_empty() {
        return Ok(err("Missing track or artist name"));
    }
    let mut pairs: Vec<(&str, &str)> = vec![
        ("track_name", trackName.trim()),
        ("artist_name", artistName.trim()),
    ];
    let album_trim: String;
    if let Some(a) = albumName.as_ref() {
        let t = a.trim();
        if !t.is_empty() {
            album_trim = t.to_string();
            pairs.push(("album_name", &album_trim));
            // Ownership dance because pairs holds &str.
        } else {
            album_trim = String::new();
        }
    } else {
        album_trim = String::new();
    }
    let _ = album_trim;  // suppress warning when we never append

    let url = format!("https://lrclib.net/api/get?{}", qs(&pairs));
    let client = get_http_client(&state);
    let resp = match client.get(&url)
        .header("Accept", "application/json")
        .header("User-Agent", OMNIO_UA)
        .send().await
    {
        Ok(r) => r,
        Err(e) => return Ok(err(e.to_string())),
    };
    let status = resp.status().as_u16();
    if status == 404 { return Ok(err("No lyrics found on lrclib for this track.")); }
    if !resp.status().is_success() { return Ok(err(format!("HTTP {status}"))); }
    let j: Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => return Ok(err(e.to_string())),
    };
    if j.get("instrumental").and_then(|b| b.as_bool()) == Some(true) {
        return Ok(ok(json!({ "lyrics": "[Instrumental]", "synced": false })));
    }
    let synced = j.get("syncedLyrics").and_then(|s| s.as_str());
    let plain = j.get("plainLyrics").and_then(|s| s.as_str());
    let (lyrics, is_synced) = match synced.filter(|s| !s.is_empty()) {
        Some(s) => (s.to_string(), true),
        None => match plain.filter(|s| !s.is_empty()) {
            Some(s) => (s.to_string(), false),
            None => return Ok(err("lrclib returned an empty result.")),
        },
    };
    Ok(ok(json!({ "lyrics": lyrics, "synced": is_synced })))
}

// ===================================================================
// AniDB — one HTTP request per AID, throttled to 2s. Response is XML;
// error envelopes come back as <error>...</error>.
// ===================================================================
#[command]
pub async fn anidb_anime(client: String, aid: Value, state: State<'_, AppState>) -> Result<Value, ()> {
    let clean_client = client.trim().to_string();
    if clean_client.is_empty() {
        return Ok(err("Register a client name at anidb.net/software/add and set it in Settings → Data → Integrations."));
    }
    let aid_str = match &aid {
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.trim().to_string(),
        _ => String::new(),
    };
    let all_digits = !aid_str.is_empty() && aid_str.chars().all(|c| c.is_ascii_digit());
    if !all_digits { return Ok(err("AID must be a positive integer.")); }

    anidb_throttle().await;
    let query = qs(&[
        ("request", "anime"),
        ("client", &clean_client),
        ("clientver", "1"),
        ("protover", "1"),
        ("aid", &aid_str),
    ]);
    let url = format!("http://api.anidb.net:9001/httpapi?{query}");
    let http = get_http_client(&state);
    let resp = match http.get(&url)
        .header("Accept", "application/xml")
        .header("User-Agent", OMNIO_UA)
        .send().await
    {
        Ok(r) => r,
        Err(e) => return Ok(err(e.to_string())),
    };
    if !resp.status().is_success() {
        return Ok(err(format!("HTTP {}", resp.status().as_u16())));
    }
    // AniDB's HTTP API serves the anime XML gzip-compressed but
    // OMITS the Content-Encoding header, so reqwest's automatic
    // decompression never kicks in. We have to inflate the raw body
    // ourselves — try gzip (magic bytes 0x1f 0x8b) first, then
    // zlib-wrapped deflate (0x78 ..), and finally treat the bytes
    // as plain UTF-8 for the (rare) case where AniDB returns an
    // error envelope without compression.
    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => return Ok(err(e.to_string())),
    };
    use std::io::Read;
    let text = if bytes.len() >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b {
        // gzip
        let mut d = flate2::read::GzDecoder::new(&bytes[..]);
        let mut s = String::new();
        if let Err(e) = d.read_to_string(&mut s) {
            return Ok(err(format!("gzip decode: {e}")));
        }
        s
    } else if bytes.len() >= 2 && bytes[0] == 0x78 {
        // zlib-wrapped deflate
        let mut d = flate2::read::ZlibDecoder::new(&bytes[..]);
        let mut s = String::new();
        if let Err(e) = d.read_to_string(&mut s) {
            return Ok(err(format!("zlib decode: {e}")));
        }
        s
    } else {
        // Uncompressed — either an <error> envelope or a small ok
        // payload. Decode as UTF-8; lossy so weird bytes don't
        // panic the handler.
        String::from_utf8_lossy(&bytes).into_owned()
    };
    // AniDB returns errors as XML: <error>Banned</error>, etc.
    static ERR_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"(?is)<error[^>]*>(.*?)</error>").unwrap());
    if let Some(caps) = ERR_RE.captures(&text) {
        return Ok(err(caps[1].trim().to_string()));
    }
    Ok(ok(Value::String(text)))
}

// ===================================================================
// AniDB titles dump — offline title search.
//
// The HTTP API has no title-search endpoint on purpose, but AniDB
// publishes a full title dump (all AIDs + every title variant per
// AID) at http://anidb.net/api/anime-titles.xml.gz, updated daily,
// no rate limit, no client name required. We download it once, cache
// the decompressed XML in the app's data dir, and search it locally.
//
// Two commands:
//   - anidb_download_titles(): pull the dump, gunzip, write to disk,
//                              return { count, path }
//   - anidb_search_titles(query, limit): scan the cached XML for
//                              case-insensitive substring matches,
//                              return the top N candidates as
//                              [{aid, mainTitle, altTitles: [...]}]
// ===================================================================
const ANIDB_TITLES_URL: &str = "http://anidb.net/api/anime-titles.xml.gz";
const ANIDB_TITLES_CACHE: &str = "anidb-titles.xml";

fn anidb_titles_cache_path() -> std::path::PathBuf {
    crate::paths::get().data_dir.join(ANIDB_TITLES_CACHE)
}

#[command]
pub async fn anidb_download_titles(state: State<'_, AppState>) -> Result<Value, ()> {
    let http = get_http_client(&state);
    let resp = match http.get(ANIDB_TITLES_URL)
        .header("User-Agent", OMNIO_UA)
        .send().await
    {
        Ok(r) => r,
        Err(e) => return Ok(err(e.to_string())),
    };
    if !resp.status().is_success() {
        return Ok(err(format!("HTTP {}", resp.status().as_u16())));
    }
    let bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => return Ok(err(e.to_string())),
    };
    // The dump ships gzip-compressed. Same magic-byte sniff as
    // anidb_anime — usually 0x1f 0x8b but we accept zlib too.
    use std::io::Read;
    let xml = if bytes.len() >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b {
        let mut d = flate2::read::GzDecoder::new(&bytes[..]);
        let mut s = String::new();
        if let Err(e) = d.read_to_string(&mut s) {
            return Ok(err(format!("gzip decode: {e}")));
        }
        s
    } else {
        String::from_utf8_lossy(&bytes).into_owned()
    };
    let path = anidb_titles_cache_path();
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    if let Err(e) = tokio::fs::write(&path, xml.as_bytes()).await {
        return Ok(err(format!("write cache: {e}")));
    }
    // Rough count of <anime> entries so the caller can show progress.
    let count = xml.matches("<anime ").count();
    Ok(ok(json!({ "count": count, "path": path.display().to_string() })))
}

#[command]
pub async fn anidb_search_titles(query: String, limit: Value) -> Result<Value, ()> {
    let q = query.trim().to_lowercase();
    if q.is_empty() { return Ok(ok(Value::Array(vec![]))); }
    let n = match &limit {
        Value::Number(n) => n.as_u64().unwrap_or(20).max(1).min(100) as usize,
        _ => 20,
    };
    let path = anidb_titles_cache_path();
    let xml = match tokio::fs::read_to_string(&path).await {
        Ok(s) => s,
        Err(_) => return Ok(err("Title cache not downloaded yet. Call anidb:download-titles first.")),
    };
    // The dump structure is:
    //   <anime aid="12345">
    //     <title xml:lang="x-jat" type="main">...</title>
    //     <title xml:lang="ja" type="official">...</title>
    //     ...
    //   </anime>
    // We stream-parse by iterating <anime ...> ... </anime> blocks with
    // regex — the file is 30-40 MB and full XML parsing would blow the
    // memory budget. Regex is fine because the shape is regular.
    static ANIME_RE: Lazy<regex::Regex> = Lazy::new(||
        regex::Regex::new(r#"(?s)<anime\s+aid="(\d+)"[^>]*>(.*?)</anime>"#).unwrap()
    );
    static TITLE_RE: Lazy<regex::Regex> = Lazy::new(||
        regex::Regex::new(r#"(?s)<title\s+xml:lang="([^"]+)"(?:\s+type="([^"]+)")?[^>]*>([^<]+)</title>"#).unwrap()
    );
    struct Match {
        aid: String,
        main: String,
        alts: Vec<String>,
        score: u32,
    }
    let mut hits: Vec<Match> = Vec::new();
    for cap in ANIME_RE.captures_iter(&xml) {
        let aid = cap[1].to_string();
        let body = &cap[2];
        let mut titles: Vec<(String, String)> = Vec::new();   // (type, text)
        let mut main = String::new();
        for tc in TITLE_RE.captures_iter(body) {
            let ttype = tc.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();
            let text = tc[3].to_string();
            if ttype == "main" && main.is_empty() { main = text.clone(); }
            titles.push((ttype, text));
        }
        // Match: any title contains the query. Score higher for shorter
        // titles (more likely a direct hit) and for main / official types.
        let mut best_score: u32 = 0;
        for (ttype, text) in &titles {
            let lc = text.to_lowercase();
            if lc.contains(&q) {
                let mut s: u32 = 100;
                if lc == q { s += 1000; }
                if lc.starts_with(&q) { s += 500; }
                if ttype == "main" { s += 300; }
                if ttype == "official" { s += 100; }
                // shorter title wins ties
                let len = text.chars().count() as u32;
                s = s.saturating_add(200u32.saturating_sub(len.min(200)));
                if s > best_score { best_score = s; }
            }
        }
        if best_score > 0 {
            let alts: Vec<String> = titles.iter()
                .filter(|(t, txt)| t != "main" && *txt != main)
                .map(|(_, txt)| txt.clone())
                .take(4)
                .collect();
            hits.push(Match {
                aid,
                main: if main.is_empty() { titles.first().map(|(_, t)| t.clone()).unwrap_or_default() } else { main },
                alts,
                score: best_score,
            });
        }
        if hits.len() > n * 5 { break; }   // early exit; top N will still be within this pool
    }
    hits.sort_by(|a, b| b.score.cmp(&a.score));
    hits.truncate(n);
    let out: Vec<Value> = hits.into_iter().map(|h| json!({
        "aid": h.aid,
        "mainTitle": h.main,
        "altTitles": h.alts,
        "score": h.score,
    })).collect();
    Ok(ok(Value::Array(out)))
}

// ===================================================================
// PCGamingWiki — opensearch + wikitext parse for save/config paths.
// ===================================================================
const PCGW_BASE: &str = "https://www.pcgamingwiki.com/w/api.php";

#[command]
pub async fn pcgw_search(term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let url = format!(
        "{PCGW_BASE}?action=opensearch&format=json&search={}&limit=8&namespace=0",
        url_encode(term.trim())
    );
    let client = get_http_client(&state);
    let opts = ProxyJsonOptions::default();
    let v = match proxy_json(&client, &url, opts).await {
        Ok(v) => v,
        Err(e) => return Ok(err(e)),
    };
    // OpenSearch shape: [term, titles[], descriptions[], urls[]]
    let arr = match v.as_array() {
        Some(a) if a.len() >= 4 => a,
        _ => return Ok(ok(json!([]))),
    };
    let titles = arr[1].as_array().cloned().unwrap_or_default();
    let urls = arr[3].as_array().cloned().unwrap_or_default();
    let mut out: Vec<Value> = Vec::with_capacity(titles.len());
    for (i, t) in titles.iter().enumerate() {
        let title = t.as_str().unwrap_or("").to_string();
        let u = urls.get(i).and_then(|v| v.as_str()).unwrap_or("").to_string();
        out.push(json!({ "title": title, "url": u }));
    }
    Ok(ok(Value::Array(out)))
}

// PCGW macro map — same as the TS PCGW_MACROS lookup.
fn pcgw_macro(key: &str) -> Option<&'static str> {
    Some(match key {
        "userprofile" => "%USERPROFILE%",
        "localappdata" => "%LOCALAPPDATA%",
        "appdata" => "%APPDATA%",
        "programdata" => "%PROGRAMDATA%",
        "programfiles" => "%PROGRAMFILES%",
        "programfilesx86" => "%PROGRAMFILES(X86)%",
        "windir" => "%WINDIR%",
        "systemroot" => "%SYSTEMROOT%",
        "public" => "%PUBLIC%",
        "hkcu" => "HKEY_CURRENT_USER",
        "hklm" => "HKEY_LOCAL_MACHINE",
        "wow64" => "Wow6432Node",
        "game" => "<path-to-game>",
        "steam" => "<Steam-folder>",
        "uid" => "<user-id>",
        "osxhome" | "linuxhome" => "~",
        "xdgdatahome" => "$XDG_DATA_HOME",
        "xdgconfighome" => "$XDG_CONFIG_HOME",
        _ => return None,
    })
}

// {{p|key}} / {{P|key}} → human-readable, plus a few decorative
// wrappers stripped. Same behavior as `resolvePcgwMacros` in the TS.
fn resolve_pcgw_macros(raw: &str) -> String {
    static P_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"(?i)\{\{p\|([^}|]+)(?:\|[^}]*)?\}\}").unwrap());
    static CODE_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"(?is)\{\{code\|([^}]+)\}\}").unwrap());
    static REF_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"(?is)<ref[^>]*>.*?</ref>").unwrap());
    static TAG_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"<[^>]+>").unwrap());
    static NOTE_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"(?i)\{\{Note[^}]*\}\}").unwrap());

    let out = P_RE.replace_all(raw, |caps: &regex::Captures| {
        let key = caps[1].trim().to_ascii_lowercase();
        match pcgw_macro(&key) {
            Some(s) => s.to_string(),
            None => format!("<{key}>"),
        }
    });
    let out = CODE_RE.replace_all(&out, "$1");
    let out = REF_RE.replace_all(&out, "");
    let out = TAG_RE.replace_all(&out, "");
    let out = NOTE_RE.replace_all(&out, "");
    out.trim().to_string()
}

fn normalize_os(raw: &str) -> String {
    // Collapse runs of whitespace to a single space.
    let mut out = String::with_capacity(raw.len());
    let mut in_ws = false;
    for c in raw.chars() {
        if c.is_whitespace() {
            if !in_ws { out.push(' '); }
            in_ws = true;
        } else {
            out.push(c);
            in_ws = false;
        }
    }
    out.trim().to_string()
}

#[command]
pub async fn pcgw_save_paths(pageName: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if pageName.trim().is_empty() { return Ok(err("Missing page name")); }
    let query = qs(&[
        ("action", "parse"),
        ("format", "json"),
        ("page", &pageName),
        ("prop", "wikitext"),
        ("redirects", "1"),
    ]);
    let url = format!("{PCGW_BASE}?{query}");
    let client = get_http_client(&state);
    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return Ok(err(e.to_string())),
    };
    if !resp.status().is_success() {
        return Ok(err(format!("HTTP {}", resp.status().as_u16())));
    }
    let j: Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => return Ok(err(e.to_string())),
    };
    if let Some(info) = j.pointer("/error/info").and_then(|v| v.as_str()) {
        return Ok(err(info.to_string()));
    }
    let wikitext = j.pointer("/parse/wikitext/*")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Nested-brace-aware parser — same walker as the TS side. Finds
    // {{Game data/saves|…}} / {{Game data/config|…}}, tracks {{ }}
    // depth, splits on the first top-level `|`.
    let bytes = wikitext.as_bytes();
    static OPENER_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"(?i)\{\{Game data/(saves|config)\|").unwrap());
    let mut rows: Vec<Value> = Vec::new();

    for m in OPENER_RE.find_iter(&wikitext) {
        // Which type? Look inside the captured group by re-running.
        let outer = &wikitext[m.start()..m.end()];
        let type_str = if outer.to_ascii_lowercase().contains("saves") { "Save" } else { "Config" };

        let mut i = m.end();
        let mut depth: i32 = 1;
        let start = i;
        while i < bytes.len() && depth > 0 {
            if i + 1 < bytes.len() && bytes[i] == b'{' && bytes[i + 1] == b'{' {
                depth += 1; i += 2; continue;
            }
            if i + 1 < bytes.len() && bytes[i] == b'}' && bytes[i + 1] == b'}' {
                depth -= 1; i += 2; continue;
            }
            i += 1;
        }
        if depth != 0 { continue; }  // unbalanced, skip

        // Body is bytes[start..i-2] (strip the closing `}}`). Split on
        // the FIRST top-level `|`.
        let body = &wikitext[start..i.saturating_sub(2)];
        let body_bytes = body.as_bytes();
        let mut pipe_at: Option<usize> = None;
        let mut d: i32 = 0;
        let mut k = 0;
        while k < body_bytes.len() {
            if k + 1 < body_bytes.len() && body_bytes[k] == b'{' && body_bytes[k + 1] == b'{' {
                d += 1; k += 2; continue;
            }
            if k + 1 < body_bytes.len() && body_bytes[k] == b'}' && body_bytes[k + 1] == b'}' {
                d -= 1; k += 2; continue;
            }
            if body_bytes[k] == b'|' && d == 0 {
                pipe_at = Some(k);
                break;
            }
            k += 1;
        }
        let Some(pipe) = pipe_at else { continue };
        let os = normalize_os(&body[..pipe]);
        let loc = resolve_pcgw_macros(&body[pipe + 1..]);
        if !loc.is_empty() {
            rows.push(json!({ "OS": os, "Type": type_str, "Location": loc }));
        }
    }

    let page_url = format!(
        "https://www.pcgamingwiki.com/wiki/{}",
        url_encode(&pageName.replace(' ', "_"))
    );
    Ok(ok(json!({ "pageName": pageName, "pageUrl": page_url, "rows": rows })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_encode_matches_js() {
        // JS: encodeURIComponent("a b/c?d") === "a%20b%2Fc%3Fd"
        assert_eq!(url_encode("a b/c?d"), "a%20b%2Fc%3Fd");
        assert_eq!(url_encode("Metal Gear Solid"), "Metal%20Gear%20Solid");
        assert_eq!(url_encode("normal-text_1.txt"), "normal-text_1.txt");
    }

    #[test]
    fn qs_builds_urlencoded_pairs() {
        let s = qs(&[("q", "hi there"), ("limit", "15")]);
        assert_eq!(s, "q=hi%20there&limit=15");
    }

    #[test]
    fn ok_and_err_envelopes() {
        assert_eq!(ok(json!(42)), json!({ "ok": true, "data": 42 }));
        assert_eq!(err("nope"), json!({ "ok": false, "error": "nope" }));
    }

    #[test]
    fn pcgw_macro_lookup() {
        assert_eq!(pcgw_macro("userprofile"), Some("%USERPROFILE%"));
        assert_eq!(pcgw_macro("localappdata"), Some("%LOCALAPPDATA%"));
        assert_eq!(pcgw_macro("nonexistent"), None);
    }

    #[test]
    fn resolve_pcgw_macros_walks_templates() {
        let raw = "{{p|userprofile}}\\Documents\\My Games\\{{code|MGS3}}<ref>ok</ref>";
        let out = resolve_pcgw_macros(raw);
        assert_eq!(out, "%USERPROFILE%\\Documents\\My Games\\MGS3");
    }

    #[test]
    fn normalize_os_collapses_whitespace() {
        assert_eq!(normalize_os("  Steam   Play  (Linux) "), "Steam Play (Linux)");
    }

    #[test]
    fn cv_soft_error_recognizes_error() {
        assert_eq!(cv_soft_error(&json!({ "error": "OK" })), None);
        assert_eq!(cv_soft_error(&json!({ "error": "Invalid API Key" })), Some("Invalid API Key".to_string()));
        assert_eq!(cv_soft_error(&json!({})), None);
    }

    #[test]
    fn md_soft_error_recognizes_error() {
        let v = json!({ "result": "error", "errors": [{ "detail": "missing" }] });
        assert_eq!(md_soft_error(&v), Some("missing".to_string()));
        assert_eq!(md_soft_error(&json!({ "result": "ok" })), None);
    }
}
