<template>
  <n-config-provider
    :theme="lightTheme"
    class="h-full flex flex-col box-border"
    :class="{
      'bg-cover bg-center bg-no-repeat': props.backgroundImage
    }"
    :style="mergedStyle">
    <!-- 顶部安全区域 -->
    <div :class="[{ 'safe-area-top': safeAreaTop }, props.topSafeAreaClass]" />

    <!-- 内容区域 -->
    <div class="flex-1 min-h-0">
      <slot></slot>
    </div>

    <!-- 底部安全区域 -->
    <div :class="[{ 'safe-area-bottom': safeAreaBottom }, props.bottomSafeAreaClass]" />
  </n-config-provider>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MsgEnum, NotificationTypeEnum, TauriCommand } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import type { MessageType } from '@/services/types'
import { WsResponseMessageType } from '@/services/wsType'
import { useChatStore } from '@/stores/chat'
import { useFileStore } from '@/stores/file'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { audioManager } from '@/utils/AudioManager'
import { isAndroid, isMobile, isWindows } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { showAndroidNotification, startAndroidBackgroundService, getLaunchIntentData, clearLaunchIntentData } from '@/utils/androidNotification'
import { useRoute, useRouter } from 'vue-router'
import { lightTheme } from 'naive-ui'
import { onMounted } from 'vue'
interface MobileLayoutProps {
  /** 是否应用顶部安全区域 */
  safeAreaTop?: boolean
  /** 是否应用底部安全区域 */
  safeAreaBottom?: boolean
  /** 背景图片URL */
  backgroundImage?: string
  /** 顶部安全区域的自定义 CSS class */
  topSafeAreaClass?: string
  /** 底部安全区域的自定义 CSS class */
  bottomSafeAreaClass?: string
}

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const fileStore = useFileStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const userUid = computed(() => userStore.userInfo!.uid)
const playMessageSound = async () => {
  // 检查是否开启了消息提示音
  if (!settingStore.notification?.messageSound) {
    return
  }

  try {
    const audio = new Audio('/sound/message.mp3')
    await audioManager.play(audio, 'message-notification')
  } catch (error) {
    console.warn('播放消息音效失败:', error)
  }
}

const props = withDefaults(defineProps<MobileLayoutProps>(), {
  safeAreaTop: true,
  safeAreaBottom: true,
  backgroundImage: '',
  topSafeAreaClass: '',
  bottomSafeAreaClass: ''
})

// 计算背景图样式
const backgroundImageStyle = computed(() => {
  const styles: Record<string, string> = {}

  // 设置背景图片
  if (props.backgroundImage) {
    // 处理路径别名 @/ 转换为 /src/
    let imagePath = props.backgroundImage
    if (imagePath.startsWith('@/')) {
      imagePath = imagePath.replace('@/', '/src/')
    }
    styles.backgroundImage = `url(${imagePath})`
  }
  return styles
})

const mergedStyle = computed(() => ({
  backgroundColor: 'var(--center-bg-color)',
  ...backgroundImageStyle.value
}))

/**
 * 从消息中提取文件信息并添加到 file store
 */
const addFileToStore = (data: MessageType) => {
  const { message } = data
  const { type, body, roomId, id } = message

  // 只处理图片和视频类型
  if (type !== MsgEnum.IMAGE && type !== MsgEnum.VIDEO) {
    return
  }

  // 提取文件信息
  const fileUrl = body.url
  if (!fileUrl) {
    return
  }

  // 从 URL 中提取文件名
  let fileName = ''
  try {
    const urlObj = new URL(fileUrl)
    const pathname = urlObj.pathname
    fileName = pathname.substring(pathname.lastIndexOf('/') + 1)
  } catch (e) {
    // 如果不是有效的 URL，直接使用消息 ID 作为文件名
    fileName = `${id}.${type === MsgEnum.IMAGE ? 'jpg' : 'mp4'}`
  }

  // 从文件名中提取后缀
  const suffix = fileName.includes('.')
    ? fileName.substring(fileName.lastIndexOf('.') + 1)
    : type === MsgEnum.IMAGE
      ? 'jpg'
      : 'mp4'

  // 确定 MIME 类型
  let mimeType = ''
  if (type === MsgEnum.IMAGE) {
    mimeType = `image/${suffix === 'jpg' ? 'jpeg' : suffix}`
  } else if (type === MsgEnum.VIDEO) {
    mimeType = `video/${suffix}`
  }

  // 添加到 file store
  fileStore.addFile({
    id,
    roomId,
    fileName,
    type: type === MsgEnum.IMAGE ? 'image' : 'video',
    url: fileUrl,
    suffix,
    mimeType
  })
}

