# 消息通知功能使用说明

## 功能概述

当应用在后台时收到新消息，系统会自动弹出通知显示消息来源和内容。

## 已实现的功能

### 1. Android 通知
- ✅ 创建了消息通知服务 (`MessageNotificationService.kt`)
- ✅ 通知显示发送者名称和消息内容
- ✅ 点击通知可以打开应用
- ✅ 支持通知渠道（Android 8.0+）
- ✅ 支持声音和震动

### 2. Rust 集成
- ✅ 创建了通知模块 (`notification.rs`)
- ✅ 提供了 Tauri 命令接口
- ✅ 支持检查应用后台状态

## 使用方法

### 方法 1: 在收到消息时直接调用（推荐）

在 WebSocket 消息处理或消息保存的地方调用：

```rust
use crate::mobiles::notification_helper::notify_if_background;

// 当收到新消息时
async fn handle_new_message(
    app_handle: AppHandle,
    sender_name: String,
    message_content: String,
    room_id: Option<String>,
) {
    // 检查应用是否在后台，如果是则显示通知
    if let Err(e) = notify_if_background(
        app_handle,
        sender_name,
        message_content,
        room_id,
    ).await {
        tracing::error!("Failed to show notification: {}", e);
    }
}
```

### 方法 2: 通过 Tauri 命令从前端调用

前端可以在收到消息时调用：

```javascript
import { invoke } from '@tauri-apps/api/core';

// 当收到新消息时
async function onNewMessage(senderName, messageContent, roomId) {
  try {
    await invoke('show_message_notification_command', {
      senderName: senderName,
      messageContent: messageContent,
      roomId: roomId || null
    });
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}
```

### 方法 3: 在 WebSocket 客户端中集成

在 WebSocket 客户端的消息接收处理中添加：

```rust
// 在 WebSocketClient 的 on_message 回调中
fn on_message_received(
    app_handle: AppHandle,
    message: Message,
) {
    // 检查应用是否在后台
    let is_background = !app_handle
        .webview_windows()
        .values()
        .any(|w| w.is_visible().unwrap_or(false));
    
    if is_background {
        // 显示通知
        if let Err(e) = crate::mobiles::notification::show_message_notification(
            app_handle.clone(),
            message.sender_name,
            message.content,
            Some(message.room_id),
        ) {
            tracing::error!("Failed to show notification: {}", e);
        }
    }
}
```

## 通知内容

- **标题**: 发送者名称（sender_name）
- **内容**: 消息内容（message_content）
- **点击行为**: 打开应用，如果提供了 room_id，可以跳转到对应聊天室

## 注意事项

1. **Android 权限**: 确保应用已获得通知权限（Android 13+ 需要用户授权）
2. **后台状态检测**: 通知只在应用后台时显示，避免干扰用户
3. **消息内容处理**: 建议对消息内容进行适当处理（如截断过长内容）
4. **免打扰设置**: 可以检查用户的免打扰设置，决定是否显示通知

## 待完善功能

- [ ] iOS 通知实现
- [ ] 桌面端系统通知
- [ ] 通知点击跳转到具体聊天室
- [ ] 支持消息类型（文本、图片、文件等）的图标显示
- [ ] 支持通知分组（同一发送者的多条消息合并显示）

## 文件位置

- Android 通知服务: `src-tauri/android/app/src/main/java/com/xgimm/www/MessageNotificationService.kt`
- Rust 通知模块: `src-tauri/src/mobiles/notification.rs`
- 通知辅助函数: `src-tauri/src/mobiles/notification_helper.rs`

