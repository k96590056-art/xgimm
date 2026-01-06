#[cfg(target_os = "android")]
mod platform {
    use tauri::AppHandle;
    use jni::objects::{JClass, JObject, JValue};

    pub fn start_keep_alive(_app_handle: AppHandle) -> Result<(), String> {
        // 使用 ndk_context 获取 Android 上下文
        let ctx = ndk_context::android_context();
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }
            .map_err(|e| format!("Failed to get JavaVM: {}", e))?;
        let activity = unsafe { JObject::from_raw(ctx.context().cast()) };

        // 附加当前线程到 JVM
        let mut env = vm.attach_current_thread()
            .map_err(|e| format!("Failed to attach thread to JVM: {}", e))?;

        // 查找 KeepAliveService 类
        let service_class: JClass = env
            .find_class("com/xgimm/www/KeepAliveService")
            .map_err(|e| format!("Failed to find KeepAliveService class: {}", e))?;

        // 获取 Companion 对象
        let companion_field = env
            .get_static_field(&service_class, "Companion", "Lcom/xgimm/www/KeepAliveService$Companion;")
            .map_err(|e| format!("Failed to get Companion field: {}", e))?;

        let companion_obj = companion_field.l()
            .map_err(|e| format!("Failed to get Companion object: {}", e))?;

        // 调用 Companion.startService(context)
        env.call_method(
            &companion_obj,
            "startService",
            "(Landroid/content/Context;)V",
            &[JValue::Object(&activity)],
        )
        .map_err(|e| format!("Failed to call startService: {}", e))?;

        tracing::info!("[KeepAlive] Android foreground service started");
        Ok(())
    }

    pub fn stop_keep_alive(_app_handle: AppHandle) -> Result<(), String> {
        // 使用 ndk_context 获取 Android 上下文
        let ctx = ndk_context::android_context();
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }
            .map_err(|e| format!("Failed to get JavaVM: {}", e))?;
        let activity = unsafe { JObject::from_raw(ctx.context().cast()) };

        // 附加当前线程到 JVM
        let mut env = vm.attach_current_thread()
            .map_err(|e| format!("Failed to attach thread to JVM: {}", e))?;

        // 查找 KeepAliveService 类
        let service_class: JClass = env
            .find_class("com/xgimm/www/KeepAliveService")
            .map_err(|e| format!("Failed to find KeepAliveService class: {}", e))?;

        // 获取 Companion 对象
        let companion_field = env
            .get_static_field(&service_class, "Companion", "Lcom/xgimm/www/KeepAliveService$Companion;")
            .map_err(|e| format!("Failed to get Companion field: {}", e))?;

        let companion_obj = companion_field.l()
            .map_err(|e| format!("Failed to get Companion object: {}", e))?;

        // 调用 Companion.stopService(context)
        env.call_method(
            &companion_obj,
            "stopService",
            "(Landroid/content/Context;)V",
            &[JValue::Object(&activity)],
        )
        .map_err(|e| format!("Failed to call stopService: {}", e))?;

        tracing::info!("[KeepAlive] Android foreground service stopped");
        Ok(())
    }
}

#[cfg(not(target_os = "android"))]
mod platform {
    use tauri::AppHandle;

    pub fn start_keep_alive(_app_handle: AppHandle) -> Result<(), String> {
        Ok(())
    }

    pub fn stop_keep_alive(_app_handle: AppHandle) -> Result<(), String> {
        Ok(())
    }
}

use tauri::AppHandle;

/// 启动保活服务
pub fn start_keep_alive(app_handle: AppHandle) -> Result<(), String> {
    platform::start_keep_alive(app_handle)
}

/// 停止保活服务
pub fn stop_keep_alive(app_handle: AppHandle) -> Result<(), String> {
    platform::stop_keep_alive(app_handle)
}

/// Tauri 命令: 启动保活服务
#[tauri::command]
pub fn start_keep_alive_service(app_handle: AppHandle) -> Result<(), String> {
    start_keep_alive(app_handle)
}

/// Tauri 命令: 停止保活服务
#[tauri::command]
pub fn stop_keep_alive_service(app_handle: AppHandle) -> Result<(), String> {
    stop_keep_alive(app_handle)
}