/** 处理收到的消息 */
useMitt.on(WsResponseMessageType.RECEIVE_MESSAGE, async (data: MessageType) => {
  if (chatStore.checkMsgExist(data.message.roomId, data.message.id)) {
    return
  }
  console.log('[mobile/layout] 收到的消息：', data)
  // 只有在聊天室页面且当前选中的会话就是消息来源的会话时，才不增加未读数
  chatStore.pushMsg(data, {
    isActiveChatView:
      route.path.startsWith('/mobile/chatRoom') && globalStore.currentSessionRoomId === data.message.roomId,
    activeRoomId: globalStore.currentSessionRoomId || ''
  })
  data.message.sendTime = new Date(data.message.sendTime).getTime()
  await invokeSilently(TauriCommand.SAVE_MSG, {
    data
  })

  // 如果是图片或视频消息，添加到 file store
  addFileToStore(data)
  if (data.fromUser.uid !== userUid.value) {
    // 获取该消息的会话信息
    const session = chatStore.sessionList.find((s) => s.roomId === data.message.roomId)

    // 只有非免打扰的会话才发送通知和触发图标闪烁
    if (session && session.muteNotification !== NotificationTypeEnum.NOT_DISTURB) {
      let shouldPlaySound = isMobile()

      if (!isMobile()) {
        try {
          const home = await WebviewWindow.getByLabel('mobile-home')

          if (home) {
            const isVisible = await home.isVisible()
            const isMinimized = await home.isMinimized()
            const isFocused = await home.isFocused()

            // 如果窗口不可见、被最小化或未聚焦，则播放音效
            shouldPlaySound = !isVisible || isMinimized || !isFocused
          } else {
            // 如果找不到home 窗口，播放音效
            shouldPlaySound = true
          }
        } catch (error) {
          console.warn('检查窗口状态失败:', error)
          // 如果检查失败，默认播放音效
          shouldPlaySound = true
        }
      }

      // 播放消息音效
      if (shouldPlaySound) {
        await playMessageSound()
      }

      // 设置图标闪烁
      // useMitt.emit(MittEnum.MESSAGE_ANIMATION, data)
      // session.unreadCount++
      // 在windows系统下才发送通知
      if (!isMobile() && isWindows()) {
        globalStore.setTipVisible(true)
      }

      if (!isMobile()) {
        const currentWindow = WebviewWindow.getCurrent()

        if (currentWindow.label === 'mobile-home') {
          await emitTo('notify', 'notify_content', data)
        }
      }

      // Android平台：如果应用不在前台，显示通知
      if (isAndroid() && isMobile()) {
        try {
          const currentWindow = WebviewWindow.getCurrent()
          if (currentWindow) {
            const isVisible = await currentWindow.isVisible()
            const isFocused = await currentWindow.isFocused()

            // 如果窗口不可见或未聚焦，显示通知
            if (!isVisible || !isFocused) {
              // 生成通知ID（使用roomId的hash值确保同一会话使用相同ID）
              const notificationId = Math.abs(
                data.message.roomId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
              ) % 2147483647

              // 构建通知内容
              const messageContent = getMessagePreview(data)
              const senderName = data.fromUser.name || data.fromUser.uid || '未知用户'

              await showAndroidNotification({
                title: senderName,
                body: messageContent,
                roomId: data.message.roomId,
                fromUser: data.fromUser.uid,
                notificationId
              })
            }
          } else {
            // 如果无法获取窗口，默认显示通知
            const notificationId = Math.abs(
              data.message.roomId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            ) % 2147483647
            const messageContent = getMessagePreview(data)
            const senderName = data.fromUser.name || data.fromUser.uid || '未知用户'

            await showAndroidNotification({
              title: senderName,
              body: messageContent,
              roomId: data.message.roomId,
              fromUser: data.fromUser.uid,
              notificationId
            })
          }
        } catch (error) {
          console.warn('显示Android通知失败:', error)
        }
      }
    }
  }

  await globalStore.updateGlobalUnreadCount()
})

/**
 * 获取消息预览文本
 */
const getMessagePreview = (data: MessageType): string => {
  const { message } = data
  const { type, body } = message

  switch (type) {
    case MsgEnum.TEXT:
      return body.content || '[文本消息]'
    case MsgEnum.IMAGE:
      return '[图片]'
    case MsgEnum.VIDEO:
      return '[视频]'
    case MsgEnum.FILE:
      return `[文件] ${body.fileName || '未知文件'}`
    case MsgEnum.AUDIO:
      return '[语音]'
    case MsgEnum.EMOJI:
      return '[表情]'
    default:
      return '[消息]'
  }
}

// 应用启动时启动后台服务和检查通知点击
onMounted(async () => {
  if (isAndroid() && isMobile()) {
    try {
      await startAndroidBackgroundService()
      console.log('Android后台服务已启动')
    } catch (error) {
      console.warn('启动Android后台服务失败:', error)
    }

    // 检查是否有来自通知的Intent参数
    try {
      const intentData = await getLaunchIntentData()
      if (intentData?.hasData && intentData.action === 'open_chat' && intentData.roomId) {
        // 延迟一下确保路由已初始化
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // 跳转到对应的聊天页面
        router.push({
          path: '/mobile/chatRoom',
          query: {
            roomId: intentData.roomId
          }
        })
        
        // 清除Intent数据，避免重复处理
        await clearLaunchIntentData()
      }
    } catch (error) {
      console.warn('检查Intent参数失败:', error)
    }
  }
})
</script>

<style scoped lang="scss">
.safe-area-top {
  padding-top: var(--safe-area-inset-top);
}
.safe-area-bottom {
  padding-bottom: var(--safe-area-inset-bottom);
}
</style>
