import { BaseDirectory, create, exists, mkdir, readFile, remove } from '@tauri-apps/plugin-fs'
import { startRecording, stopRecording } from 'tauri-plugin-mic-recorder-api'
import { useUserStore } from '@/stores/user'
import { calculateCompressionRatio, compressAudioToMp3, getAudioInfo } from '@/utils/AudioCompression'
import { getImageCache } from '@/utils/PathUtil.ts'
import { isMobile } from '@/utils/PlatformConstants'
import { UploadSceneEnum } from '../enums'
import { useUpload } from './useUpload'

// Worker 计时器消息 ID
const TIMER_MSG_ID = 'voiceRecordTimer'

/**
 * 请求麦克风权限（Android 运行时权限）
 * 使用 Web API getUserMedia 来触发系统权限请求对话框
 */
const requestMicrophonePermission = async (): Promise<boolean> => {
  // 检查 mediaDevices API 是否可用
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('[VoiceRecord] mediaDevices API 不可用，跳过权限预请求')
    return true // 返回 true 让 Rust 插件自己处理
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // 获取权限后立即停止所有音轨
    stream.getTracks().forEach((track) => track.stop())
    console.log('[VoiceRecord] 麦克风权限已获取')
    return true
  } catch (error: any) {
    // 只有用户明确拒绝权限时才返回 false
    if (error?.name === 'NotAllowedError') {
      console.error('[VoiceRecord] 用户拒绝了麦克风权限')
      return false
    }
    // 其他错误（如设备不支持）不阻止录音，让 Rust 插件处理
    console.warn('[VoiceRecord] 权限预请求出现非致命错误:', error?.message)
    return true
  }
}

type VoiceRecordRustOptions = {
  onStart?: () => void
  onStop?: (audioBlob: Blob, duration: number, localPath: string) => void
  onError?: (error: string) => void
}

