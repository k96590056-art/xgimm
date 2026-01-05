/**
 * 检查更新 - 已禁用
 */
export const useCheckUpdate = () => {
  // 检查更新周期
  const CHECK_UPDATE_TIME = 30 * 60 * 1000
  // 在未登录情况下缩短检查周期
  const CHECK_UPDATE_LOGIN_TIME = 5 * 60 * 1000

  /**
   * 检查更新 - 已禁用
   * @param _closeWin 需要关闭的窗口
   * @param _initialCheck 是否是初始检查
   */
  const checkUpdate = async (_closeWin: string, _initialCheck: boolean = false) => {
    // 更新检查已禁用
    return
  }

  return {
    checkUpdate,
    CHECK_UPDATE_TIME,
    CHECK_UPDATE_LOGIN_TIME
  }
}
