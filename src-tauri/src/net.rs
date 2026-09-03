// Same reason as util.rs / paths.rs: `cached_search`, `proxy_json`,
// `mb_throttle`, `anidb_throttle` and `get_http_client` land here as
// primitives — their only callers arrive with the fetchers.rs port
// (Fase B step 8). Silence unused-warnings until then.
#![allow(dead_code)]

// Networking primitives — Rust port of `electron/net.ts`.
//
//   apply_proxy_setting / get_http_client  — rebuild the shared reqwest
//                                            Client when the user
//                                            changes the proxy field
//   proxy_json                              — JSON fetch skeleton every
//                                            fetcher wraps
//   cached_search / clear_search_cache      — 24h TTL cache backed by
//                                            data/cache/searches.json
//   mb_throttle / anidb_throttle            — hard rate-limit gates
//
// Nothing here talks to a specific API; the fetchers (Fase B step 8)
// build on this file. One-way dependency: net.rs → paths.rs. Nothing
// in this file imports from a handler.

use crate::paths;
use crate::state::{AppState, SearchCacheEntry};

use reqwest::{header::HeaderName, header::HeaderValue, Client, Method};
use serde_json::Value;
use std::future::Future;
use std::path::PathBuf;
use std::sync::LazyLock as Lazy;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::fs;
use tokio::sync::Mutex as AsyncMutex;

// -- Proxy management ------------------------------------------------
//
// `applyProxySetting` in TS mutates a global undici dispatcher; every
// subsequent `fetch(...)` call picks it up automatically. Rust needs an
// explicit shared Client. `AppState.http_client` is an RwLock — writes
// (proxy changes) are rare; reads (every fetch) are hot and cheap
// (reqwest::Client is Arc<Inner> internally).

pub fn apply_proxy_setting(state: &State<'_, AppState>, url: Option<&str>) -> Result<(), String> {
    let mut builder = Client::builder();
    if let Some(u) = url.map(str::trim).filter(|u| !u.is_empty()) {
        // Same guard as the TS: require an http(s) scheme so a
        // malformed setting doesn't blow up reqwest downstream.
        if !u.to_ascii_lowercase().starts_with("http://")
            && !u.to_ascii_lowercase().starts_with("https://")
        {
            return Err(format!("proxy URL must start with http(s)://: {u}"));
        }
        let proxy = reqwest::Proxy::all(u).map_err(|e| format!("reqwest::Proxy: {e}"))?;
        builder = builder.proxy(proxy);
    }
    let client = builder.build().map_err(|e| format!("reqwest::Client: {e}"))?;
    let mut lock = state
        .http_client
        .write()
        .map_err(|e| format!("http_client lock poisoned: {e}"))?;
    *lock = client;
    Ok(())
}

/// Cheap Arc clone of the shared client. Every fetcher grabs one per
/// call — reqwest::Client is designed to be cloned freely.
pub fn get_http_client(state: &State<'_, AppState>) -> Client {
    state
        .http_client
        .read()
        .expect("http_client lock poisoned")
        .clone()
}

// -- proxy_json ------------------------------------------------------
//
// JSON fetch skeleton — same envelope shape as the TS
// `Promise<{ ok: true, data } | { ok: false, error }>` that every
// fetcher matches on. The `pick` / `softError` closures from the TS
// version don't cross the FFI boundary (fetchers.rs consumes this
// directly, no IPC), so we return the raw `Value` and let each caller
// walk the payload.

pub struct ProxyJsonOptions<'a> {
    pub method: Method,
    /// Header pairs applied in order. Kept as an owned Vec of borrowed
    /// tuples so a caller can construct it inline without lifetime
    /// gymnastics.
    pub headers: Vec<(&'a str, &'a str)>,
    pub body: Option<String>,
    /// Custom prefix for HTTP-level errors — matches the TS
    /// `httpErrorPrefix` option so the toast says "SGDB 429" instead
    /// of "HTTP 429" when the caller wants attribution.
    pub http_error_prefix: &'a str,
}

impl<'a> Default for ProxyJsonOptions<'a> {
    fn default() -> Self {
        Self { method: Method::GET, headers: Vec::new(), body: None, http_error_prefix: "HTTP" }
    }
}

