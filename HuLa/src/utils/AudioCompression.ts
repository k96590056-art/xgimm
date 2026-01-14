import * as lamejs from '@breezystack/lamejs'

/**
 * 音频压缩配置接口
 */
export interface AudioCompressionConfig {
  /** 声道数：1为单声道，2为立体声 */
  channels?: number
  /** 采样率 (Hz) */
  sampleRate?: number
  /** MP3比特率 (kbps) */
  bitRate?: number
}

/**
 * 默认音频压缩配置
 */
const DEFAULT_CONFIG: Required<AudioCompressionConfig> = {
  channels: 1, // 单声道可以减小文件大小
  sampleRate: 22050, // 降低采样率以减小文件大小
  bitRate: 64 // 较低的比特率以减小文件大小
}

/**
 * 将WAV音频数据转换为压缩的MP3格式
 * @param audioBuffer - 音频缓冲区数据
 * @param config - 压缩配置
 * @param expectedDuration - 预期时长（秒），用于验证解码是否正确
 * @returns 压缩后的MP3 Blob
 */
export async function compressAudioToMp3(
  audioBuffer: ArrayBuffer,
  config: AudioCompressionConfig = {},
  expectedDuration?: number
): Promise<Blob> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  try {
    // 首先尝试直接解析 WAV 文件（绕过 AudioContext 兼容性问题）
    const wavParseResult = parseWavFile(audioBuffer)
    if (wavParseResult) {
      console.log('[AudioCompression] 使用 WAV 直接解析模式')
      return compressFromWavData(wavParseResult, finalConfig)
    }

    // 降级：使用 AudioContext 解码
    console.log('[AudioCompression] 使用 AudioContext 解码模式')
    const audioContext = new AudioContext()
    const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice())

    // 验证解码后的时长是否合理
    if (expectedDuration && expectedDuration > 0) {
      const durationDiff = Math.abs(decodedAudio.duration - expectedDuration)
      const durationRatio = durationDiff / expectedDuration

      console.log('[AudioCompression] 时长验证:', {
        expected: expectedDuration,
        decoded: decodedAudio.duration,
        diff: durationDiff,
        ratio: `${(durationRatio * 100).toFixed(1)}%`
      })

      // 如果解码后的时长与预期时长相差超过 50%，说明解码有问题
      if (durationRatio > 0.5) {
        console.warn('[AudioCompression] AudioContext 解码时长异常，尝试直接解析 WAV')
        await audioContext.close()

        // 尝试强制解析 WAV
        const forcedWavResult = parseWavFileForced(audioBuffer)
        if (forcedWavResult) {
          return compressFromWavData(forcedWavResult, finalConfig)
        }

        throw new Error(`音频解码时长异常: 预期 ${expectedDuration}s, 实际 ${decodedAudio.duration}s`)
      }
    }

    // 重采样到目标采样率
    const resampledBuffer = await resampleAudio(decodedAudio, finalConfig.sampleRate)

    // 转换为Int16Array格式
    const samples = convertToInt16Array(resampledBuffer, finalConfig.channels)

    // 使用lamejs进行MP3编码
    const mp3Data = encodeToMp3(samples, finalConfig)

    // 创建MP3 Blob - 将 Int8Array 转换为 Uint8Array
    const uint8Arrays = mp3Data.map((data) => new Uint8Array(data))
    const blob = new Blob(uint8Arrays, { type: 'audio/mp3' })

    // 清理AudioContext
    await audioContext.close()

    return blob
  } catch (error) {
    console.error('音频压缩失败:', error)
    throw new Error('音频压缩失败')
  }
}

/**
 * WAV 文件解析结果
 */
interface WavParseResult {
  sampleRate: number
  channels: number
  bitsPerSample: number
  samples: Int16Array
  duration: number
}

/**
 * 直接解析 WAV 文件头和 PCM 数据
 * 这种方式可以绕过某些设备上 AudioContext.decodeAudioData 的兼容性问题
 */