export const useVoiceRecordRust = (options: VoiceRecordRustOptions = {}) => {
  // 用户store
  const userStore = useUserStore()
  const isRecording = ref(false)
  const recordingTime = ref(0)
  const audioLevel = ref(0)
  const startTime = ref(0)
  // 每个 hook 实例独立的 worker，避免多组件冲突
  const timerWorker = ref<Worker | null>(null)
  const { generateHashKey } = useUpload()

  /** 开始录音 */
  const startRecordingAudio = async () => {
    console.log('[VoiceRecord] ========== 开始录音流程 ==========')

    try {
      // 如果有录音正在进行，先停止再开始新录音
      if (isRecording.value) {
        console.log('[VoiceRecord] 检测到已有录音，先停止')
        await stopRecordingAudio()
      }

      // 在移动端先请求麦克风权限
      if (isMobile()) {
        const hasPermission = await requestMicrophonePermission()
        if (!hasPermission) {
          window.$message?.error('无法获取麦克风权限，请在系统设置中允许应用使用麦克风')
          options.onError?.('麦克风权限被拒绝')
          return
        }
      }

      // 调用 Rust 后端开始录音
      console.log('[VoiceRecord] 调用 Rust startRecording...')
      await startRecording()
      console.log('[VoiceRecord] Rust startRecording 成功')

      isRecording.value = true
      startTime.value = Date.now()
      recordingTime.value = 0

      // 初始化worker计时器
      if (!timerWorker.value) {
        timerWorker.value = new Worker(new URL('../workers/timer.worker.ts', import.meta.url))

        // 监听worker消息
        timerWorker.value.onmessage = (e) => {
          const { type, msgId } = e.data

          if (type === 'timeout' && msgId === TIMER_MSG_ID) {
            // 每秒更新录音时间
            if (isRecording.value) {
              const currentTime = Math.floor((Date.now() - startTime.value) / 1000)
              recordingTime.value = currentTime

              // 检查是否达到60秒限制
              if (currentTime >= 59) {
                // 达到60秒，自动停止录音
                stopRecordingAudio()
                return
              }

              // 重新启动1秒定时器
              timerWorker.value?.postMessage({
                type: 'startTimer',
                msgId: TIMER_MSG_ID,
                duration: 1000
              })
            }
          }
        }

        timerWorker.value.onerror = (error) => {
          console.error('[VoiceRecord Worker Error]', error)
        }
      }

      // 开始worker计时
      timerWorker.value.postMessage({
        type: 'startTimer',
        msgId: TIMER_MSG_ID,
        duration: 1000
      })

      options.onStart?.()
      console.log('[VoiceRecord] 录音已开始')
    } catch (error: any) {
      console.error('[VoiceRecord] 开始录音出错:', error?.message || error)

      // 只有在录音确实没有开始时才显示错误
      // 检查 isRecording 状态来判断
      if (!isRecording.value) {
        window.$message?.error('录音失败，请检查麦克风权限')
        options.onError?.('录音失败')
      }
    }
  }

  /** 停止录音 */
  const stopRecordingAudio = async () => {
    console.log('[VoiceRecord] ========== 停止录音流程 ==========')
    try {
      if (!isRecording.value) {
        console.log('[VoiceRecord] 未在录音中，直接返回')
        return
      }

      // 调用Rust后端停止录音
      console.log('[VoiceRecord] 调用 Rust stopRecording...')
      const audioPath = await stopRecording()
      console.log('[VoiceRecord] Rust stopRecording 返回路径:', audioPath)

      isRecording.value = false
      const duration = (Date.now() - startTime.value) / 1000
      console.log('[VoiceRecord] 录音时长:', duration, '秒')

      // 清理worker定时器
      if (timerWorker.value) {
        timerWorker.value.postMessage({
          type: 'clearTimer',
          msgId: TIMER_MSG_ID
        })
      }

      // 如果有音频文件路径，立即处理并显示录音结果
      if (audioPath) {
        // 读取录音文件
        const audioData = await readFile(audioPath)

        // 获取原始音频信息（用于日志，但不依赖它的时长值）
        let originalInfo
        try {
          originalInfo = await getAudioInfo(audioData.buffer)
          console.log('原始音频信息:', {
            duration: `${originalInfo.duration.toFixed(2)}秒`,
            sampleRate: `${originalInfo.sampleRate}Hz`,
            channels: originalInfo.channels,
            size: `${(originalInfo.size / 1024 / 1024).toFixed(2)}MB`
          })
        } catch (infoError) {
          console.warn('获取音频信息失败，使用前端计时:', infoError)
          originalInfo = {
            duration: duration,
            sampleRate: 44100,
            channels: 1,
            size: audioData.byteLength
          }
        }

        // 压缩音频为MP3格式，传入前端计时的时长用于验证
        const compressedBlob = await compressAudioToMp3(
          audioData.buffer,
          {
            channels: 1, // 单声道
            sampleRate: 22050, // 降低采样率
            bitRate: 64 // 较低比特率
          },
          duration // 传入前端计时的时长用于验证
        )

        // 计算压缩比
        const compressionRatio = calculateCompressionRatio(originalInfo.size, compressedBlob.size)
        console.log('音频压缩完成:', {
          originalSize: `${(originalInfo.size / 1024 / 1024).toFixed(2)}MB`,
          compressedSize: `${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`,
          compressionRatio: `${compressionRatio}%`
        })

        try {
          // 保存音频到缓存并获取最终路径
          const finalPath = await saveAudioToCache(compressedBlob)
          // 缓存成功后，使用最终路径进行回调（只调用一次）
          options.onStop?.(compressedBlob, duration, finalPath)
        } catch (error) {
          console.error('保存音频文件失败:', error)
          window.$message?.error('音频保存失败')
          options.onError?.('音频保存失败')
        }

        // 删除原始的wav文件，释放磁盘空间
        try {
          await remove(audioPath)
          console.log('已删除原始录音文件:', audioPath)
        } catch (deleteError) {
          console.warn('删除原始录音文件失败:', deleteError)
        }
      }
    } catch (error) {
      console.error('停止录音或压缩失败:', error)

      // 确保录音状态被正确重置
      isRecording.value = false

      // 清理worker定时器
      if (timerWorker.value) {
        timerWorker.value.postMessage({
          type: 'clearTimer',
          msgId: TIMER_MSG_ID
        })
      }
      options.onError?.('停止录音失败')
    }
  }

  /** 取消录音 */
  const cancelRecordingAudio = async () => {
    try {
      if (!isRecording.value) return

      // 调用Rust后端停止录音，获取临时文件路径以便删除
      const audioPath = await stopRecording()
      console.log('取消录音，临时文件:', audioPath)

      isRecording.value = false

      // 清理worker定时器
      if (timerWorker.value) {
        timerWorker.value.postMessage({
          type: 'clearTimer',
          msgId: TIMER_MSG_ID
        })
      }

      // 删除临时录音文件，避免资源泄露
      if (audioPath) {
        try {
          await remove(audioPath)
          console.log('已删除取消录音的临时文件:', audioPath)
        } catch (deleteError) {
          console.warn('删除临时录音文件失败:', deleteError)
        }
      }
    } catch (error) {
      console.error('取消录音失败:', error)
      // 确保状态被重置
      isRecording.value = false
      options.onError?.('取消录音失败')
    }
  }

  /** 保存音频到本地缓存并返回路径 */
  const saveAudioToCache = async (audioBlob: Blob): Promise<string> => {
    const getFileHashName = async (tempFileName: string) => {
      const audioFile = new File([audioBlob], tempFileName)
      // 计算文件真正的资源哈希文件名
      const resourceFileName = await generateHashKey(
        { scene: UploadSceneEnum.CHAT, enableDeduplication: true }, // 这里的UploadSceneEnum随便选，反正只需要哈希值文件名
        audioFile,
        tempFileName
      )

      return resourceFileName.split('/').pop() as string
    }

    const userUid = userStore.userInfo!.uid
    if (!userUid) {
      throw new Error('用户未登录')
    }

    // 生成文件名
    const timestamp = Date.now()
    const fileName = `voice_${timestamp}.mp3`

    // 获取缓存路径
    const audioFolder = 'audio'
    const cachePath = getImageCache(audioFolder, userUid.toString())

    const fileHashName = await getFileHashName(fileName)
    const fullPath = `${cachePath}${fileHashName}`

    // 确保目录存在
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    const dirExists = await exists(cachePath, { baseDir })
    if (!dirExists) {
      await mkdir(cachePath, { baseDir, recursive: true })
    }

    // 将Blob转换为ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer()

    // 保存到本地文件
    const file = await create(fullPath, { baseDir })
    await file.write(new Uint8Array(arrayBuffer))
    await file.close()

    console.log('音频文件已保存到:', fullPath)

    return fullPath
  }

  // 格式化录音时间
  const formatTime = (seconds: number) => {
    const roundedSeconds = Math.round(seconds)
    const mins = Math.floor(roundedSeconds / 60)
    const secs = roundedSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 清理资源
  onUnmounted(() => {
    cancelRecordingAudio()
    // 清理worker
    if (timerWorker.value) {
      timerWorker.value.postMessage({
        type: 'clearTimer',
        msgId: TIMER_MSG_ID
      })
      timerWorker.value.terminate()
      timerWorker.value = null
    }
  })

  return {
    isRecording: readonly(isRecording),
    recordingTime: readonly(recordingTime),
    audioLevel: readonly(audioLevel),
    startRecording: startRecordingAudio,
    stopRecording: stopRecordingAudio,
    cancelRecording: cancelRecordingAudio,
    formatTime
  }
}
