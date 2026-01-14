<template>
  <div class="h-15rem w-full">
    <van-swipe class="h-full" :loop="false" :show-indicators="true" indicator-color="#999">
      <van-swipe-item v-for="(page, pageIndex) in pages" :key="pageIndex">
        <div class="px-15px pt-15px pb-30px grid grid-cols-4 gap-3 auto-rows-18">
          <div
            @click="handleClickIcon(item)"
            v-for="item in page"
            :key="item.label"
            class="flex flex-col gap-8px items-center justify-center rounded-2">
            <svg v-if="item.isShow()" class="h-24px w-24px iconpark-icon">
              <use :href="`#${item.icon}`"></use>
            </svg>
            <div class="text-10px" v-if="item.isShow()">
              {{ item.label }}
            </div>
          </div>
        </div>
      </van-swipe-item>
    </van-swipe>

    <!-- 隐藏的文件选择器 -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="*/*"
      style="display: none"
      @change="handleFileChange"
    />

    <!-- 隐藏的图片选择器 -->
    <input
      ref="imageInputRef"
      type="file"
      multiple
      accept="image/*"
      style="display: none"
      @change="handleImageChange"
    />

    <van-popup v-model:show="pickRtcCall" position="bottom">
      <div class="flex flex-col items-center justify-center">
        <div class="w-full text-center py-3" @click="startCall(CallTypeEnum.VIDEO)">视频通话</div>
        <div class="w-full text-center py-3" @click="startCall(CallTypeEnum.AUDIO)">语音通话</div>
        <div class="w-full text-center py-3" @click="pickRtcCall = false">取消</div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { CallTypeEnum } from '@/enums'
import router from '@/router'
import { useGlobalStore } from '@/stores/global'

const globalStore = useGlobalStore()

const pickRtcCall = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  (e: 'sendFiles', files: File[]): void
  (e: 'sendImages', files: File[]): void
}>()

// 图片 MIME 类型列表
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']

/**
 * 点击文件按钮 - 触发隐藏的文件输入框
 */
const handleFileSelect = () => {
  console.log('[More] 点击文件按钮')
  fileInputRef.value?.click()
}

/**
 * 点击图片按钮 - 触发隐藏的图片输入框
 */
const handleImageSelect = () => {
  console.log('[More] 点击图片按钮')
  imageInputRef.value?.click()
}

/**
 * 文件选择变化处理
 */
const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const fileList = input.files

  if (!fileList || fileList.length === 0) {
    console.log('[More] 未选择文件')
    return
  }

  console.log('[More] 选择了文件数量:', fileList.length)

  const files: File[] = []

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]

    // 过滤掉图片文件（文件按钮只发送非图片）
    if (IMAGE_MIME_TYPES.includes(file.type)) {
      console.log('[More] 已过滤图片文件:', file.name, file.type)
      continue
    }

    files.push(file)
    console.log('[More] 已添加文件:', file.name, file.type, file.size)
  }

  // 清空 input 以便下次可以选择相同文件
  input.value = ''

  if (files.length > 0) {
    console.log('[More] 发送 sendFiles 事件，数量:', files.length)
    emit('sendFiles', files)
  } else {
    console.log('[More] 没有可发送的文件（可能都是图片）')
    window.$message?.info('请使用图片按钮发送图片')
  }
}

/**
 * 图片选择变化处理
 */
const handleImageChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const fileList = input.files

  if (!fileList || fileList.length === 0) {
    console.log('[More] 未选择图片')
    return
  }

  console.log('[More] 选择了图片数量:', fileList.length)

  const files: File[] = []

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]

    // 只保留图片文件
    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      console.log('[More] 已过滤非图片文件:', file.name, file.type)
      continue
    }

    files.push(file)
    console.log('[More] 已添加图片:', file.name, file.type, file.size)
  }

  // 清空 input 以便下次可以选择相同文件
  input.value = ''

  if (files.length > 0) {
    console.log('[More] 发送 sendImages 事件，数量:', files.length)
    emit('sendImages', files)
  } else {
    console.log('[More] 没有可发送的图片')
    window.$message?.warning('只能选择图片哦~')
  }
}

// ==== 展开面板选项 ====
const options = ref([
  {
    label: '文件',
    icon: 'file',
    onClick: handleFileSelect,
    isShow: () => true
  },
  {
    label: '图片',
    icon: 'photo',
    onClick: handleImageSelect,
    isShow: () => true
  },
  // 视频按钮暂时隐藏 - 功能未实现
  {
    label: '视频',
    icon: 'voice',
    onClick: () => {},
    isShow: () => false
  },
  {
    label: '历史',
    icon: 'history',
    onClick: () => {
      // TODO: 实现历史记录功能
      console.log('[More] 历史记录功能待实现')
    },
    isShow: () => true
  },
  // 视频通话按钮
  {
    label: '视频通话',
    icon: 'video-one',
    onClick: () => {
      pickRtcCall.value = true
    },
    isShow: () => true
  }
])

// 将数据分页，每页8个（2行4列）
const pages = computed(() => {
  const pageSize = 8
  const result: any[][] = []
  const visibleOptions = options.value.filter((item) => item.isShow())
  for (let i = 0; i < visibleOptions.length; i += pageSize) {
    result.push(visibleOptions.slice(i, i + pageSize))
  }
  return result
})

const handleClickIcon = (item: any) => {
  item.onClick()
}

const startCall = (callType: CallTypeEnum) => {
  const currentSession = globalStore.currentSession
  if (!currentSession?.detailId) {
    pickRtcCall.value = false
    return
  }
  router.push({
    path: `/mobile/rtcCall`,
    query: {
      remoteUserId: currentSession.detailId,
      roomId: globalStore.currentSessionRoomId,
      callType: callType
    }
  })
}
</script>

<style scoped></style>
