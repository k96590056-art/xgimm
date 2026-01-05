#[cfg(target_os = "android")]
mod platform {
    use tauri::AppHandle;
    use jni::objects::{JClass, JObject, JValue};

    pub fn show_message_notification(
        _app_handle: AppHandle,
        sender_name: String,
        message_content: String,
        room_id: Option<String>,
    ) -> Result<(), String> {
        // 使用 ndk_context 获取 Android 上下文
        let ctx = ndk_context::android_context();
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }
            .map_err(|e| format!("Failed to get JavaVM: {}", e))?;
        let activity = unsafe { JObject::from_raw(ctx.context().cast()) };

        // 附加当前线程到 JVM
        let mut env = vm.attach_current_thread()
            .map_err(|e| format!("Failed to attach thread to JVM: {}", e))?;

        let helper_class: JClass = env
            .find_class("com/xgimm/www/MessageNotificationHelper")
            .map_err(|e| format!("Failed to find MessageNotificationHelper class: {}", e))?;

        let sender_name_jstr = env
            .new_string(&sender_name)
            .map_err(|e| format!("Failed to create sender name string: {}", e))?;
        let message_content_jstr = env
            .new_string(&message_content)
            .map_err(|e| format!("Failed to create message content string: {}", e))?;
        let room_id_str = room_id.unwrap_or_default();
        let room_id_jstr = env
            .new_string(&room_id_str)
            .map_err(|e| format!("Failed to create room id string: {}", e))?;

        env.call_static_method(
            helper_class,
            "showNotification",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V",
            &[
                JValue::Object(&activity),
                JValue::Object(&sender_name_jstr),
                JValue::Object(&message_content_jstr),
                JValue::Object(&room_id_jstr),
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

