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

        // 直接调用 KeepAliveService.startService，避免通过 KeepAliveHelper
        let service_class = env
            .find_class("com/xgimm/www/KeepAliveService")
            .map_err(|e| format!("Failed to find KeepAliveService class: {}", e))?;

        let method_id = env
            .get_static_method_id(
                service_class,
                "startService",
                "(Landroid/content/Context;)V",
            )
            .map_err(|e| format!("Failed to find startService method: {}", e))?;

        let context = JObject::from(activity);
        env.call_static_method(
            service_class,
            method_id,
            &[context.into()],
        )
        .map_err(|e| format!("Failed to call startService: {}", e))?;

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

        // 直接调用 KeepAliveService.stopService，避免通过 KeepAliveHelper
        let service_class = env
            .find_class("com/xgimm/www/KeepAliveService")
            .map_err(|e| format!("Failed to find KeepAliveService class: {}", e))?;

        let method_id = env
            .get_static_method_id(
                service_class,
                "stopService",
                "(Landroid/content/Context;)V",
            )
            .map_err(|e| format!("Failed to find stopService method: {}", e))?;

        let context = JObject::from(activity);
        env.call_static_method(
            service_class,
            method_id,
            &[context.into()],
        )
        .map_err(|e| format!("Failed to call stopService: {}", e))?;

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

