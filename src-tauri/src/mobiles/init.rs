use crate::common::init::{CustomInit, init_common_plugins};
use tauri::Runtime;

impl<R: Runtime> CustomInit for tauri::Builder<R> {
    // 初始化插件
    fn init_plugin(self) -> Self {
        let builder = init_common_plugins(self);

        // iOS 移动端特有的插件
        #[cfg(target_os = "ios")]
        let builder = builder
            .plugin(tauri_plugin_safe_area_insets::init())
            .plugin(tauri_plugin_hula::init())
            .plugin(tauri_plugin_barcode_scanner::init());

        // Android 移动端特有的插件
        // 注意：在 x86_64 模拟器上，一些插件可能导致崩溃
        // 暂时禁用 tauri_plugin_hula 和 barcode_scanner 进行测试
        #[cfg(target_os = "android")]
        let builder = builder
            .plugin(tauri_plugin_safe_area_insets::init())
            .plugin(tauri_plugin_hula::init());
        // TODO: 在真机上测试后，再启用这些插件
        // .plugin(tauri_plugin_barcode_scanner::init());

        builder
    }
}
