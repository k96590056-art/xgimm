#[cfg(target_os = "android")]
mod platform {
    use tauri::AppHandle;
    use jni::objects::JObject;

    pub fn show_message_notification(
        app_handle: AppHandle,
        sender_name: String,
        message_content: String,
        room_id: Option<String>,
    ) -> Result<(), String> {
        let activity = app_handle
            .activity()
            .ok_or("Failed to get Android Activity")?;

        let env = app_handle
            .env()
            .map_err(|e| format!("Failed to get JNI environment: {}", e))?;

        let helper_class = env
            .find_class("com/xgimm/www/MessageNotificationHelper")
            .map_err(|e| format!("Failed to find MessageNotificationHelper class: {}", e))?;

        let method_id = env
            .get_static_method_id(
                helper_class,
                "showNotification",
                "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V",
            )
            .map_err(|e| format!("Failed to find showNotification method: {}", e))?;

        let context = JObject::from(activity);
        let sender_name_jstr = env
            .new_string(&sender_name)
            .map_err(|e| format!("Failed to create sender name string: {}", e))?;
        let message_content_jstr = env
            .new_string(&message_content)
            .map_err(|e| format!("Failed to create message content string: {}", e))?;
        let room_id_jstr = if let Some(rid) = room_id {
            env.new_string(&rid)
                .map_err(|e| format!("Failed to create room id string: {}", e))?
        } else {
            env.new_string("")
                .map_err(|e| format!("Failed to create empty room id string: {}", e))?
        };

        env.call_static_method(
            helper_class,
            method_id,
            &[
                context.into(),
                sender_name_jstr.into(),
                message_content_jstr.into(),
                room_id_jstr.into(),
            ],
        )
        .map_err(|e| format!("Failed to call showNotification: {}", e))?;

        tracing::info!("Message notification shown: {} - {}", sender_name, message_content);
        Ok(())
    }
}

#[cfg(target_os = "ios")]
mod platform {
    use tauri::AppHandle;

    pub fn show_message_notification(
        _app_handle: AppHandle,
        sender_name: String,
        message_content: String,
        _room_id: Option<String>,
    ) -> Result<(), String> {
        // iOS 通知实现
        // TODO: 实现 iOS 通知
        tracing::info!("iOS notification: {} - {}", sender_name, message_content);
        Ok(())
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod platform {
    use tauri::AppHandle;

    pub fn show_message_notification(
        _app_handle: AppHandle,
        sender_name: String,
        message_content: String,
        _room_id: Option<String>,
    ) -> Result<(), String> {
        // 桌面端可以使用系统通知
        tracing::info!("Desktop notification: {} - {}", sender_name, message_content);
        Ok(())
    }
}

use tauri::AppHandle;

/// 显示消息通知
pub fn show_message_notification(
    app_handle: AppHandle,
    sender_name: String,
    message_content: String,
    room_id: Option<String>,
) -> Result<(), String> {
    platform::show_message_notification(app_handle, sender_name, message_content, room_id)
}

/// Tauri 命令: 显示消息通知
#[tauri::command]
pub fn show_message_notification_command(
    app_handle: AppHandle,
    sender_name: String,
    message_content: String,
    room_id: Option<String>,
) -> Result<(), String> {
    show_message_notification(app_handle, sender_name, message_content, room_id)
}

