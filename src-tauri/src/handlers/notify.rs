// Native desktop notifications (Windows toast, macOS Notification Center,
// libnotify on Linux).

use tauri::{command, AppHandle};
use tauri_plugin_notification::NotificationExt;

#[command]
pub fn notify_desktop(app: AppHandle, title: String, body: String) -> bool {
    app.notification().builder().title(title).body(body).show().is_ok()
}
