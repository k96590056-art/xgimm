<template>
  <div class="grid grid-cols-[32px_32px_32px] px-16px gap-12px z-1 h-32px items-center justify-end mt-10px">
    <div @click="toMyMessages" class="h-32px w-32px flex items-center justify-center">
      <n-badge :max="99" :value="unreadApplyCount" :show="unreadApplyCount > 0">
        <svg class="iconpark-icon h-24px w-24px block"><use href="#remind"></use></svg>
      </n-badge>
    </div>

    <!-- 分享按钮暂时隐藏 -->
    <!-- <div @click="activate" class="h-32px w-32px flex items-center justify-center">
      <svg class="iconpark-icon h-24px w-24px block"><use href="#share"></use></svg>
    </div> -->

    <div @click="toScanQRCode" class="h-32px w-32px flex items-center justify-center">
      <svg class="iconpark-icon h-30px w-30px block"><use href="#saoma"></use></svg>
    </div>

    <div @click="toSettings" class="h-32px w-32px flex items-center justify-center">
      <svg class="iconpark-icon h-30px w-30px block"><use href="#wode-shezhi"></use></svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import router from '@/router'
import { useGlobalStore } from '@/stores/global.ts'

const globalStore = useGlobalStore()

const unreadApplyCount = computed(() => {
  return globalStore.unReadMark.newFriendUnreadCount + globalStore.unReadMark.newGroupUnreadCount
})

const toScanQRCode = () => {
  router.push('/mobile/mobileMy/scanQRCode')
}

const toSettings = () => {
  router.push('/mobile/mobileMy/settings')
}

const toMyMessages = () => {
  router.push('/mobile/mobileMy/myMessages')
}
</script>

<style scoped></style>
