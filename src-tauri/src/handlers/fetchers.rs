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
const IGDB_FIELDS: &str = "name,summary,storyline,first_release_date,cover.image_id,artworks.image_id,screenshots.image_id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,platforms.name,genres.name,franchises.name,collection.name,alternative_names.name,alternative_names.comment,age_ratings.*,game_modes.name,themes.name,player_perspectives.name,keywords.name,category,parent_game.name,parent_game.id,total_rating,total_rating_count";

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
        "credits,images,external_ids,release_dates,keywords"
    } else {
        "credits,images,external_ids,content_ratings,keywords"
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
      tags { name rank isMediaSpoiler isGeneralSpoiler }
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
// AniDB serves this file with hard-coded gzip and a User-Agent
// allowlist — the default reqwest UA gets a 403 and even our own
// project UA gets rejected. Every known-good client uses a
// browser-shaped UA; we match that for this ONE endpoint only. The
// rest of the AniDB API (rate-limited anime httpapi) keeps the
// project UA so we stay identifiable to the ratelimit / ban system.
// The URL is HTTPS because plain http redirects and reqwest drops
// custom headers on redirect chains that cross scheme.
const ANIDB_TITLES_URL: &str = "https://anidb.net/api/anime-titles.xml.gz";
const ANIDB_TITLES_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const ANIDB_TITLES_CACHE: &str = "anidb-titles.xml";

fn anidb_titles_cache_path() -> std::path::PathBuf {
    crate::paths::get().data_dir.join(ANIDB_TITLES_CACHE)
}

#[command]
pub async fn anidb_download_titles(state: State<'_, AppState>) -> Result<Value, ()> {
    let http = get_http_client(&state);
    let resp = match http.get(ANIDB_TITLES_URL)
        .header("User-Agent", ANIDB_TITLES_UA)
        .header("Accept", "*/*")
        .header("Accept-Encoding", "gzip")
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

// -- HowLongToBeat -----------------------------------------------------
//
// No official API. HLTB's front-end POSTs to `/api/{path}/{token}` where
// `{path}` (search / seek / find / lookup) and `{token}` (32-char hex)
// both rotate periodically to make scrapers a maintenance chore.
//
// Strategy: fetch the homepage, find the `_app-*.js` bundle, and regex
// out the endpoint from its source. Cached for 6h so we're not hammering
// their CDN. On rotation the cached endpoint 404s; we invalidate and
// retry once.
//
// Response payload: `{ data: [{ game_id, game_name, comp_main, comp_plus,
// comp_100, ... }], ... }` where `comp_*` are in seconds (0 = missing).

static HLTB_ENDPOINT_CACHE: Lazy<AsyncMutex<Option<(String, Instant)>>> =
    Lazy::new(|| AsyncMutex::new(None));
const HLTB_ENDPOINT_TTL: Duration = Duration::from_secs(6 * 3600);

async fn hltb_extract_endpoint(client: &reqwest::Client) -> Result<String, String> {
    // 1. Fetch homepage HTML
    let home = client
        .get("https://howlongtobeat.com/")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("HLTB home fetch failed: {e}"))?;
    if !home.status().is_success() {
        return Err(format!("HLTB home returned {}", home.status()));
    }
    let html = home.text().await.map_err(|e| e.to_string())?;

    // 2. Find _app-*.js (Next.js build hash) — the file that ships the
    //    hardcoded API endpoint constant.
    let re_app = regex::Regex::new(r#"/_next/static/chunks/pages/_app-([0-9a-f]+)\.js"#)
        .map_err(|e| e.to_string())?;
    let app_hash = re_app
        .captures(&html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .ok_or_else(|| "HLTB: no _app-*.js reference in homepage".to_string())?;

    // 3. Fetch that bundle
    let js_url = format!("https://howlongtobeat.com/_next/static/chunks/pages/_app-{app_hash}.js");
    let js_resp = client
        .get(&js_url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("HLTB _app fetch failed: {e}"))?;
    if !js_resp.status().is_success() {
        return Err(format!("HLTB _app returned {}", js_resp.status()));
    }
    let js = js_resp.text().await.map_err(|e| e.to_string())?;

    // 4. Extract the endpoint path. HLTB has used /api/search, /api/seek,
    //    /api/find, /api/lookup, /api/ouch over the years — pattern
    //    matches all of them.
    let re_endpoint = regex::Regex::new(r#"/api/[a-z]+/[a-zA-Z0-9]{20,}"#)
        .map_err(|e| e.to_string())?;
    let path = re_endpoint
        .find(&js)
        .map(|m| m.as_str().to_string())
        .ok_or_else(|| "HLTB: no /api/*/{token} in _app bundle".to_string())?;
    Ok(format!("https://howlongtobeat.com{path}"))
}

async fn hltb_endpoint(client: &reqwest::Client, force_refresh: bool) -> Result<String, String> {
    if !force_refresh {
        let cached = HLTB_ENDPOINT_CACHE.lock().await;
        if let Some((url, at)) = cached.as_ref() {
            if at.elapsed() < HLTB_ENDPOINT_TTL {
                return Ok(url.clone());
            }
        }
    }
    let url = hltb_extract_endpoint(client).await?;
    let mut cached = HLTB_ENDPOINT_CACHE.lock().await;
    *cached = Some((url.clone(), Instant::now()));
    Ok(url)
}

// Convert a HLTB "seconds" time into rounded whole hours. HLTB stores
// 0 for missing data, so we treat 0 as "unknown" and return None.
// Currently only exercised by the unit test — the renderer does the
// same math in HltbFetcher.tsx. Kept here so a future refactor can move
// the conversion server-side without re-deriving the rule.
#[cfg(test)]
fn hltb_seconds_to_hours(seconds: &Value) -> Option<f64> {
    let s = seconds.as_f64()?;
    if s <= 0.0 { return None; }
    Some((s / 3600.0 * 10.0).round() / 10.0)
}

#[command]
pub async fn hltb_search(term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let source = "hltb".to_string();
    let key = term.clone();
    let result = cached_search(&state, &source, &key, || async {
        let client = get_http_client(&state);
        // Standard search payload — kept close to what the site itself
        // sends so HLTB has no reason to treat us differently.
        let payload = json!({
            "searchType": "games",
            "searchTerms": term.trim().split_whitespace().collect::<Vec<_>>(),
            "searchPage": 1,
            "size": 20,
            "searchOptions": {
                "games": {
                    "userId": 0,
                    "platform": "",
                    "sortCategory": "popular",
                    "rangeCategory": "main",
                    "rangeTime": { "min": null, "max": null },
                    "gameplay": { "perspective": "", "flow": "", "genre": "" },
                    "rangeYear": { "min": "", "max": "" },
                    "modifier": ""
                },
                "users": { "sortCategory": "postcount" },
                "lists": { "sortCategory": "follows" },
                "filter": "",
                "sort": 0,
                "randomizer": 0
            },
            "useCache": true
        }).to_string();

        // Two attempts: cached endpoint first, then bust the cache and
        // try again if HLTB rotated the token in the last 6 hours.
        for attempt in 0..2 {
            let endpoint = match hltb_endpoint(&client, attempt == 1).await {
                Ok(u) => u,
                Err(e) => return err(format!("HLTB endpoint discovery: {e}")),
            };
            let opts = ProxyJsonOptions {
                method: Method::POST,
                headers: vec![
                    ("Content-Type", "application/json"),
                    ("Origin", "https://howlongtobeat.com"),
                    ("Referer", "https://howlongtobeat.com/"),
                    ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"),
                ],
                body: Some(payload.clone()),
                http_error_prefix: "HLTB",
            };
            match proxy_json(&client, &endpoint, opts).await {
                Ok(v) => {
                    let hits = v.get("data").cloned().unwrap_or(json!([]));
                    let count = hits.as_array().map(|a| a.len()).unwrap_or(0);
                    // A 200 response with an empty array on the first
                    // attempt is legitimate ("no hits") — only retry
                    // when the endpoint 404s or errors, which lands in
                    // the Err arm below.
                    let _ = count;
                    return ok(json!({ "hits": hits }));
                }
                Err(e) => {
                    // Bust the cache and retry once on 404 (rotation)
                    // or 401/403 (token invalidated).
                    let rotated = e.contains("404") || e.contains("401") || e.contains("403");
                    if !rotated || attempt == 1 {
                        return err(format!("HLTB search: {e}"));
                    }
                }
            }
        }
        err("HLTB search failed after retry".to_string())
    })
    .await;
    Ok(result)
}

// -- Last.fm -----------------------------------------------------------
//
// Only two commands so far:
//   - `lastfm_top_albums` fuels the bulk importer (map top albums from
//     the user's overall scrobbles onto their Music library).
//   - `lastfm_album_info` fuels the per-item lookup (userplaycount for
//     one specific artist+album). Not wired to a fetcher yet.
//
// Free API key required (last.fm/api/account/create — no auth flow,
// just a static key). The user-agent line matches what the client would
// naturally send.

const LASTFM_BASE: &str = "https://ws.audioscrobbler.com/2.0/";

#[command]
pub async fn lastfm_top_albums(
    apiKey: String,
    username: String,
    limit: u32,
    period: String,
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    if apiKey.trim().is_empty() || username.trim().is_empty() {
        return Ok(err("Missing Last.fm API key or username"));
    }
    let capped = limit.clamp(1, 500);
    // Period vocab: overall / 7day / 1month / 3month / 6month / 12month.
    // Any unknown value falls back to overall so the caller never gets a
    // 400 that's caused by a typo in a settings dropdown.
    let p = match period.as_str() {
        "7day" | "1month" | "3month" | "6month" | "12month" => period,
        _ => "overall".to_string(),
    };
    let source = "lastfm-top-albums".to_string();
    let key = format!("{username}:{p}:{capped}");
    let result = cached_search(&state, &source, &key, || async {
        let query = qs(&[
            ("method", "user.gettopalbums"),
            ("user", username.trim()),
            ("api_key", apiKey.trim()),
            ("format", "json"),
            ("limit", &capped.to_string()),
            ("period", &p),
        ]);
        let url = format!("{LASTFM_BASE}?{query}");
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::GET,
            headers: vec![("User-Agent", "Omnio/1.0 (+https://github.com/TonyMontania/Omnio)")],
            body: None,
            http_error_prefix: "Last.fm",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => {
                // Last.fm 200s with an error envelope on invalid keys —
                // surface it as an error instead of pretending success.
                if let Some(msg) = v.get("message").and_then(|m| m.as_str()) {
                    if v.get("error").is_some() {
                        return err(format!("Last.fm: {msg}"));
                    }
                }
                ok(v)
            }
            Err(e) => err(format!("Last.fm search: {e}")),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn lastfm_album_info(
    apiKey: String,
    username: String,
    artist: String,
    album: String,
    state: State<'_, AppState>,
) -> Result<Value, ()> {
    if apiKey.trim().is_empty() || artist.trim().is_empty() || album.trim().is_empty() {
        return Ok(err("Missing Last.fm API key, artist or album"));
    }
    let mut pairs = vec![
        ("method", "album.getinfo"),
        ("api_key", apiKey.trim()),
        ("artist", artist.trim()),
        ("album", album.trim()),
        ("format", "json"),
        ("autocorrect", "1"),
    ];
    if !username.trim().is_empty() {
        pairs.push(("username", username.trim()));
    }
    let url = format!("{LASTFM_BASE}?{}", qs(&pairs));
    let client = get_http_client(&state);
    let opts = ProxyJsonOptions {
        method: Method::GET,
        headers: vec![("User-Agent", "Omnio/1.0 (+https://github.com/TonyMontania/Omnio)")],
        body: None,
        http_error_prefix: "Last.fm",
    };
    match proxy_json(&client, &url, opts).await {
        Ok(v) => {
            if let Some(msg) = v.get("message").and_then(|m| m.as_str()) {
                if v.get("error").is_some() {
                    return Ok(err(format!("Last.fm: {msg}")));
                }
            }
            Ok(ok(v))
        }
        Err(e) => Ok(err(format!("Last.fm album.getinfo: {e}"))),
    }
}

// -- Wikipedia (musical artists) ---------------------------------------
//
// Scrapes en.wikipedia.org for the `{{Infobox musical artist}}` template
// so the Artist editor can autofill origin, genres, active years,
// labels, current + past members, and a photo URL.
//
// Two commands:
//   - `wiki_artist_search` — MediaWiki search endpoint, returns
//     candidate pages.
//   - `wiki_artist_fetch` — fetches wikitext + main image, parses the
//     infobox params and returns a normalized JSON payload the
//     renderer can plug straight into the artist form.
//
// Kept intentionally best-effort: wikipedia infoboxes vary across
// articles (`current_members` may live under `members`, `origin` may
// contain nested wikilinks with region qualifiers, etc.). We do the
// cheap cleanup pass and leave the rest for the user to tidy.

const WIKI_API: &str = "https://en.wikipedia.org/w/api.php";
const WIKI_UA: &str = "Omnio/1.0 (+https://github.com/TonyMontania/Omnio) reqwest";

fn wiki_headers() -> Vec<(&'static str, &'static str)> {
    vec![("User-Agent", WIKI_UA), ("Accept", "application/json")]
}

#[command]
pub async fn wiki_artist_search(term: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if term.trim().is_empty() { return Ok(err("Missing search term")); }
    let key = term.clone();
    let result = cached_search(&state, "wikipedia-artist", &key, || async {
        // Bias the search toward pages tagged as musical acts by
        // appending `hastemplate:"Infobox musical artist"` — the same
        // filter Wikipedia's own advanced search uses.
        let srsearch = format!("{} hastemplate:\"Infobox musical artist\"", term.trim());
        let url = format!(
            "{WIKI_API}?action=query&list=search&srsearch={}&srlimit=10&format=json&formatversion=2",
            url_encode(&srsearch),
        );
        let client = get_http_client(&state);
        let opts = ProxyJsonOptions {
            method: Method::GET, headers: wiki_headers(), body: None, http_error_prefix: "Wiki",
        };
        match proxy_json(&client, &url, opts).await {
            Ok(v) => ok(v.get("query")
                .and_then(|q| q.get("search"))
                .cloned()
                .unwrap_or(json!([]))),
            Err(e) => err(format!("Wikipedia search: {e}")),
        }
    })
    .await;
    Ok(result)
}

#[command]
pub async fn wiki_artist_fetch(pageTitle: String, state: State<'_, AppState>) -> Result<Value, ()> {
    if pageTitle.trim().is_empty() { return Ok(err("Missing page title")); }
    let client = get_http_client(&state);

    // 1. Fetch wikitext + main image URL in one round-trip.
    let url = format!(
        "{WIKI_API}?action=parse&page={}&prop=wikitext|images&format=json&formatversion=2&redirects=1",
        url_encode(pageTitle.trim()),
    );
    let parse_opts = ProxyJsonOptions {
        method: Method::GET, headers: wiki_headers(), body: None, http_error_prefix: "Wiki",
    };
    let parsed = match proxy_json(&client, &url, parse_opts).await {
        Ok(v) => v,
        Err(e) => return Ok(err(format!("Wikipedia parse: {e}"))),
    };
    let wikitext = parsed.get("parse")
        .and_then(|p| p.get("wikitext"))
        .and_then(|w| w.as_str())
        .unwrap_or("");
    if wikitext.is_empty() {
        return Ok(err("Wikipedia page had no wikitext"));
    }

    // 2. Extract the infobox, then each `| key = value` line.
    let infobox = match extract_infobox(wikitext) {
        Some(s) => s,
        None => return Ok(err("Page has no {{Infobox musical artist}}")),
    };
    let params = parse_infobox_params(&infobox);

    // 3. REST summary API gives us both a curated image and the intro
    // prose. We use the image directly; the extract feeds the prose-
    // based role fallback below.
    let (summary_image, extract) = fetch_wiki_summary(&client, pageTitle.trim()).await;
    let image_url = match summary_image {
        Some(url) => Some(url),
        None => {
            if let Some(fname) = params.get("image").cloned().or_else(|| params.get("img").cloned()) {
                let cleaned = clean_wikitext(&fname);
                let stripped = cleaned.trim().trim_start_matches("File:").trim_start_matches("Image:").to_string();
                if stripped.is_empty() { None } else { resolve_wiki_image_url(&client, &stripped).await }
            } else { None }
        }
    };

    let (active_from, active_to) = parse_years_active(
        params.get("years_active").map(String::as_str).unwrap_or(""),
    );

    let genres = split_wiki_list(params.get("genres").or_else(|| params.get("genre")).map(String::as_str).unwrap_or(""));
    let labels = split_wiki_list(params.get("label").map(String::as_str).unwrap_or(""));
    let origin = clean_wikitext(params.get("origin").or_else(|| params.get("birth_place")).map(String::as_str).unwrap_or(""));
    // Members: prefer the dedicated "Band members" section of the
    // article — it's the richest source, carrying instruments and
    // active-years per person. Fall back to the infobox lists (bare
    // names) plus the intro prose (best-effort role inference) when the
    // section isn't present or the parser gets nothing usable.
    let (section_current, section_past) = parse_band_members_section(wikitext);
    let mut current_members = if !section_current.is_empty() {
        section_current
    } else {
        parse_member_list(params.get("current_members").or_else(|| params.get("members")).map(String::as_str).unwrap_or(""))
    };
    let mut past_members = if !section_past.is_empty() {
        section_past
    } else {
        parse_member_list(params.get("past_members").map(String::as_str).unwrap_or(""))
    };

    // Enrich members with roles inferred from the intro prose when the
    // infobox left them empty. Handles bands like Avenged Sevenfold
    // whose infobox lists just names, with instruments only in the
    // narrative ("vocalist X, guitarists Y and Z, ...").
    if let Some(prose) = extract.as_deref() {
        let prose_roles = extract_roles_from_prose(prose);
        for m in current_members.iter_mut().chain(past_members.iter_mut()) {
            let Some(obj) = m.as_object_mut() else { continue };
            let name = obj.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
            let already_has_roles = obj.get("roles")
                .and_then(|r| r.as_array())
                .map(|a| !a.is_empty())
                .unwrap_or(false);
            if already_has_roles { continue; }
            // Match on last name too — prose often shortens "M. Shadows"
            // to just "Shadows" or "Zacky Vengeance" to "Vengeance".
            let last = name.rsplit(' ').next().unwrap_or(&name).to_string();
            let hit = prose_roles.iter().find(|(n, _)| **n == name || (last.len() >= 3 && n.ends_with(&last)));
            if let Some((_, roles)) = hit {
                obj.insert("roles".to_string(), json!(roles));
            }
        }
    }

    Ok(ok(json!({
        "title": clean_wikitext(params.get("name").map(String::as_str).unwrap_or(pageTitle.trim())),
        "origin": if origin.is_empty() { Value::Null } else { Value::String(origin) },
        "genres": genres,
        "labels": labels,
        "activeFrom": active_from.map(Value::String).unwrap_or(Value::Null),
        "activeTo": active_to.map(Value::String).unwrap_or(Value::Null),
        "currentMembers": current_members,
        "pastMembers": past_members,
        "imageUrl": image_url.map(Value::String).unwrap_or(Value::Null),
    })))
}

// Locate the balanced {{Infobox musical artist ... }} block. Returns
// the inner content (between the opening brace after "artist" and the
// closing "}}"). Handles nested templates via brace-depth counting.
fn extract_infobox(wikitext: &str) -> Option<String> {
    let lower = wikitext.to_lowercase();
    // Match either "musical artist" or "musician" heading — a handful of
    // pages use the older "Infobox musician" template.
    let anchor = lower.find("{{infobox musical artist")
        .or_else(|| lower.find("{{infobox musician"))?;
    let bytes = wikitext.as_bytes();
    let mut i = anchor;
    // Advance past the opening {{
    i += 2;
    let mut depth = 1;
    let start_content = i;
    while i < bytes.len() && depth > 0 {
        if bytes[i] == b'{' && i + 1 < bytes.len() && bytes[i + 1] == b'{' {
            depth += 1;
            i += 2;
            continue;
        }
        if bytes[i] == b'}' && i + 1 < bytes.len() && bytes[i + 1] == b'}' {
            depth -= 1;
            if depth == 0 { break; }
            i += 2;
            continue;
        }
        i += 1;
    }
    if depth != 0 { return None; }
    let inner = &wikitext[start_content..i];
    Some(inner.to_string())
}

// Split "| key = value" pairs. Value may span multiple lines; we treat
// a new line beginning with `|` (at brace depth 0) as the delimiter.
// Nested templates and their internal pipes are preserved.
fn parse_infobox_params(infobox: &str) -> std::collections::HashMap<String, String> {
    use std::collections::HashMap;
    let mut params: HashMap<String, String> = HashMap::new();
    let bytes = infobox.as_bytes();
    let mut i = 0;
    let n = bytes.len();
    // Skip the leading "Infobox musical artist" name (or "Infobox musician")
    // up to the first newline.
    while i < n && bytes[i] != b'\n' { i += 1; }

    while i < n {
        // Find next `|` at brace depth 0, potentially on this line.
        // We already sit at a newline (i.e. bytes[i] == '\n') or just past.
        while i < n && (bytes[i] == b'\n' || bytes[i].is_ascii_whitespace()) { i += 1; }
        if i >= n { break; }
        if bytes[i] != b'|' { break; }
        i += 1;

        // Read key until '='
        let key_start = i;
        while i < n && bytes[i] != b'=' && bytes[i] != b'\n' { i += 1; }
        if i >= n || bytes[i] == b'\n' { continue; }
        let key = infobox[key_start..i].trim().to_lowercase();
        i += 1;

        // Read value until next line starting with '|' at depth 0, or end.
        let val_start = i;
        let mut depth: i32 = 0;
        while i < n {
            if bytes[i] == b'{' && i + 1 < n && bytes[i + 1] == b'{' {
                depth += 1;
                i += 2;
                continue;
            }
            if bytes[i] == b'}' && i + 1 < n && bytes[i + 1] == b'}' {
                depth -= 1;
                if depth < 0 { break; }
                i += 2;
                continue;
            }
            // Newline followed by pipe (at depth 0) = next param.
            if depth == 0 && bytes[i] == b'\n' {
                // Peek past whitespace on the next line.
                let mut j = i + 1;
                while j < n && bytes[j] == b' ' { j += 1; }
                if j < n && (bytes[j] == b'|' || bytes[j] == b'}') { break; }
            }
            i += 1;
        }
        let val = infobox[val_start..i.min(n)].trim_end().to_string();
        if !key.is_empty() {
            params.insert(key, val);
        }
    }
    params
}

// Strip wikilinks / templates from a value. Aggressive but not
// destructive: known templates get flattened to their display text, the
// rest just have their template markers stripped.
fn clean_wikitext(raw: &str) -> String {
    let mut s = raw.to_string();
    // Drop HTML comments <!-- … --> — infoboxes commonly seed these
    // inside {{flatlist}} to hint editors about sourcing; they'd
    // otherwise land as bogus genre entries.
    let re_comment = regex::Regex::new(r"<!--[\s\S]*?-->").unwrap();
    s = re_comment.replace_all(&s, "").to_string();
    // Drop <ref>…</ref>
    let re_ref = regex::Regex::new(r"<ref[^>]*/>|<ref[^>]*>[\s\S]*?</ref>").unwrap();
    s = re_ref.replace_all(&s, "").to_string();
    // Drop <br> and other simple tags (leave a space so words don't run together)
    let re_br = regex::Regex::new(r"<br\s*/?>|<small>|</small>|<sup[^>]*>|</sup>|<sub[^>]*>|</sub>").unwrap();
    s = re_br.replace_all(&s, " ").to_string();
    // Handle {{Nowrap|X}} / {{nowrap|X}}
    let re_nw = regex::Regex::new(r"\{\{[Nn]owrap\|([^}]*)\}\}").unwrap();
    s = re_nw.replace_all(&s, "$1").to_string();
    // {{URL|foo.com}} → foo.com
    let re_url = regex::Regex::new(r"\{\{URL\|([^}|]*)(?:\|[^}]*)?\}\}").unwrap();
    s = re_url.replace_all(&s, "$1").to_string();
    // {{Start date and age|1999}} → 1999 (leave the year)
    let re_date = regex::Regex::new(r"\{\{[Ss]tart date(?: and age)?\|(\d{4})[^}]*\}\}").unwrap();
    s = re_date.replace_all(&s, "$1").to_string();
    let re_end = regex::Regex::new(r"\{\{[Ee]nd date(?: and age)?\|(\d{4})[^}]*\}\}").unwrap();
    s = re_end.replace_all(&s, "$1").to_string();
    // {{hlist|A|B|C}} or {{flatlist|...}} → A · B · C. We handle hlist
    // inline; flatlist wraps a bulleted list which gets handled in
    // parse_member_list / split_wiki_list further downstream.
    let re_hlist = regex::Regex::new(r"\{\{[Hh]list\|([^{}]*)\}\}").unwrap();
    s = re_hlist.replace_all(&s, "$1").to_string();
    let re_plainlist = regex::Regex::new(r"\{\{[Pp]lainlist\s*\|?").unwrap();
    s = re_plainlist.replace_all(&s, "").to_string();
    let re_flatlist = regex::Regex::new(r"\{\{[Ff]latlist\s*\|?").unwrap();
    s = re_flatlist.replace_all(&s, "").to_string();
    // Any surviving simple template like {{X|Y}} → Y
    let re_tmpl = regex::Regex::new(r"\{\{[^{}|]+\|([^{}]*)\}\}").unwrap();
    s = re_tmpl.replace_all(&s, "$1").to_string();
    // Bare templates {{X}} → X
    let re_tmpl2 = regex::Regex::new(r"\{\{([^{}|]+)\}\}").unwrap();
    s = re_tmpl2.replace_all(&s, "$1").to_string();
    // [[X|Y]] → Y
    let re_link_disp = regex::Regex::new(r"\[\[[^\[\]|]+\|([^\[\]]+)\]\]").unwrap();
    s = re_link_disp.replace_all(&s, "$1").to_string();
    // [[X]] → X
    let re_link = regex::Regex::new(r"\[\[([^\[\]|]+)\]\]").unwrap();
    s = re_link.replace_all(&s, "$1").to_string();
    // Trim leftover braces/pipes
    s = s.replace("}}", "").replace("{{", "");
    // Collapse whitespace runs
    let re_ws = regex::Regex::new(r"[ \t]+").unwrap();
    s = re_ws.replace_all(&s, " ").to_string();
    s.trim().trim_matches(|c: char| c == ',' || c == ';' || c == '|').trim().to_string()
}

// Split a genres/labels-style value into a Vec<String>. Handles hlist,
// bullets, commas and pipes as separators.
fn split_wiki_list(raw: &str) -> Vec<String> {
    if raw.trim().is_empty() { return Vec::new(); }
    // Trim leading `* ` / `# ` bullets, and split on newline for
    // bullet-style lists; then on `|` or `,` inside hlist templates.
    let cleaned = clean_wikitext(raw);
    let mut parts: Vec<String> = Vec::new();
    // Split first on any of the common separators — bullet lists get
    // replaced by newlines during clean_wikitext (leftover `*`).
    for chunk in cleaned.split(|c: char| c == '\n' || c == '|' || c == '·' || c == ',') {
        let s = chunk.trim().trim_start_matches('*').trim_start_matches('#').trim();
        if s.is_empty() { continue; }
        // Skip artefacts from bullet lists like "See below".
        if s.len() > 60 { continue; }
        parts.push(s.to_string());
    }
    // Dedup preserving order.
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    parts.into_iter().filter(|p| seen.insert(p.to_lowercase())).collect()
}

// A member list uses one bullet per person, typically shaped as
// `* [[Name]] – instrument1, instrument2` (any of –, —, - or : as
// separator). Parse each bullet into { name, roles: [] }.
fn parse_member_list(raw: &str) -> Vec<Value> {
    if raw.trim().is_empty() { return Vec::new(); }
    let mut out: Vec<Value> = Vec::new();
    for line in raw.lines() {
        let line = line.trim();
        if !line.starts_with('*') && !line.starts_with("#") { continue; }
        let stripped = line.trim_start_matches(|c: char| c == '*' || c == '#' || c == ' ');
        let cleaned = clean_wikitext(stripped);
        if cleaned.is_empty() { continue; }
        // Split on the first name/roles separator we find. Wikipedia's
        // house style favors the en-dash (–, U+2013) but em-dash (—),
        // ASCII hyphen and colon all show up in the wild.
        let sep_idx = cleaned.find(|c: char| c == '–' || c == '—' || c == ':')
            .or_else(|| {
                // Only accept ASCII '-' when surrounded by spaces, so
                // we don't split names like "Jean-Pierre".
                let bytes = cleaned.as_bytes();
                for (i, &b) in bytes.iter().enumerate() {
                    if b == b'-' && i > 0 && i + 1 < bytes.len()
                        && bytes[i - 1] == b' ' && bytes[i + 1] == b' '
                    {
                        return Some(i);
                    }
                }
                None
            });
        let (name_part, roles_part) = if let Some(idx) = sep_idx {
            let name = cleaned[..idx].trim().to_string();
            // Skip the separator char (up to 3 bytes for non-ASCII).
            let rest = cleaned[idx..].chars().next()
                .map(|c| idx + c.len_utf8())
                .unwrap_or(idx + 1);
            (name, cleaned[rest..].trim().to_string())
        } else {
            (cleaned.clone(), String::new())
        };
        if name_part.is_empty() || name_part.len() > 80 { continue; }
        // Roles: split on comma, semicolon or "and". Cap each role at
        // 40 chars to reject leaked footnote scraps.
        let mut roles: Vec<String> = Vec::new();
        if !roles_part.is_empty() {
            let re_split = regex::Regex::new(r",|;|\band\b").unwrap();
            for r in re_split.split(&roles_part) {
                let r = r.trim().trim_end_matches('.').trim();
                if r.is_empty() || r.len() > 40 { continue; }
                // Capitalise the first character to match how the app's
                // editor displays roles ("Vocals", "Guitar", …).
                let mut chars = r.chars();
                let first = chars.next().map(|c| c.to_uppercase().to_string()).unwrap_or_default();
                let rest: String = chars.collect();
                roles.push(format!("{first}{rest}"));
            }
        }
        out.push(json!({ "name": name_part, "roles": roles }));
    }
    out
}

// Wikipedia infoboxes state years_active as "1999–present" or
// "1999–2005, 2012–present" etc. Extract the first year as activeFrom
// and the last date piece as activeTo (or "present" → empty string).
fn parse_years_active(raw: &str) -> (Option<String>, Option<String>) {
    let cleaned = clean_wikitext(raw);
    if cleaned.is_empty() { return (None, None); }
    let re_year = regex::Regex::new(r"\d{4}").unwrap();
    let years: Vec<&str> = re_year.find_iter(&cleaned).map(|m| m.as_str()).collect();
    let first = years.first().map(|s| s.to_string());
    // If the string ends with "present" (case-insensitive), leave `to`
    // empty so the artist appears as still active.
    let low = cleaned.to_lowercase();
    if low.contains("present") {
        return (first, Some(String::new()));
    }
    let last = years.last().map(|s| s.to_string());
    // Only surface `to` when it's actually a different year from `from`
    // — avoids "activeFrom=1999, activeTo=1999" spam for artists with a
    // single year in the field.
    let to = match (first.clone(), last.clone()) {
        (Some(a), Some(b)) if a != b => Some(b),
        _ => None,
    };
    (first, to)
}

// Wikipedia's REST summary API returns a curated top image AND the
// first prose paragraph in one call. We use both: image feeds the
// photo, extract feeds the role-inference fallback for bands whose
// infobox doesn't list instruments (very common — A7X, most punk
// bands, several metal outfits).
async fn fetch_wiki_summary(client: &reqwest::Client, page_title: &str) -> (Option<String>, Option<String>) {
    let path = page_title.replace(' ', "_");
    let url = format!(
        "https://en.wikipedia.org/api/rest_v1/page/summary/{}",
        url_encode(&path),
    );
    let opts = ProxyJsonOptions {
        method: Method::GET, headers: wiki_headers(), body: None, http_error_prefix: "Wiki",
    };
    let v = match proxy_json(client, &url, opts).await {
        Ok(v) => v,
        Err(_) => return (None, None),
    };
    let image = v.get("originalimage")
        .or_else(|| v.get("thumbnail"))
        .and_then(|obj| obj.get("source"))
        .and_then(|s| s.as_str())
        // Strip the utm_* query params the REST endpoint tacks on so
        // downloadImageAsset doesn't reject the URL, and so the saved
        // filename doesn't end up with a giant query string.
        .map(|s| s.split('?').next().unwrap_or(s).to_string());
    let extract = v.get("extract").and_then(|s| s.as_str()).map(String::from);
    (image, extract)
}

// Parse the article's "Band members" (or "Members" / "Personnel" /
// "Line-up" / "Musicians") section. Wikipedia's house style groups the
// roster under either bold-quoted labels ('''Current members''') or
// wiki subheadings (=== Current ===) — both are handled here, plus a
// handful of common variants ('Current lineup', 'Former', 'Past').
//
// Each bullet arrives as one of:
//   * [[Name]] (Real name) – lead vocals, keyboards <small>(1999–present)</small>
//   * Name – guitar (2015–present)                              # 156/Silence
//   * (#6) [[Name|Alias]] – percussion (1995–present)           # Slipknot
//
// Return (current, past) as JSON member objects with `name`, `roles`,
// `joinedIn`, `leftIn`. Empty tuples when the section isn't present.
// The `bucket_kind` label carried alongside each bullet is used later
// to route touring musicians into the touring MemberStatus buckets.
fn parse_band_members_section(wikitext: &str) -> (Vec<Value>, Vec<Value>) {
    // Section heading tolerates trailing templates like {{anchor|X}} —
    // Slipknot literally uses "== Band members{{anchor|Band_members}} ==".
    let re_section = regex::Regex::new(
        r"(?im)^(={2,4})\s*(Band members|Band personnel|Members|Personnel|Line[- ]?up|Lineup|Musicians)\b[^=]*\1\s*$",
    ).unwrap();
    let Some(head) = re_section.find(wikitext) else { return (Vec::new(), Vec::new()); };
    // Determine the heading level so we can stop at the next heading of
    // the same or higher level — subheadings (===) belong to us.
    let matched = &wikitext[head.start()..head.end()];
    let level = matched.chars().take_while(|&c| c == '=').count().max(2);
    let tail = &wikitext[head.end()..];
    // Build a regex that matches EXACTLY `level` `=` at line start,
    // followed by non-`=` (so a deeper subheading doesn't count).
    let same_or_higher = format!(r"(?m)^={{2,{level}}}[^=]");
    let re_next = regex::Regex::new(&same_or_higher).unwrap();
    let end = re_next.find(tail).map(|m| m.start()).unwrap_or(tail.len());
    let body = &tail[..end];

    let mut current: Vec<Value> = Vec::new();
    let mut past: Vec<Value> = Vec::new();
    // Bucket kind: 0 = none, 1 = current, 2 = former,
    // 3 = current touring, 4 = former touring.
    let mut bucket_kind: u8 = 0;

    for raw_line in body.lines() {
        let line = raw_line.trim();
        // Detect subheading (`=== Current ===`) or bold label
        // (`'''Current members'''`).
        if let Some(kind) = classify_member_subheading(line) {
            bucket_kind = kind;
            continue;
        }
        if !line.starts_with('*') && !line.starts_with('#') { continue; }
        if bucket_kind == 0 { continue; }
        let stripped = line.trim_start_matches(|c: char| c == '*' || c == '#' || c == ' ');
        if let Some(member_obj) = parse_member_bullet(stripped) {
            // Route by bucket. Attach the intended membership so the
            // renderer can pick up touring musicians correctly.
            let mut with_meta = member_obj;
            if let Value::Object(ref mut m) = with_meta {
                let membership = match bucket_kind {
                    1 => "current",
                    2 => "former",
                    3 => "current-touring",
                    4 => "former-touring",
                    _ => "current",
                };
                m.insert("membership".to_string(), json!(membership));
            }
            if bucket_kind == 1 || bucket_kind == 3 {
                current.push(with_meta);
            } else {
                past.push(with_meta);
            }
        }
    }

    (current, past)
}

// Match a member-list subheading line and return the bucket kind:
//   1 current, 2 former, 3 current touring, 4 former touring.
// Returns None when the line doesn't look like a subheading at all.
fn classify_member_subheading(line: &str) -> Option<u8> {
    // Strip both wiki subheading markers `===` and bold quotes `'''`
    // before matching so `'''Current members'''` and `=== Current ===`
    // both reach the classifier with a bare "current members" string.
    let bare = line
        .trim_matches(|c: char| c == '=' || c == '\'' || c.is_whitespace())
        .to_lowercase();
    if bare.is_empty() { return None; }
    let is_touring = bare.contains("touring") || bare.contains("session");
    let is_former = bare.contains("former") || bare.contains("past") || bare.contains("previous")
        || bare.contains("ex-") || bare.contains("original");
    let is_current = bare.contains("current") || bare.contains("present") || bare.contains("active");
    // "Members" / "Lineup" on their own default to current.
    let is_bare_members = matches!(bare.as_str(),
        "current" | "current members" | "current lineup" | "current line-up" | "current line up"
        | "members" | "lineup" | "line-up" | "line up"
    );
    if is_touring {
        if is_former { return Some(4); }
        return Some(3);
    }
    if is_former { return Some(2); }
    if is_current || is_bare_members { return Some(1); }
    None
}

// Turn one bullet — everything after "* " — into a member JSON object.
// Handles the wikitext-loaded shapes we see in real articles:
//   [[Name]] (Real name) – roles <small>(1999–present)</small>
//   Name – roles
//   Name (Real name)
fn parse_member_bullet(raw: &str) -> Option<Value> {
    // Pull year-range info from any <small>(...)</small> chunk first,
    // falling back to any plain (yyyy–yyyy) or (yyyy–present) that
    // sits in the tail — 156/Silence writes the range without the
    // <small> wrapper, so we need both paths.
    let re_small = regex::Regex::new(r"<small>\s*\(([^<)]*)\)\s*</small>").unwrap();
    let mut year_hints: Vec<String> = re_small
        .captures_iter(raw)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .collect();
    if year_hints.is_empty() {
        // Plain "(1999–present)" or "(2015–2017)". Only accept parens
        // that contain a 4-digit year to avoid slurping real-name
        // parentheticals ("(Matthew Sanders)").
        let re_plain = regex::Regex::new(r"\(\s*([^()]*\d{4}[^()]*)\)").unwrap();
        for c in re_plain.captures_iter(raw) {
            if let Some(m) = c.get(1) {
                year_hints.push(m.as_str().to_string());
            }
        }
    }
    let (joined_in, left_in) = year_hints.first()
        .map(|s| parse_years_active(s))
        .unwrap_or((None, None));

    // Now clean the display line: templates, wikilinks, tags — including
    // the <small> spans we just harvested.
    let cleaned = clean_wikitext(raw);
    if cleaned.is_empty() { return None; }

    // Strip Slipknot-style "(#6) " numbering prefix, if present.
    let cleaned = {
        let re_num = regex::Regex::new(r"^\(#?\w{1,4}\)\s*").unwrap();
        re_num.replace(&cleaned, "").to_string()
    };
    if cleaned.is_empty() { return None; }

    // Strip the "(Real name)" segment right after the display name;
    // Wikipedia uses it to spell out real names next to stage names.
    // Only strip the first pair of parens that comes before the roles
    // separator, so the roles list itself keeps any parenthetical
    // qualifiers.
    let sep_idx = cleaned.find(|c: char| c == '–' || c == '—' || c == ':')
        .or_else(|| find_ascii_dash_separator(&cleaned));
    let (name_part, roles_part) = if let Some(idx) = sep_idx {
        let name = cleaned[..idx].trim().to_string();
        let rest = cleaned[idx..].chars().next()
            .map(|c| idx + c.len_utf8())
            .unwrap_or(idx + 1);
        (name, cleaned[rest..].trim().to_string())
    } else {
        (cleaned.clone(), String::new())
    };

    // Drop the "(Real name)" parenthetical from the display name.
    let name_clean = strip_first_parens(&name_part);
    if name_clean.is_empty() || name_clean.len() > 80 { return None; }

    let mut roles: Vec<String> = Vec::new();
    if !roles_part.is_empty() {
        // Split on `,` `;` `and` — same rule as the infobox path.
        let re_split = regex::Regex::new(r",|;|\band\b").unwrap();
        for r in re_split.split(&roles_part) {
            // Strip trailing/leading year parentheticals and punctuation.
            let r = r.trim().trim_end_matches('.').trim();
            // Drop "(...)" wrappers left over from stripped small tags
            // that were nested inside the roles list.
            let cleaned_role = strip_parens(r);
            if cleaned_role.is_empty() || cleaned_role.len() > 40 { continue; }
            let mut chars = cleaned_role.chars();
            let first = chars.next().map(|c| c.to_uppercase().to_string()).unwrap_or_default();
            let rest: String = chars.collect();
            roles.push(format!("{first}{rest}"));
        }
    }

    let mut obj = json!({ "name": name_clean, "roles": roles });
    if let Value::Object(ref mut o) = obj {
        if let Some(j) = joined_in { o.insert("joinedIn".to_string(), json!(j)); }
        if let Some(l) = left_in { o.insert("leftIn".to_string(), json!(l)); }
    }
    Some(obj)
}

fn find_ascii_dash_separator(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if b == b'-' && i > 0 && i + 1 < bytes.len()
            && bytes[i - 1] == b' ' && bytes[i + 1] == b' '
        {
            return Some(i);
        }
    }
    None
}

fn strip_first_parens(s: &str) -> String {
    let bytes = s.as_bytes();
    if let Some(open) = bytes.iter().position(|&b| b == b'(') {
        if let Some(rel_close) = bytes[open..].iter().position(|&b| b == b')') {
            let close = open + rel_close;
            let before = s[..open].trim_end();
            let after = &s[close + 1..];
            return format!("{before}{after}").trim().to_string();
        }
    }
    s.trim().to_string()
}

fn strip_parens(s: &str) -> String {
    let re = regex::Regex::new(r"\([^)]*\)").unwrap();
    re.replace_all(s, "").trim().to_string()
}

// Role vocabulary that appears in intro prose for bands. Order matters:
// "guitarist" wins over "guitar" so we don't over-count the substring.
static PROSE_ROLE_PATTERNS: &[(&str, &str)] = &[
    ("vocalist", "Vocals"),
    ("lead vocalist", "Lead vocals"),
    ("lead singer", "Lead vocals"),
    ("singer", "Vocals"),
    ("frontman", "Vocals"),
    ("lead guitarist", "Lead guitar"),
    ("rhythm guitarist", "Rhythm guitar"),
    ("guitarist", "Guitar"),
    ("bassist", "Bass"),
    ("bass player", "Bass"),
    ("drummer", "Drums"),
    ("percussionist", "Percussion"),
    ("keyboardist", "Keyboards"),
    ("pianist", "Piano"),
    ("saxophonist", "Saxophone"),
    ("violinist", "Violin"),
    ("cellist", "Cello"),
    ("trumpeter", "Trumpet"),
    ("DJ", "DJ"),
    ("producer", "Producer"),
    ("songwriter", "Songwriter"),
];

// Parse "vocalist X, guitarists Y and Z, bassist W and drummer V" style
// intro prose into (member_name → [role]) mappings. Best-effort — we
// look for a known role verb, then walk the neighboring names (either
// stopping at the next role verb or at a period).
fn extract_roles_from_prose(prose: &str) -> std::collections::HashMap<String, Vec<String>> {
    use std::collections::HashMap;
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    if prose.trim().is_empty() { return map; }
    // Grab the first 1-2 sentences — "The band's current lineup consists
    // of vocalist X, ..." is almost always in there. Cap so we don't
    // pull role words from unrelated later paragraphs.
    let clean = prose.replace('\n', " ");
    let head: String = clean.chars().take(600).collect();
    // For each role pattern, look for occurrences and attach the roles
    // to the capitalized name(s) that follow. Names are runs of
    // capitalized words possibly separated by ". ", " ", or a period.
    let name_re = regex::Regex::new(r"([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){0,3})").unwrap();
    // Longest patterns first so "lead guitarist" wins over "guitarist"
    // when matched.
    let mut patterns: Vec<(&str, &str)> = PROSE_ROLE_PATTERNS.to_vec();
    patterns.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));

    for (verb, role) in patterns {
        let verb_re = regex::Regex::new(&format!(
            r"(?i)\b{}s?\b",
            regex::escape(verb),
        )).unwrap();
        for hit in verb_re.find_iter(&head) {
            let tail = &head[hit.end()..];
            // Grab all capitalized names in the immediate span (up to
            // the next role verb or a period).
            let cutoff = tail.find(|c: char| c == '.' || c == ';')
                .map(|i| i.min(120))
                .unwrap_or(120);
            let span = &tail[..cutoff.min(tail.len())];
            // Stop at the next known role verb.
            let mut stop = span.len();
            for (v2, _) in PROSE_ROLE_PATTERNS {
                if let Some(idx) = span.to_lowercase().find(v2) {
                    if idx < stop { stop = idx; }
                }
            }
            let take = &span[..stop];
            for cap in name_re.captures_iter(take) {
                let name = cap.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
                if name.is_empty() || name.len() > 60 { continue; }
                // Skip lower-value hits like "The" or "A7X".
                if name.chars().count() < 3 { continue; }
                let entry = map.entry(name).or_default();
                if !entry.iter().any(|r| r == role) {
                    entry.push(role.to_string());
                }
            }
        }
    }
    map
}

// Convert a wiki image filename ("Foo.jpg") into the direct URL by
// asking MediaWiki's imageinfo endpoint. Returns None if the file
// doesn't exist or the API errors.
async fn resolve_wiki_image_url(client: &reqwest::Client, filename: &str) -> Option<String> {
    let url = format!(
        "{WIKI_API}?action=query&titles=File:{}&prop=imageinfo&iiprop=url&format=json&formatversion=2",
        url_encode(filename),
    );
    let opts = ProxyJsonOptions {
        method: Method::GET, headers: wiki_headers(), body: None, http_error_prefix: "Wiki",
    };
    let v = proxy_json(client, &url, opts).await.ok()?;
    v.get("query")?
        .get("pages")?
        .as_array()?
        .first()?
        .get("imageinfo")?
        .as_array()?
        .first()?
        .get("url")?
        .as_str()
        .map(String::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hltb_seconds_conversion() {
        assert_eq!(hltb_seconds_to_hours(&json!(0)), None);
        assert_eq!(hltb_seconds_to_hours(&json!(3600)), Some(1.0));
        assert_eq!(hltb_seconds_to_hours(&json!(5400)), Some(1.5));
        assert_eq!(hltb_seconds_to_hours(&json!(null)), None);
    }

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
