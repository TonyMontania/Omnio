// Runtime validation of on-disk JSON — Rust port of
// `electron/schemas.ts` (Fase 3.2). Same "loose object with required
// identity keys" contract: every entity requires its id / categoryId /
// title / createdAt so the renderer can key and render it; every other
// field passes through untouched via `serde_json::Value`.
//
// Rejection strategy matches the TS side:
//   - load path (pick_valid): drop the bad row, log the reason, keep
//     the rest so a partially-corrupt file still boots the app
//   - save path (warn_invalid, in data.rs): log only, never drop —
//     losing user data because a row failed a schema check is worse
//     than persisting a shape the load path will complain about next
//     boot
//
// The shim structs (`ItemMinimal`, etc.) only exist to drive serde's
// deserializer as a validator. The returned `serde_json::Value` is the
// original untouched row — we just PROVE it parses.

use serde::Deserialize;
use serde_json::Value;

// -- Shim structs (deliberately minimal) ----------------------------

#[derive(Deserialize)]
#[allow(dead_code)]  // fields exist only to force serde to require them
struct ItemMinimal {
    id: String,
    #[serde(rename = "categoryId")]
    category_id: String,
    title: String,
    #[serde(rename = "createdAt")]
    created_at: f64,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct CollectionMinimal {
    id: String,
    name: String,
    #[serde(rename = "categoryId")]
    category_id: String,
    #[serde(rename = "itemIds")]
    item_ids: Vec<String>,
    #[serde(rename = "createdAt")]
    created_at: f64,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct MusicArtistMinimal {
    id: String,
    name: String,
    #[serde(rename = "createdAt")]
    created_at: f64,
}

#[derive(Deserialize)]
#[allow(dead_code)]
struct ArcadeGameMinimal {
    id: String,
    title: String,
    #[serde(rename = "type")]
    arcade_type: ArcadeType,
}

#[derive(Deserialize)]
#[allow(dead_code)]
#[serde(rename_all = "lowercase")]
enum ArcadeType {
    Grid,
    Score,
}

// -- Validators ------------------------------------------------------
//
// Each `validate_*` returns `Result<(), String>` where the error is a
// human-readable reason for the reject log. Called from pick_valid or
// warn_invalid depending on the direction.

pub fn validate_item(v: &Value) -> Result<(), String> {
    validate::<ItemMinimal>(v)
}

pub fn validate_collection(v: &Value) -> Result<(), String> {
    validate::<CollectionMinimal>(v)
}

pub fn validate_music_artist(v: &Value) -> Result<(), String> {
    validate::<MusicArtistMinimal>(v)
}

pub fn validate_arcade_game(v: &Value) -> Result<(), String> {
    validate::<ArcadeGameMinimal>(v)
}

// customOrders is a `Record<categoryId, string[]>` — a per-category
// list of item ids the user hand-sorted. Just checks the outer shape.
pub fn validate_custom_orders(v: &Value) -> Result<(), String> {
    let obj = v.as_object().ok_or_else(|| format!("expected object, got {}", describe(v)))?;
    for (k, arr) in obj {
        let arr = arr
            .as_array()
            .ok_or_else(|| format!("value at {k:?} must be array"))?;
        for (i, id) in arr.iter().enumerate() {
            if !id.is_string() {
                return Err(format!("{k}[{i}] is not a string"));
            }
        }
    }
    Ok(())
}

// Settings has ~40 fields, most of them user prefs that evolve
// release-to-release. Loose object; the only true corruption we care
// about is "not an object at all".
pub fn validate_settings(v: &Value) -> Result<(), String> {
    if v.is_object() {
        Ok(())
    } else {
        Err(format!("expected object, got {}", describe(v)))
    }
}

// -- Helpers --------------------------------------------------------

fn validate<T: for<'de> Deserialize<'de>>(v: &Value) -> Result<(), String> {
    // `serde_json::from_value` takes ownership; the row here is
    // often large so we clone. `try_from` on Value would avoid it
    // but the deserializer wants an owned Value.
    serde_json::from_value::<T>(v.clone()).map(|_| ()).map_err(|e| e.to_string())
}

fn describe(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "bool",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

// pick_valid: filter an array of Values down to the ones that pass
// `validate`. Bad rows are dropped and logged. Callers can measure
// impact via the difference between input len and output len.
pub fn pick_valid<F>(raw: &Value, validator: F, label: &str) -> Vec<Value>
where
    F: Fn(&Value) -> Result<(), String>,
{
    let arr = match raw.as_array() {
        Some(a) => a,
        None => {
            eprintln!("[schema] {label}: expected array, got {}", describe(raw));
            return Vec::new();
        }
    };
    let mut out = Vec::with_capacity(arr.len());
    for (i, row) in arr.iter().enumerate() {
        match validator(row) {
            Ok(()) => out.push(row.clone()),
            Err(e) => {
                eprintln!("[schema] dropped invalid row {label}[{i}]: {e}");
            }
        }
    }
    out
}

// parse_or: validate a singleton value; return it unchanged on
// success, or the fallback on failure. Used for settings /
// customOrders.
pub fn parse_or<F>(raw: &Value, validator: F, fallback: Value, label: &str) -> Value
where
    F: Fn(&Value) -> Result<(), String>,
{
    match validator(raw) {
        Ok(()) => raw.clone(),
        Err(e) => {
            eprintln!("[schema] {label}: {e}");
            fallback
        }
    }
}

// warn_invalid: iterate an array and log every row that would fail
// validation. Never drops — used on the save path where losing data
// is worse than persisting an odd shape.
pub fn warn_invalid<F>(raw: &Value, validator: F, label: &str)
where
    F: Fn(&Value) -> Result<(), String>,
{
    let Some(arr) = raw.as_array() else { return };
    for (i, row) in arr.iter().enumerate() {
        if let Err(e) = validator(row) {
            eprintln!("[schema] save: {label}[{i}] would fail validation: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn valid_item_passes() {
        let v = json!({
            "id": "abc", "categoryId": "videojuegos",
            "title": "X", "createdAt": 1_700_000_000,
            "devs": ["Some"], "notes": "hi",  // passthrough
        });
        assert!(validate_item(&v).is_ok());
    }

    #[test]
    fn missing_id_rejected() {
        let v = json!({ "categoryId": "v", "title": "X", "createdAt": 1 });
        assert!(validate_item(&v).is_err());
    }

    #[test]
    fn wrong_type_rejected() {
        let v = json!({
            "id": "a", "categoryId": "v", "title": "X",
            "createdAt": "not-a-number",
        });
        assert!(validate_item(&v).is_err());
    }

    #[test]
    fn pick_valid_drops_bad_keeps_good() {
        let raw = json!([
            { "id": "a", "categoryId": "v", "title": "X", "createdAt": 1 },
            { "id": "b" },  // missing categoryId+title+createdAt
            { "id": "c", "categoryId": "v", "title": "Y", "createdAt": 2 },
        ]);
        let out = pick_valid(&raw, validate_item, "test");
        assert_eq!(out.len(), 2);
    }

    #[test]
    fn parse_or_returns_fallback_on_failure() {
        let out = parse_or(&json!("nope"), validate_settings, json!({}), "test");
        assert_eq!(out, json!({}));
    }
}