function parseWavFile(buffer: ArrayBuffer): WavParseResult | null {
  try {
    const view = new DataView(buffer)

    // 检查 RIFF 标识
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
    if (riff !== 'RIFF') {
      console.log('[WAV Parser] 不是有效的 RIFF 文件')
      return null
    }

    // 检查 WAVE 标识
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
    if (wave !== 'WAVE') {
      console.log('[WAV Parser] 不是有效的 WAVE 文件')
      return null
    }

    // 查找 fmt 块
    let offset = 12
    let fmtFound = false
    let audioFormat = 0
    let channels = 0
    let sampleRate = 0
    let bitsPerSample = 0

    while (offset < buffer.byteLength - 8) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      )
      const chunkSize = view.getUint32(offset + 4, true)

      if (chunkId === 'fmt ') {
        audioFormat = view.getUint16(offset + 8, true)
        channels = view.getUint16(offset + 10, true)
        sampleRate = view.getUint32(offset + 12, true)
        bitsPerSample = view.getUint16(offset + 22, true)
        fmtFound = true
        console.log('[WAV Parser] fmt 块:', { audioFormat, channels, sampleRate, bitsPerSample })
      }

      if (chunkId === 'data' && fmtFound) {
        // 只支持 PCM 格式 (audioFormat === 1)
        if (audioFormat !== 1) {
          console.log('[WAV Parser] 不支持的音频格式:', audioFormat)
          return null
        }

        const dataOffset = offset + 8
        const dataLength = chunkSize

        // 解析 PCM 数据
        const samples = parsePcmData(view, dataOffset, dataLength, bitsPerSample)
        const duration = samples.length / channels / sampleRate

        console.log('[WAV Parser] 成功解析:', {
          samples: samples.length,
          duration: `${duration.toFixed(2)}s`
        })

        return {
          sampleRate,
          channels,
          bitsPerSample,
          samples,
          duration
        }
      }

      offset += 8 + chunkSize
      // WAV 块大小必须是偶数
      if (chunkSize % 2 !== 0) {
        offset++
      }
    }

    console.log('[WAV Parser] 未找到有效的音频数据块')
    return null
  } catch (error) {
    console.error('[WAV Parser] 解析失败:', error)
    return null
  }
}

/**
 * 强制解析 WAV 文件（即使格式不完全标准）
 */
function parseWavFileForced(buffer: ArrayBuffer): WavParseResult | null {
  try {
    const view = new DataView(buffer)

    // 尝试查找 data 块，使用常见的默认值
    const defaultSampleRate = 44100
    const defaultChannels = 1
    const defaultBitsPerSample = 16

    // 搜索 "data" 字符串
    for (let i = 0; i < Math.min(buffer.byteLength - 100, 1000); i++) {
      const chunk = String.fromCharCode(
        view.getUint8(i),
        view.getUint8(i + 1),
        view.getUint8(i + 2),
        view.getUint8(i + 3)
      )
      if (chunk === 'data') {
        const dataSize = view.getUint32(i + 4, true)
        const dataOffset = i + 8

        if (dataSize > 0 && dataOffset + dataSize <= buffer.byteLength) {
          const samples = parsePcmData(view, dataOffset, dataSize, defaultBitsPerSample)
          const duration = samples.length / defaultChannels / defaultSampleRate

          console.log('[WAV Parser Forced] 强制解析成功:', {
            samples: samples.length,
            duration: `${duration.toFixed(2)}s`
          })

          return {
            sampleRate: defaultSampleRate,
            channels: defaultChannels,
            bitsPerSample: defaultBitsPerSample,
            samples,
            duration
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('[WAV Parser Forced] 解析失败:', error)
    return null
  }
}

/**
 * 解析 PCM 数据为 Int16Array
 */
function parsePcmData(view: DataView, offset: number, length: number, bitsPerSample: number): Int16Array {
  if (bitsPerSample === 16) {
    const samples = new Int16Array(length / 2)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = view.getInt16(offset + i * 2, true)
    }
    return samples
  } else if (bitsPerSample === 8) {
    // 8位 PCM 转 16位
    const samples = new Int16Array(length)
    for (let i = 0; i < length; i++) {
      const sample8 = view.getUint8(offset + i)
      samples[i] = (sample8 - 128) * 256
    }
    return samples
  } else if (bitsPerSample === 32) {
    // 32位浮点 PCM 转 16位
    const samples = new Int16Array(length / 4)
    for (let i = 0; i < samples.length; i++) {
      const sample32 = view.getFloat32(offset + i * 4, true)
      samples[i] = Math.max(-32768, Math.min(32767, Math.round(sample32 * 32767)))
    }
    return samples
  }

  throw new Error(`不支持的位深度: ${bitsPerSample}`)
}

/**
 * 从 WAV 解析结果直接压缩为 MP3
 */
function compressFromWavData(wavData: WavParseResult, config: Required<AudioCompressionConfig>): Blob {
  let samples = wavData.samples

  // 如果需要降采样
  if (wavData.sampleRate !== config.sampleRate) {
    samples = resampleInt16Array(samples, wavData.sampleRate, config.sampleRate, wavData.channels)
  }

  // 如果需要转换为单声道
  if (wavData.channels > 1 && config.channels === 1) {
    samples = stereoToMono(samples, wavData.channels)
  }

  // 放大音量
  const AMPLIFY = 10
  for (let i = 0; i < samples.length; i++) {
    const amplified = samples[i] * AMPLIFY
    samples[i] = Math.max(-32768, Math.min(32767, amplified))
  }

  // 使用 lamejs 编码
  const mp3Data = encodeToMp3(samples, config)
  const uint8Arrays = mp3Data.map((data) => new Uint8Array(data))
  return new Blob(uint8Arrays, { type: 'audio/mp3' })
}

/**
 * Int16Array 降采样
 */
function resampleInt16Array(
  samples: Int16Array,
  fromRate: number,
  toRate: number,
  _channels: number
): Int16Array {
  const ratio = fromRate / toRate
  const newLength = Math.floor(samples.length / ratio)
  const result = new Int16Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio)
    result[i] = samples[Math.min(srcIndex, samples.length - 1)]
  }

  return result
}

/**
 * 立体声转单声道
 */
function stereoToMono(samples: Int16Array, channels: number): Int16Array {
  const monoLength = Math.floor(samples.length / channels)
  const mono = new Int16Array(monoLength)

  for (let i = 0; i < monoLength; i++) {
    let sum = 0
    for (let ch = 0; ch < channels; ch++) {
      sum += samples[i * channels + ch]
    }
    mono[i] = Math.round(sum / channels)
  }

  return mono
}

/**
 * 重采样音频到目标采样率
 */
async function resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer
  }

  const audioContext = new AudioContext({ sampleRate: targetSampleRate })
  const resampledBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    Math.floor((audioBuffer.length * targetSampleRate) / audioBuffer.sampleRate),
    targetSampleRate
  )

  // 简单的线性插值重采样
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel)
    const outputData = resampledBuffer.getChannelData(channel)
    const ratio = inputData.length / outputData.length

    for (let i = 0; i < outputData.length; i++) {
      const index = i * ratio
      const indexFloor = Math.floor(index)
      const indexCeil = Math.min(indexFloor + 1, inputData.length - 1)
      const fraction = index - indexFloor

      outputData[i] = inputData[indexFloor] * (1 - fraction) + inputData[indexCeil] * fraction
    }
  }

  await audioContext.close()
  return resampledBuffer
}

