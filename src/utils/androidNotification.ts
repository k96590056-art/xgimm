import { invoke } from '@tauri-apps/api/core'
import { isAndroid } from './PlatformConstants'
import { invokeSilently } from './TauriInvokeHandler'

/**
 * 显示Android通知
 */
export async function showAndroidNotification(options: {
  title?: string
  body?: string
  roomId?: string
  fromUser?: string
  notificationId?: number
}): Promise<void> {
  if (!isAndroid()) {
    return
  }

  try {
    await invokeSilently('plugin:hula|show_notification', {
      title: options.title,
      body: options.body,
      roomId: options.roomId,
      fromUser: options.fromUser,
      notificationId: options.notificationId || Date.now() % 2147483647 // 使用时间戳作为通知ID，确保在int范围内
    })
  } catch (error) {
    console.error('显示Android通知失败:', error)
  }
}

/**
 * 取消Android通知
 */
export async function cancelAndroidNotification(notificationId: number): Promise<void> {
  if (!isAndroid()) {
    return
  }

  try {
    await invokeSilently('plugin:hula|cancel_notification', {
      notificationId
    })
  } catch (error) {
    console.error('取消Android通知失败:', error)
  }
}

/**
 * 启动Android后台服务
 */
export async function startAndroidBackgroundService(): Promise<void> {
  if (!isAndroid()) {
    return
  }

  try {
    await invokeSilently('plugin:hula|start_background_service')
  } catch (error) {
    console.error('启动Android后台服务失败:', error)
  }
}

/**
 * 停止Android后台服务
 */
export async function stopAndroidBackgroundService(): Promise<void> {
  if (!isAndroid()) {
    return
  }

  try {
    await invokeSilently('plugin:hula|stop_background_service')
  } catch (error) {
    console.error('停止Android后台服务失败:', error)
  }
}

/**
 * 获取启动Intent数据（用于处理通知点击）
 */
export async function getLaunchIntentData(): Promise<{
  roomId?: string
  fromUser?: string
  action?: string
  hasData: boolean
} | null> {
  if (!isAndroid()) {
    return null
  }

  try {
    return await invokeSilently('plugin:hula|get_launch_intent_data')
  } catch (error) {
    console.error('获取启动Intent数据失败:', error)
    return null
  }
}

/**
 * 清除启动Intent数据
 */
export async function clearLaunchIntentData(): Promise<void> {
  if (!isAndroid()) {
    return
  }

  try {
    await invokeSilently('plugin:hula|clear_launch_intent_data')
  } catch (error) {
    console.error('清除启动Intent数据失败:', error)
  }
}

