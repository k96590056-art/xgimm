/**
 * 控制台输出配置
 * 用于在启动时打印信息
 */

/**
 * 启动时打印信息
 * @param config 环境配置
 * @param mode 构建模式 (development | production)
 * @param host 服务器地址
 * @returns 无返回值的函数
 */
export function atStartup(config: Record<string, string>, mode: string, host: string) {
  return () => {
    if (mode === 'development') {
      // 开发模式下打印启动信息
      const platform = config.TAURI_ENV_PLATFORM || 'unknown'
      const port = config.VITE_PORT || (platform === 'windows' || platform === 'darwin' || platform === 'linux' ? '6130' : '5210')
      
      console.log('\n🚀 开发服务器启动信息:')
      console.log(`   平台: ${platform}`)
      console.log(`   模式: ${mode}`)
      console.log(`   地址: http://${host}:${port}`)
      console.log('')
    }
  }
}



