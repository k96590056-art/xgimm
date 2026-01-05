import router from '../router'
import { useChatStore } from '../stores/chat'
import { useGlobalStore } from '../stores/global'
import { useGroupStore } from '../stores/group'

/**
 * 跳转到移动端用户详情页
 * @param uid 用户uid
 */
export const toFriendInfoPage = (uid: string): void => {
  const chatStore = useChatStore()
  const groupStore = useGroupStore()
  const globalStore = useGlobalStore()

  // 群聊限制：只允许查看群主的账号信息
  if (chatStore.isGroup) {
    const currentLordId = groupStore.currentLordId
    if (uid !== currentLordId) {
      window.$message?.warning('在群聊中，只能查看群主的账号信息')
      return
    }
  }

  globalStore.addFriendModalInfo.uid = uid
  router.push(`/mobile/mobileFriends/friendInfo/${uid}`)
}
