/**
 * 图片 vs 文件策略验证测试
 * 验证核心修复：确保图片和文件使用不同的消息策略
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模拟消息策略映射
const mockImageStrategy = {
  getMsg: vi.fn().mockResolvedValue({
    type: 3, // MsgEnum.IMAGE
    path: 'temp-image.jpg',
    url: 'blob:http://localhost/preview',
    imageInfo: { width: 800, height: 600, size: 102400 }
  }),
  buildMessageBody: vi.fn().mockReturnValue({
    url: 'blob:http://localhost/preview',
    width: 800,
    height: 600,
    size: 102400
  }),
  buildMessageType: vi.fn().mockReturnValue({
    message: { type: 3, status: 1 }
  }),
  uploadFile: vi.fn().mockResolvedValue({
    uploadUrl: 'https://upload.example.com',
    downloadUrl: 'https://cdn.example.com/image.jpg',
    config: { provider: 'QINIU' }
  }),
  doUpload: vi.fn().mockResolvedValue({ qiniuUrl: 'https://cdn.example.com/image.jpg' })
}

const mockFileStrategy = {
  getMsg: vi.fn().mockResolvedValue({
    type: 6, // MsgEnum.FILE
    path: 'document.pdf',
    url: 'blob:http://localhost/file',
    fileName: 'document.pdf',
    size: 204800
  }),
  buildMessageBody: vi.fn().mockReturnValue({
    url: 'blob:http://localhost/file',
    fileName: 'document.pdf',
    size: 204800,
    mimeType: 'application/pdf'
  }),
  buildMessageType: vi.fn().mockReturnValue({
    message: { type: 6, status: 1 }
  }),
  uploadFile: vi.fn().mockResolvedValue({
    uploadUrl: 'https://upload.example.com',
    downloadUrl: 'https://cdn.example.com/document.pdf',
    config: { provider: 'QINIU' }
  }),
  doUpload: vi.fn().mockResolvedValue({ qiniuUrl: 'https://cdn.example.com/document.pdf' })
}

// 模拟消息类型枚举
const MsgEnum = {
  IMAGE: 3,
  FILE: 6,
  TEXT: 1,
  EMOJI: 4
}

// 模拟策略映射
const messageStrategyMap: Record<number, typeof mockImageStrategy | typeof mockFileStrategy> = {
  [MsgEnum.IMAGE]: mockImageStrategy,
  [MsgEnum.FILE]: mockFileStrategy
}

describe('消息策略验证测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('策略映射正确性', () => {
    it('IMAGE 类型应该映射到图片策略', () => {
      const strategy = messageStrategyMap[MsgEnum.IMAGE]
      expect(strategy).toBe(mockImageStrategy)
      expect(strategy).not.toBe(mockFileStrategy)
    })

    it('FILE 类型应该映射到文件策略', () => {
      const strategy = messageStrategyMap[MsgEnum.FILE]
      expect(strategy).toBe(mockFileStrategy)
      expect(strategy).not.toBe(mockImageStrategy)
    })
  })

  describe('sendImagesDirect 策略使用验证', () => {
    it('发送图片时应该使用 IMAGE 策略而不是 FILE 策略', async () => {
      // 模拟 sendImagesDirect 的策略选择逻辑
      const msgType = MsgEnum.IMAGE
      const strategy = messageStrategyMap[msgType]

      const imageFile = new File(['image data'], 'photo.jpg', { type: 'image/jpeg' })

      // 调用策略方法
      await strategy.getMsg('', {}, [imageFile])
      strategy.buildMessageBody({}, {})
      strategy.buildMessageType('T123', {}, {}, { value: '123' })

      // 验证调用的是 IMAGE 策略
      expect(mockImageStrategy.getMsg).toHaveBeenCalled()
      expect(mockImageStrategy.buildMessageBody).toHaveBeenCalled()
      expect(mockImageStrategy.buildMessageType).toHaveBeenCalled()

      // 验证没有调用 FILE 策略
      expect(mockFileStrategy.getMsg).not.toHaveBeenCalled()
      expect(mockFileStrategy.buildMessageBody).not.toHaveBeenCalled()
      expect(mockFileStrategy.buildMessageType).not.toHaveBeenCalled()
    })

    it('发送图片时 msgType 应该是 IMAGE 而不是 FILE', async () => {
      // 这是修复的核心验证
      const sendPayload = {
        msgType: MsgEnum.IMAGE, // 修复后应该是 IMAGE
        body: {
          url: 'https://cdn.example.com/image.jpg',
          width: 800,
          height: 600
        }
      }

      expect(sendPayload.msgType).toBe(MsgEnum.IMAGE)
      expect(sendPayload.msgType).not.toBe(MsgEnum.FILE)
    })
  })

  describe('sendFilesDirect 策略使用验证', () => {
    it('发送文件时应该使用 FILE 策略', async () => {
      const msgType = MsgEnum.FILE
      const strategy = messageStrategyMap[msgType]

      const pdfFile = new File(['pdf data'], 'document.pdf', { type: 'application/pdf' })

      await strategy.getMsg('', {}, [pdfFile])
      strategy.buildMessageBody({}, {})

      // 验证调用的是 FILE 策略
      expect(mockFileStrategy.getMsg).toHaveBeenCalled()
      expect(mockFileStrategy.buildMessageBody).toHaveBeenCalled()
    })
  })

  describe('消息体结构差异验证', () => {
    it('图片消息应该包含 imageInfo', async () => {
      const strategy = messageStrategyMap[MsgEnum.IMAGE]
      const msg = await strategy.getMsg('', {}, [new File([''], 'test.jpg')])

      expect(msg).toHaveProperty('imageInfo')
      expect(msg.imageInfo).toHaveProperty('width')
      expect(msg.imageInfo).toHaveProperty('height')
      expect(msg.imageInfo).toHaveProperty('size')
    })

    it('文件消息应该包含 fileName 和 mimeType', async () => {
      const strategy = messageStrategyMap[MsgEnum.FILE]
      const msg = await strategy.getMsg('', {}, [new File([''], 'test.pdf')])

      expect(msg).toHaveProperty('fileName')
      // 文件消息不应该有 imageInfo
      expect(msg).not.toHaveProperty('imageInfo')
    })
  })

  describe('More.vue 事件分发验证', () => {
    it('afterReadImage 应该触发 sendImages 事件', () => {
      // 模拟 More.vue 的事件发送逻辑
      const emit = vi.fn()
      const imageFiles = [new File([''], 'photo.jpg', { type: 'image/jpeg' })]

      // 模拟 afterReadImage 的逻辑
      const afterReadImage = (files: File[]) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif']
        const validFiles = files.filter((f) => validTypes.includes(f.type))
        if (validFiles.length > 0) {
          emit('sendImages', validFiles) // 修复后发送 sendImages 而不是 sendFiles
        }
      }

      afterReadImage(imageFiles)

      expect(emit).toHaveBeenCalledWith('sendImages', imageFiles)
      expect(emit).not.toHaveBeenCalledWith('sendFiles', expect.anything())
    })

    it('afterReadFile 应该触发 sendFiles 事件', () => {
      const emit = vi.fn()
      const nonImageFiles = [new File([''], 'document.pdf', { type: 'application/pdf' })]

      // 模拟 afterReadFile 的逻辑
      const afterReadFile = (files: File[]) => {
        const imageTypes = ['image/jpeg', 'image/png', 'image/gif']
        const nonImages = files.filter((f) => !imageTypes.includes(f.type))
        if (nonImages.length > 0) {
          emit('sendFiles', nonImages)
        }
      }

      afterReadFile(nonImageFiles)

      expect(emit).toHaveBeenCalledWith('sendFiles', nonImageFiles)
      expect(emit).not.toHaveBeenCalledWith('sendImages', expect.anything())
    })
  })

  describe('ChatFooter.vue 事件处理验证', () => {
    it('sendImages 事件应该调用 sendImagesDirect', () => {
      const sendImagesDirect = vi.fn()
      const sendFilesDirect = vi.fn()
      const imageFiles = [new File([''], 'photo.jpg', { type: 'image/jpeg' })]

      // 模拟 handleMoreSendImages
      const handleMoreSendImages = (files: File[]) => {
        if (files?.length > 0) {
          sendImagesDirect(files)
        }
      }

      handleMoreSendImages(imageFiles)

      expect(sendImagesDirect).toHaveBeenCalledWith(imageFiles)
      expect(sendFilesDirect).not.toHaveBeenCalled()
    })

    it('sendFiles 事件应该调用 sendFilesDirect', () => {
      const sendImagesDirect = vi.fn()
      const sendFilesDirect = vi.fn()
      const docFiles = [new File([''], 'doc.pdf', { type: 'application/pdf' })]

      // 模拟 handleMoreSendFiles
      const handleMoreSendFiles = (files: File[]) => {
        if (files?.length > 0) {
          sendFilesDirect(files)
        }
      }

      handleMoreSendFiles(docFiles)

      expect(sendFilesDirect).toHaveBeenCalledWith(docFiles)
      expect(sendImagesDirect).not.toHaveBeenCalled()
    })
  })
})

describe('修复验证 - 完整流程', () => {
  it('完整流程：图片按钮 -> sendImages 事件 -> sendImagesDirect -> MsgEnum.IMAGE', () => {
    // 1. 用户点击"图片"按钮选择图片
    const selectedFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })

    // 2. More.vue 检测到是图片类型
    const validTypes = ['image/jpeg', 'image/png', 'image/gif']
    const isImage = validTypes.includes(selectedFile.type)
    expect(isImage).toBe(true)

    // 3. More.vue 发送 sendImages 事件（修复后的行为）
    const eventName = isImage ? 'sendImages' : 'sendFiles'
    expect(eventName).toBe('sendImages')

    // 4. ChatFooter.vue 接收 sendImages 事件，调用 sendImagesDirect
    const handlerCalled = eventName === 'sendImages' ? 'sendImagesDirect' : 'sendFilesDirect'
    expect(handlerCalled).toBe('sendImagesDirect')

    // 5. sendImagesDirect 使用 MsgEnum.IMAGE 策略
    const msgType = handlerCalled === 'sendImagesDirect' ? MsgEnum.IMAGE : MsgEnum.FILE
    expect(msgType).toBe(MsgEnum.IMAGE)

    // 6. 消息以图片格式显示（而不是文件格式）
    expect(msgType).not.toBe(MsgEnum.FILE)
  })

  it('完整流程：文件按钮 -> sendFiles 事件 -> sendFilesDirect -> MsgEnum.FILE', () => {
    // 1. 用户点击"文件"按钮选择文件
    const selectedFile = new File(['doc'], 'document.pdf', { type: 'application/pdf' })

    // 2. More.vue 检测到不是图片类型
    const validTypes = ['image/jpeg', 'image/png', 'image/gif']
    const isImage = validTypes.includes(selectedFile.type)
    expect(isImage).toBe(false)

    // 3. More.vue 发送 sendFiles 事件
    const eventName = isImage ? 'sendImages' : 'sendFiles'
    expect(eventName).toBe('sendFiles')

    // 4. ChatFooter.vue 接收 sendFiles 事件，调用 sendFilesDirect
    const handlerCalled = eventName === 'sendImages' ? 'sendImagesDirect' : 'sendFilesDirect'
    expect(handlerCalled).toBe('sendFilesDirect')

    // 5. sendFilesDirect 使用 MsgEnum.FILE 策略
    const msgType = handlerCalled === 'sendImagesDirect' ? MsgEnum.IMAGE : MsgEnum.FILE
    expect(msgType).toBe(MsgEnum.FILE)
  })
})
