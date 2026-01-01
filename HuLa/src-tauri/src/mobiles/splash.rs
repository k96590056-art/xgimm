#[cfg(target_os = "ios")]
mod platform {
    unsafe extern "C" {
        fn hula_show_splashscreen();
        fn hula_hide_splashscreen();
    }

    pub fn show() {
        unsafe { hula_show_splashscreen() };
    }

    pub fn hide() {
        unsafe { hula_hide_splashscreen() };
    }
}

// Android: 暂时禁用 splash screen JNI 调用，防止崩溃
// 原因：JNI call_method 在 x86 模拟器上可能 panic，即使有错误处理
// TODO: 后续可以用 Tauri 官方的 splash screen 插件替代
#[cfg(target_os = "android")]
mod platform {
    pub fn show() {
        tracing::info!("[Splashscreen] Android show() - skipped (JNI disabled)");
    }

    pub fn hide() {
        tracing::info!("[Splashscreen] Android hide() - skipped (JNI disabled)");
    }
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod platform {
    pub fn show() {}
    pub fn hide() {}
}

pub fn show() {
    platform::show();
}

pub fn hide() {
    platform::hide();
}

/// Tauri command: 隐藏启动画面（由前端调用）
#[tauri::command]
pub fn hide_splash_screen() -> Result<(), String> {
    tracing::info!("hide_splash_screen called from frontend");
    hide();
    Ok(())
}
