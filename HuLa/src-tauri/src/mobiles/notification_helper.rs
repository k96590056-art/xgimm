use tauri::{AppHandle, Manager};
use crate::mobiles::notification::show_message_notification;

/// 检查应用是否在后台，如果是则显示通知
pub async fn notify_if_background(
    app_handle: AppHandle,
    sender_name: String,
    message_content: String,
    room_id: Option<String>,
) -> Result<(), String> {
    // 检查应用是否在后台
    let is_background = {
        #[cfg(mobile)]
        {
            // 检查是否有可见的窗口
            let has_visible_window = app_handle
                .webview_windows()
                .values()
                .any(|window| window.is_visible().unwrap_or(false));
            !has_visible_window
        }
        #[cfg(not(mobile))]
        {
            // 桌面端检查窗口是否最小化或不在前台
            let has_focused_window = app_handle
                .webview_windows()
                .values()
                .any(|window| {
                    window.is_focused().unwrap_or(false) || window.is_visible().unwrap_or(false)
                });
            !has_focused_window
        }
    };

    // 如果应用在后台，显示通知
    if is_background {
        tracing::info!(
            "App is in background, showing notification: {} - {}",
            sender_name,
            message_content
        );
        show_message_notification(app_handle, sender_name, message_content, room_id)?;
    } else {
        tracing::debug!("App is in foreground, skipping notification");
    }

    Ok(())
}

