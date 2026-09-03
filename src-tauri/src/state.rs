// Shared main-process state — the Rust equivalent of the module-scope
// closures in `electron/net.ts` (proxy dispatcher, cachedSearch map)
// and `electron/util.ts` (lastHashes). Each field is behind a Mutex
// (or RwLock) so commands can mutate it safely from any tokio task.

use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Mutex, RwLock};

/// A cached (source, query) → payload row. Persisted to
/// `data/cache/searches.json`; expired rows are dropped at load.
/// Fields read by net::cached_search / persist_search_cache;
/// dead_code allow avoids nagging warnings until fetchers.rs (step 8)
/// makes those readers hot.
#[allow(dead_code)]
pub struct SearchCacheEntry {
    pub result: Value,
    /// ms since UNIX_EPOCH — matches the shape the TS side writes
    /// so a mixed-backend transition sees each other's cached rows.
    pub expires_ms: u64,
}

#[allow(dead_code)]
pub struct AppState {
    /// Shared reqwest client rebuilt by `net::apply_proxy_setting`.
    /// RwLock because writes (proxy changes from Settings) are rare
    /// and reads (every fetcher call) are hot. Client is Arc<Inner>
    /// internally so `.read().clone()` is cheap.
    pub http_client: RwLock<Client>,

    /// (source, query) → cached hits. Loaded lazily on first read
    /// from `data/cache/searches.json`; persisted synchronously after
    /// each new entry (TS coalesces via 500ms setTimeout — POC skips
    /// that until profiling shows it matters).
    pub search_cache: Mutex<HashMap<String, SearchCacheEntry>>,

    /// Guards the one-shot lazy load of the search cache from disk.
    /// Loaded == true after the first read attempt regardless of
    /// whether the file existed — a missing file is a valid "empty"
    /// state and we should not retry the read on every hit.
    pub search_cache_loaded: AtomicBool,

    /// Last SHA-1 written per absolute file path — powers
    /// `write_if_changed` dedup so a save that only touched one
    /// category doesn't rewrite every JSON. Mirrors the module-scope
    /// `lastHashes` object in electron/util.ts. Reset by
    /// data:restore-backup once the snapshot is applied.
    pub last_hashes: Mutex<HashMap<PathBuf, String>>,
}

impl Default for AppState {
    fn default() -> Self {
        // Panic here means reqwest can't build a plain client — that's
        // a broken TLS/system config that the app can't recover from.
        let http_client = Client::builder()
            .build()
            .expect("reqwest::Client default build failed");
        Self {
            http_client: RwLock::new(http_client),
            search_cache: Mutex::new(HashMap::new()),
            search_cache_loaded: AtomicBool::new(false),
            last_hashes: Mutex::new(HashMap::new()),
        }
    }
}