pub async fn proxy_json(
    client: &Client,
    url: &str,
    opts: ProxyJsonOptions<'_>,
) -> Result<Value, String> {
    let mut req = client.request(opts.method.clone(), url);
    for (k, v) in &opts.headers {
        // Skip pairs that can't legally sit in an HTTP header rather
        // than panic — a fetcher writing bogus header names is a bug,
        // but this is the wrong place to crash the whole app.
        if let (Ok(name), Ok(value)) = (
            HeaderName::from_bytes(k.as_bytes()),
            HeaderValue::from_str(v),
        ) {
            req = req.header(name, value);
        }
    }
    if let Some(body) = opts.body {
        req = req.body(body);
    }

    let resp = req.send().await.map_err(|e| {
        // reqwest wraps every network failure (DNS, connection reset,
        // TLS handshake, socket hang up, …); the surface message is
        // usually enough. If a `source()` chain is present, walk it —
        // matches the "err.message (err.cause.message)" the TS logs.
        let mut msg = e.to_string();
        let mut src: Option<&(dyn std::error::Error + 'static)> = std::error::Error::source(&e);
        if let Some(inner) = src.take() {
            msg = format!("{msg} ({inner})");
        }
        eprintln!("[proxy_json] {url} — {msg}");
        msg
    })?;

    if !resp.status().is_success() {
        return Err(format!("{} {}", opts.http_error_prefix, resp.status().as_u16()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    serde_json::from_slice::<Value>(&bytes).map_err(|e| format!("bad JSON: {e}"))
}

// -- Search cache ----------------------------------------------------
//
// Same (source, query) → result cache the TS side maintains. Loaded
// lazily on first read. Persisted synchronously on every write — the
// TS coalesces bursts via a 500ms setTimeout; for the POC we skip that
// coalescing because the write is small (one JSON file) and rare
// (once per successful fetch). If profiling shows disk thrash we'll
// add a debounce timer here.

const SEARCH_CACHE_TTL_MS: u64 = 24 * 60 * 60 * 1000;

fn search_cache_file() -> PathBuf {
    paths::get().data_dir.join("cache").join("searches.json")
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

async fn load_search_cache_if_needed(state: &State<'_, AppState>) {
    // Cheap fast path: the loaded flag is a plain bool inside the
    // same mutex, so one lock decides load-or-not.
    {
        let cache = state.search_cache.lock().expect("search_cache poisoned");
        if state
            .search_cache_loaded
            .load(std::sync::atomic::Ordering::Acquire)
        {
            drop(cache);
            return;
        }
    }
    let raw = match fs::read_to_string(search_cache_file()).await {
        Ok(s) => s,
        Err(_) => {
            state
                .search_cache_loaded
                .store(true, std::sync::atomic::Ordering::Release);
            return;
        }
    };
    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => {
            state
                .search_cache_loaded
                .store(true, std::sync::atomic::Ordering::Release);
            return;
        }
    };
    let obj = match parsed.as_object() {
        Some(o) => o,
        None => {
            state
                .search_cache_loaded
                .store(true, std::sync::atomic::Ordering::Release);
            return;
        }
    };
    let now = now_ms();
    let mut cache = state.search_cache.lock().expect("search_cache poisoned");
    for (k, v) in obj {
        // Same "drop already-expired at load" filter the TS applies —
        // keeps the map small across restarts.
        let expires = v.get("expires").and_then(|x| x.as_u64()).unwrap_or(0);
        if expires <= now {
            continue;
        }
        let result = match v.get("result") {
            Some(r) => r.clone(),
            None => continue,
        };
        cache.insert(k.clone(), SearchCacheEntry { result, expires_ms: expires });
    }
    state
        .search_cache_loaded
        .store(true, std::sync::atomic::Ordering::Release);
}

async fn persist_search_cache(state: &State<'_, AppState>) {
    let snapshot: Value = {
        let cache = state.search_cache.lock().expect("search_cache poisoned");
        let mut obj = serde_json::Map::with_capacity(cache.len());
        for (k, entry) in cache.iter() {
            let mut inner = serde_json::Map::new();
            inner.insert("result".into(), entry.result.clone());
            inner.insert("expires".into(), Value::from(entry.expires_ms));
            obj.insert(k.clone(), Value::Object(inner));
        }
        Value::Object(obj)
    };
    let file = search_cache_file();
    if let Some(parent) = file.parent() {
        let _ = fs::create_dir_all(parent).await;
    }
    let _ = fs::write(&file, snapshot.to_string()).await;
}

/// Wraps `fetch_fn` with a (source, query) TTL cache. On miss, runs
/// the fetch, caches only if the payload looks like `{ ok: true }`
/// (persisting a network error would hide the retry that would have
/// worked on the next attempt — same TS heuristic).
pub async fn cached_search<F, Fut>(
    state: &State<'_, AppState>,
    source: &str,
    key: &str,
    fetch_fn: F,
) -> Value
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Value>,
{
    load_search_cache_if_needed(state).await;
    let cache_key = format!("{source}::{}", key.trim().to_ascii_lowercase());
    let now = now_ms();

    // Fast path: locked read only.
    {
        let cache = state.search_cache.lock().expect("search_cache poisoned");
        if let Some(hit) = cache.get(&cache_key) {
            if hit.expires_ms > now {
                return hit.result.clone();
            }
        }
    }

    let result = fetch_fn().await;
    let looks_ok = result
        .get("ok")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if looks_ok {
        let entry = SearchCacheEntry {
            result: result.clone(),
            expires_ms: now + SEARCH_CACHE_TTL_MS,
        };
        {
            let mut cache = state.search_cache.lock().expect("search_cache poisoned");
            cache.insert(cache_key, entry);
        }
        persist_search_cache(state).await;
    }
    result
}

pub async fn clear_search_cache(state: &State<'_, AppState>) {
    {
        let mut cache = state.search_cache.lock().expect("search_cache poisoned");
        cache.clear();
    }
    let _ = fs::remove_file(search_cache_file()).await;
}

// -- Rate-limit throttlers -------------------------------------------
//
// Serialize concurrent callers via `AsyncMutex` — sleeping WHILE the
// lock is held guarantees the next caller sees the fresh last-call
// timestamp instead of computing wait from the pre-sleep value. Using
// `std::sync::Mutex` here would defeat the throttle: two racing
// callers would both compute `wait = 0` off the same base and fire
// simultaneously.

static MB_LAST_CALL: Lazy<AsyncMutex<Option<Instant>>> = Lazy::new(|| AsyncMutex::new(None));
static ANIDB_LAST_CALL: Lazy<AsyncMutex<Option<Instant>>> = Lazy::new(|| AsyncMutex::new(None));

async fn throttle(gate: &AsyncMutex<Option<Instant>>, min_gap: Duration) {
    let mut last = gate.lock().await;
    if let Some(prev) = *last {
        let elapsed = prev.elapsed();
        if elapsed < min_gap {
            tokio::time::sleep(min_gap - elapsed).await;
        }
    }
    *last = Some(Instant::now());
}

/// MusicBrainz: 1 req/s soft limit. Pace at 1.05s for clock skew.
pub async fn mb_throttle() {
    throttle(&MB_LAST_CALL, Duration::from_millis(1050)).await;
}

/// AniDB: 2 req/s per client, and they take rate limiting personally
/// (BANNED status persists). Pace at 2.1s to be a good citizen.
pub async fn anidb_throttle() {
    throttle(&ANIDB_LAST_CALL, Duration::from_millis(2100)).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn options_default_is_get_no_body() {
        let o = ProxyJsonOptions::default();
        assert_eq!(o.method, Method::GET);
        assert!(o.headers.is_empty());
        assert!(o.body.is_none());
        assert_eq!(o.http_error_prefix, "HTTP");
    }

    #[tokio::test(flavor = "current_thread")]
    async fn throttle_serializes_bursts() {
        // Real time (no `start_paused` — needs tokio's test-util
        // feature we don't want to pull in for one test). 20ms gap
        // keeps the test fast (~40ms total for 3 calls) while still
        // proving the gate holds.
        let gate: AsyncMutex<Option<Instant>> = AsyncMutex::new(None);
        let gap = Duration::from_millis(20);
        let start = Instant::now();
        throttle(&gate, gap).await;
        throttle(&gate, gap).await;
        throttle(&gate, gap).await;
        // First call passes immediately; second and third each wait
        // one gap. Allow slack for scheduler jitter.
        let elapsed = start.elapsed();
        assert!(elapsed >= 2 * gap, "elapsed={elapsed:?}");
    }
}
