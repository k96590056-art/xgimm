#[cfg(target_os = "ios")]
pub mod ios;

pub mod splash;

#[cfg(target_os = "android")]
pub mod keep_alive;

#[cfg(mobile)]
pub mod notification;

#[cfg(mobile)]
pub mod notification_helper;

#[cfg(target_os = "ios")]
pub mod keyboard;

// 移动端初始化 - 实现 CustomInit trait
pub mod init;

