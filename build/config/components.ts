/**
 * 组件配置
 * 根据平台返回不同的组件目录和 DTS 路径
 */

/**
 * 根据平台获取组件目录
 * @param platform 平台类型 (windows | darwin | linux | android | ios)
 * @returns 组件目录数组
 */
export function getComponentsDirs(platform?: string): string[] {
  const isPC = platform === 'windows' || platform === 'darwin' || platform === 'linux'
  
  if (isPC) {
    // PC 端组件目录
    return ['src/components']
  } else {
    // 移动端组件目录
    return ['src/mobile', 'src/components']
  }
}

/**
 * 根据平台获取组件 DTS 文件路径
 * @param platform 平台类型 (windows | darwin | linux | android | ios)
 * @returns DTS 文件路径
 */
export function getComponentsDtsPath(platform?: string): string {
  const isPC = platform === 'windows' || platform === 'darwin' || platform === 'linux'
  
  if (isPC) {
    return 'src/typings/components.d.ts'
  } else {
    return 'src/typings/components-mobile.d.ts'
  }
}



