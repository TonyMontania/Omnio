// Omnio Tauri POC — entry point.
//
// This is the equivalent of `electron/main.ts` (post-Fase-1.2 slim
// version, 132 LoC): app lifecycle + register every ported handler.
// The bulk of the work lives in `handlers/*.rs`, mirroring
// `electron/handlers/*.ts` one-to-one so future ports can be diffed
// side by side.
//
// State that Electron kept in module-scope closures (proxy URL, search
// cache) lives in `state::AppState`, threaded through every command via
// `tauri::State<AppState>`. Rust makes the shared mutability explicit;
// Electron just captured it.

#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod asset_protocol;
mod handlers;
mod migrate_from_electron;
mod net;
mod paths;
mod schemas;
mod state;
mod util;

use state::AppState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        // `omnio-asset://<category>/<kind>/<file>` serves files out of
        // `assets_root` — same protocol the Electron main registers.
        // Renderer `<img src="omnio-asset://...">` tags Just Work under
        // Tauri after this line lands.
        .register_uri_scheme_protocol("omnio-asset", asset_protocol::handle)
        .setup(|app| {
            // Storage-root + on-disk layout has to wait until the
            // AppHandle exists (only then can we ask Tauri for
            // app_data_dir on non-packaged builds). Every downstream
            // command / helper reads from paths::get() from here on.
            //
            // `expect` is the right escape hatch here — a failure to
            // resolve app_data_dir at boot means we can't operate at
            // all, and there is no meaningful recovery path.
            paths::init(app.handle()).expect("paths::init failed at boot");

            // Fase E first-boot migration — clone the user's Electron
            // library into the Tauri storage root if we detect one.
            // Runs before the renderer ever calls `data:load`, so the
            // first `data:load` sees the migrated files.
            let root = paths::get().storage_root.clone();
            tauri::async_runtime::block_on(async move {
                let _ = migrate_from_electron::migrate_if_needed(&root).await;
            });
            Ok(())
        })
        // Every command listed here mirrors one `typedHandle(...)` in
        // `electron/handlers/system.ts`. Command names use snake_case
        // because Tauri command routing splits on `_`, not on `:` —
        // the renderer-side `invoke()` will translate
        // `'proxy:apply'` → `'proxy_apply'` in Fase C.
        .invoke_handler(tauri::generate_handler![
            handlers::system::proxy_apply,
            handlers::system::cache_clear_searches,
            handlers::system::item_export_json,
            handlers::system::library_export_text,
            handlers::system::library_save_text_to,
            handlers::system::system_reveal,
            handlers::system::fs_list_dir,
            handlers::system::fs_common_locations,
            handlers::system::fs_path_info,
            handlers::system::fs_mkdir,
            handlers::system::dialog_pick_directory,
            handlers::system::export_site,
            handlers::system::export_csv,
            handlers::storage::storage_root,
            handlers::storage::storage_copy_data_to,
            handlers::storage::storage_clean_orphan_assets,
            handlers::storage::storage_import_assets_from,
            handlers::storage::storage_cleanup_migration_artifacts,
            handlers::storage::storage_rename_all_assets,
            handlers::data::data_save,
            handlers::data::data_load,
            handlers::data::data_list_backups,
            handlers::data::data_restore_backup,
            handlers::images::image_save,
            handlers::images::image_delete,
            handlers::images::image_download,
            handlers::images::asset_blob_save,
            handlers::images::asset_blob_delete,
            handlers::images::asset_blob_reveal,
            handlers::images::storage_audit_broken_assets,
            handlers::images::storage_clear_asset_ref,
            handlers::images::storage_clear_asset_refs,
            handlers::updates::updates_check,
            handlers::updates::updates_install_kind,
            handlers::updates::updates_open_url,
            handlers::updates::updates_download,
            handlers::updates::updates_reveal,
            handlers::updates::updates_launch_installer,
            handlers::updates::updates_appimage_swap,
            handlers::updates::updates_open_dmg,
            // Fetchers — 28 commands across 17 sources
            handlers::fetchers::sgdb_search,
            handlers::fetchers::sgdb_assets,
            handlers::fetchers::jikan_search,
            handlers::fetchers::kitsu_search,
            handlers::fetchers::mangadex_search,
            handlers::fetchers::mangadex_covers,
            handlers::fetchers::comicvine_search,
            handlers::fetchers::comicvine_volume,
            handlers::fetchers::mb_search,
            handlers::fetchers::mb_release_group_details,
            handlers::fetchers::vgmdb_search,
            handlers::fetchers::vgmdb_album,
            handlers::fetchers::igdb_search,
            handlers::fetchers::tmdb_search,
            handlers::fetchers::tmdb_details,
            handlers::fetchers::anilist_search,
            handlers::fetchers::steam_library,
            handlers::fetchers::openlibrary_search,
            handlers::fetchers::openlibrary_work,
            handlers::fetchers::vndb_search,
            handlers::fetchers::vndb_detail,
            handlers::fetchers::vndb_characters,
            handlers::fetchers::vndb_releases,
            handlers::fetchers::discogs_collection,
            handlers::fetchers::lrclib_track,
            handlers::fetchers::anidb_anime,
            handlers::fetchers::pcgw_search,
            handlers::fetchers::pcgw_save_paths,
            // Plugin sandbox — generic infra for locally-installed
            // renderer overlays under `src/categories/<slug>/`.
            handlers::install_scan::install_scan,
            handlers::plugins::plugin_data_load,
            handlers::plugins::plugin_data_save,
            handlers::plugins::plugin_asset_download,
            handlers::plugins::plugin_asset_save_data_url,
            handlers::plugins::plugin_asset_save_from_file,
            handlers::plugins::plugin_asset_delete,
            handlers::plugins::plugin_asset_rename,
            handlers::plugins::plugin_saves_list,
            handlers::plugins::plugin_saves_add,
            handlers::plugins::plugin_saves_delete,
            handlers::plugins::plugin_saves_open_folder,
            handlers::plugins::plugin_saves_reveal,
            handlers::plugins::plugin_saves_rename_folder,
            handlers::plugins::plugin_saves_delete_all,
            handlers::plugins::net_fetch_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