/**
 * 将AudioBuffer转换为Int16Array格式
 */
function convertToInt16Array(audioBuffer: AudioBuffer, targetChannels: number): Int16Array {
  const length = audioBuffer.length
  const samples = new Int16Array(length * targetChannels)
  const AMPLIFY = 10 // 10倍响度

  if (targetChannels === 1) {
    // 转换为单声道
    const channelData = audioBuffer.numberOfChannels > 1 ? mixToMono(audioBuffer) : audioBuffer.getChannelData(0)

    for (let i = 0; i < length; i++) {
      const sample = channelData[i] * AMPLIFY
      samples[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff
    }
  } else {
    // 保持立体声
    const leftChannel = audioBuffer.getChannelData(0)
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel

    for (let i = 0; i < length; i++) {
      const l = leftChannel[i] * AMPLIFY
      const r = rightChannel[i] * AMPLIFY
      samples[i * 2] = Math.max(-1, Math.min(1, l)) * 0x7fff
      samples[i * 2 + 1] = Math.max(-1, Math.min(1, r)) * 0x7fff
    }
  }

  return samples
}

/**
 * 将多声道音频混合为单声道
 */
function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length
  const monoData = new Float32Array(length)
  const numberOfChannels = audioBuffer.numberOfChannels

  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let channel = 0; channel < numberOfChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i]
    }
    monoData[i] = sum / numberOfChannels
  }

  return monoData
}

/**
 * 使用lamejs将音频数据编码为MP3
 */
function encodeToMp3(samples: Int16Array, config: Required<AudioCompressionConfig>): Int8Array[] {
  const mp3encoder = new lamejs.Mp3Encoder(config.channels, config.sampleRate, config.bitRate)
  const mp3Data: Int8Array[] = []
  const sampleBlockSize = 1152 // lamejs推荐的块大小

  // 分块编码
  for (let i = 0; i < samples.length; i += sampleBlockSize * config.channels) {
    let sampleChunk: Int16Array

    if (config.channels === 1) {
      // 单声道
      sampleChunk = samples.subarray(i, i + sampleBlockSize)
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk)
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf as any)
      }
    } else {
      // 立体声
      const leftChunk = new Int16Array(sampleBlockSize)
      const rightChunk = new Int16Array(sampleBlockSize)

      for (let j = 0; j < sampleBlockSize && i + j * 2 + 1 < samples.length; j++) {
        leftChunk[j] = samples[i + j * 2]
        rightChunk[j] = samples[i + j * 2 + 1]
      }

      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk)
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf as any)
      }
    }
  }

  // 完成编码
  const mp3buf = mp3encoder.flush()
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf as any)
  }

  return mp3Data
}

/**
 * 获取音频文件的基本信息
 */
export async function getAudioInfo(audioBuffer: ArrayBuffer): Promise<{
  duration: number
  sampleRate: number
  channels: number
  size: number
}> {
  const audioContext = new AudioContext()
  const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice())

  const info = {
    duration: decodedAudio.duration,
    sampleRate: decodedAudio.sampleRate,
    channels: decodedAudio.numberOfChannels,
    size: audioBuffer.byteLength
  }

  await audioContext.close()
  return info
}

/**
 * 计算压缩比
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round((1 - compressedSize / originalSize) * 100)
}
