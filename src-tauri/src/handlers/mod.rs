// Handler modules — one per grouping in `electron/handlers/`.
// Currently only `system` is ported (Fase B step 1); the rest arrive
// one module per step in the order defined in the Rust-migration plan.

pub mod data;
pub mod fetchers;
pub mod images;
pub mod storage;
pub mod system;
pub mod updates;
