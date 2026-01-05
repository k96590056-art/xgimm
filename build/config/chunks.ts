/**
 * 代码分块配置
 * 用于 Vite 构建时的代码分割
 */

/**
 * 创建手动代码分块函数
 * @param dependencies package.json 中的依赖列表
 * @returns Rollup manualChunks 函数
 */
export function createManualChunks(dependencies: string[]) {
  return (id: string) => {
    // 如果是 node_modules 中的依赖
    if (id.includes('node_modules')) {
      const match = id.match(/node_modules\/(@?[^/]+)/)
      if (match) {
        const packageName = match[1]
        
        // 将大型库单独打包
        const largeLibraries = ['vue', 'vue-router', 'pinia', 'naive-ui', 'vant', 'three']
        for (const lib of largeLibraries) {
          if (packageName === lib || packageName.startsWith(`${lib}/`)) {
            return `vendor-${lib}`
          }
        }
        
        // 其他依赖打包到 vendor 中
        return 'vendor'
      }
    }
    
    // 其他代码保持原样
    return undefined
  }
}



