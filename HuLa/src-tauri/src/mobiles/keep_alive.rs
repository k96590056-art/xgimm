#[cfg(target_os = "android")]
mod platform {
    use tauri::AppHandle;
    use jni::JNIEnv;
    use jni::objects::JObject;
    
    pub fn start_keep_alive(app_handle: AppHandle) -> Result<(), String> {
        // 获取 Android Activity
        let activity = app_handle
            .activity()
            .ok_or("Failed to get Android Activity")?;
        
        // 获取 JNI 环境
        let env = app_handle
            .env()
            .map_err(|e| format!("Failed to get JNI environment: {}", e))?;

        // 调用 KeepAliveHelper.startKeepAlive
        let helper_class = env
            .find_class("com/xgimm/www/KeepAliveHelper")
            .map_err(|e| format!("Failed to find KeepAliveHelper class: {}", e))?;

        let method_id = env
            .get_static_method_id(
                helper_class,
                "startKeepAlive",
                "(Landroid/content/Context;)V",
            )
            .map_err(|e| format!("Failed to find startKeepAlive method: {}", e))?;

        let context = JObject::from(activity);
        env.call_static_method(
            helper_class,
            method_id,
            &[context.into()],
        )
        .map_err(|e| format!("Failed to call startKeepAlive: {}", e))?;

        tracing::info!("Keep alive service started");
        Ok(())
    }

    pub fn stop_keep_alive(app_handle: AppHandle) -> Result<(), String> {
        let activity = app_handle
            .activity()
            .ok_or("Failed to get Android Activity")?;
        
        let env = app_handle
            .env()
            .map_err(|e| format!("Failed to get JNI environment: {}", e))?;

        let helper_class = env
            .find_class("com/xgimm/www/KeepAliveHelper")
            .map_err(|e| format!("Failed to find KeepAliveHelper class: {}", e))?;

        let method_id = env
            .get_static_method_id(
                helper_class,
                "stopKeepAlive",
                "(Landroid/content/Context;)V",
            )
            .map_err(|e| format!("Failed to find stopKeepAlive method: {}", e))?;

        let context = JObject::from(activity);
        env.call_static_method(
            helper_class,
            method_id,
            &[context.into()],
        )
        .map_err(|e| format!("Failed to call stopKeepAlive: {}", e))?;

        tracing::info!("Keep alive service stopped");
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

