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
import { MSG_REPLY_TEXT_MAP } from '@/common/message'
import { useMitt } from '@/hooks/useMitt'
import type { MessageType } from '@/services/types'
import { WsResponseMessageType } from '@/services/wsType'
import { useChatStore } from '@/stores/chat'
import { useFileStore } from '@/stores/file'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { audioManager } from '@/utils/AudioManager'
import { isMobile, isWindows } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { useRoute } from 'vue-router'
import { lightTheme } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 消息通知渠道 ID
const MESSAGE_CHANNEL_ID = 'xg_im_messages'

// 缓存通知模块，避免重复动态导入
let notificationModule: typeof import('@tauri-apps/plugin-notification') | null = null
const getNotificationModule = async () => {
  if (!notificationModule) {
    notificationModule = await import('@tauri-apps/plugin-notification')
  }
  return notificationModule
}

// 初始化消息通知渠道（Android 需要高重要性渠道才能显示横幅通知）
const initNotificationChannel = async () => {
  if (!isMobile()) return

  try {
    const { createChannel, Importance } = await getNotificationModule()
    await createChannel({
      id: MESSAGE_CHANNEL_ID,
      name: t('mobile_home.notification.channel_name'),
      description: t('mobile_home.notification.channel_description'),
      importance: Importance.High, // 高重要性 = Heads-up 横幅通知
      vibration: true,
      lights: true
    })
    console.log('[MobileLayout] 消息通知渠道创建成功')
  } catch (error) {
    console.warn('[MobileLayout] 创建通知渠道失败:', error)
  }
}

// 组件挂载时初始化通知渠道
onMounted(() => {
  initNotificationChannel()
})

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
  const isActiveChatView =
    route.path.startsWith('/mobile/chatRoom') && globalStore.currentSessionRoomId === data.message.roomId
  chatStore.pushMsg(data, {
    isActiveChatView,
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

      // 移动端发送系统通知（只有当用户不在当前聊天室时才发送，避免重复打扰）
      if (isMobile() && !isActiveChatView) {
        try {
          // 获取发送者名称（优先使用会话名称，因为 WebSocket 消息中 fromUser 可能没有 username）
          const senderName = session?.name || data?.fromUser?.username || t('mobile_home.notification.new_message')
          // 获取消息内容预览（文本消息显示内容，其他类型使用映射表）
          const msgType = data.message.type
          const messageContent =
            (msgType === MsgEnum.TEXT && data.message.body.content) ||
            MSG_REPLY_TEXT_MAP[msgType] ||
            '[消息]'

          // 使用缓存的通知模块（避免重复动态导入）
          const { sendNotification } = await getNotificationModule()
          await sendNotification({
            channelId: MESSAGE_CHANNEL_ID,
            title: senderName,
            body: messageContent
          })
        } catch (error) {
          console.warn('发送移动端通知失败:', error)
        }
      }
    }
  }

  await globalStore.updateGlobalUnreadCount()
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
