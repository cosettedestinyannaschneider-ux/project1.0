/**
 * AI 服务模块
 * 负责对接大模型（豆包/Ark），实现隐患智能分析与会话管理
 *
 * @created 2026-04-12
 * @updated 2026-05-18 — 会话持久化至 sessions 表，移除内存 Map
 */
const { OpenAI } = require('openai')
const fs = require('fs')
const pdfParse = require('pdf-parse')
const historyDal = require('../dal/historyDal')
const sessionDal = require('../dal/sessionDal')
const C = require('../common/Constants')
require('dotenv').config()

/** OpenAI 兼容客户端实例（豆包 Ark） */
const client = new OpenAI({
  baseURL: C.ARK_BASE_URL,
  apiKey: process.env.ARK_API_KEY,
})

/**
 * 根据文件扩展名推断图片 MIME 类型
 * @param {string} filePath — 文件路径
 * @returns {string} MIME 类型
 */
const inferImageMime = (filePath) => {
  const lower = String(filePath || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  return 'image/jpeg'
}

/**
 * 从 inspection_reports 表重建 AI 对话上下文
 * @param {string|null} sessionId — 会话 ID（null 则创建新会话）
 * @param {number|null} userId   — 用户 ID
 * @returns {Promise<{messages: Array, sessionId: string}>}
 */
const buildMessages = async (sessionId, userId) => {
  const messages = [{ role: 'system', content: C.SYSTEM_PROMPT }]

  if (sessionId) {
    const history = await historyDal.findBySessionId(sessionId)
    for (const item of history) {
      messages.push({ role: 'user', content: [{ type: 'text', text: item.prompt || '' }] })
      messages.push({ role: 'assistant', content: item.result })
    }
  } else {
    sessionId = Date.now().toString()
    if (userId) {
      try { await sessionDal.create(sessionId, userId) } catch (e) { /* 并发冲突忽略 */ }
    }
  }

  return { messages, sessionId }
}

const aiService = {
  /**
   * AI 处理入口（通用：文本 + 文件 + 隐患分析模式）
   *
   * @param {string}  prompt       — 用户输入
   * @param {string}  [filePath]   — 上传文件路径
   * @param {string}  [sessionId]  — 会话 ID
   * @param {boolean} [isInspection] — 是否为隐患分析模式
   * @returns {Promise<{result: string, sessionId: string}>}
   * @throws {Error} AI 服务异常
   */
  async processAI(prompt, filePath, sessionId = null, isInspection = false) {
    const actualSessionId = (sessionId && sessionId !== 'null' && sessionId !== 'undefined') ? sessionId : null

    let actualPrompt = prompt
    if (isInspection) {
      actualPrompt = `${prompt || '请进行智能隐患分析'}
【系统指令】：你现在必须对提供的描述/图片进行智能隐患分析。
请务必返回合法的JSON格式（不要带任何Markdown代码块，纯JSON字符串），包含以下三个字段：
- hazard_description: 隐患描述
- basis: 排查依据（法规/标准条款）
- suggestion: 整改建议
示例：{"hazard_description": "...", "basis": "...", "suggestion": "..."}`
    }

    // 组装多模态消息内容
    const userContent = []
    if (filePath) {
      if (filePath.toLowerCase().endsWith('.pdf')) {
        const dataBuffer = fs.readFileSync(filePath)
        const data = await pdfParse(dataBuffer)
        userContent.push({
          type: 'text',
          text: `[PDF内容开始]\n${data.text}\n[PDF内容结束]\n\n用户的问题是：${actualPrompt || '请分析这份PDF文档'}`,
        })
      } else if (C.ALLOWED_IMAGE_TYPES.test(filePath)) {
        const base64Image = fs.readFileSync(filePath, { encoding: 'base64' })
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        })
        userContent.push({ type: 'text', text: actualPrompt || '请描述这张图片的内容' })
      } else {
        userContent.push({ type: 'text', text: actualPrompt })
      }
    } else {
      userContent.push({ type: 'text', text: actualPrompt })
    }

    const { messages } = await buildMessages(actualSessionId)
    messages.push({ role: 'user', content: userContent })

    console.log('[AIService] Sending request to AI model...')
    try {
      const response = await client.chat.completions.create({
        model: process.env.ARK_MODEL,
        messages,
        max_tokens: C.AI_DEFAULT_MAX_TOKENS,
        temperature: C.AI_DEFAULT_TEMPERATURE,
      })

      const result = response.choices[0].message.content
      console.log('[AIService] Response received, length:', result?.length)
      return { result, sessionId: actualSessionId || Date.now().toString() }
    } catch (apiError) {
      console.error('[AIService] API error:', apiError)
      throw new Error(`AI 服务暂时不可用: ${apiError.message}`)
    }
  },

  /**
   * 9.6 智能隐患分析：多图一次性分析
   *
   * @param {object} params
   * @param {string} [params.prompt]       — 用户补充描述
   * @param {string} [params.sessionId]    — 会话 ID
   * @param {object} [params.enterprise]   — 企业信息对象
   * @param {Array<{id:number, absPath:string, label?:string, originalName?:string}>} params.images — 隐患图片列表
   * @param {number} [params.userId]       — 用户 ID
   * @returns {Promise<{result: string, sessionId: string}>}
   * @throws {Error} AI 服务异常
   */
  async processHazardImagesInspection(params) {
    const prompt = params?.prompt || ''
    let sessionId = (params?.sessionId && params.sessionId !== 'null' && params.sessionId !== 'undefined')
      ? params.sessionId : null
    const enterprise = params?.enterprise || null
    const images = Array.isArray(params?.images) ? params.images : []
    const userId = params?.userId || null

    const { messages, sessionId: resolvedSessionId } = await buildMessages(sessionId, userId)
    sessionId = resolvedSessionId

    // 组装多图内容
    const userContent = []
    images.forEach((img) => {
      const absPath = img?.absPath
      if (!absPath || !fs.existsSync(absPath)) return
      const mime = inferImageMime(absPath)
      const base64Image = fs.readFileSync(absPath, { encoding: 'base64' })
      userContent.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${base64Image}` } })
    })

    const enterpriseText = enterprise
      ? `企业信息：${enterprise.name || ''}，${enterprise.region || ''}${enterprise.address || ''}，联系人：${enterprise.contact || ''}，电话：${enterprise.phone || ''}`
      : '企业信息：未提供'

    const imageMetaText = images.length
      ? images.map((img, idx) => `#${idx + 1} image_id=${img.id} 名称=${img.originalName || ''} 标签=${img.label || ''}`.trim()).join('\n')
      : '无图片'

    const analysisInstruction = `${prompt || '请对这些隐患照片进行一次性智能隐患分析'}
【企业信息】${enterpriseText}
【图片清单】
${imageMetaText}
【系统指令】
你必须对每一张图片分别进行隐患分析，并返回合法的 JSON（不要带任何 Markdown 代码块，纯 JSON 字符串）。
返回结构必须为：
{
  "items": [
    { "image_id": 1, "hazard_description": "...", "basis": "...", "suggestion": "..." }
  ]
}
要求：
1) items 的数量必须等于图片数量
2) items 的顺序必须与图片清单一致
3) basis 要尽可能给出法规/标准条款依据（无法确定条款编号时可描述条款要点）`

    userContent.push({ type: 'text', text: analysisInstruction })
    messages.push({ role: 'user', content: userContent })

    console.log('[AIService] Sending hazard inspection request...')
    try {
      const response = await client.chat.completions.create({
        model: process.env.ARK_MODEL,
        messages,
        max_tokens: C.AI_DEFAULT_MAX_TOKENS,
        temperature: C.AI_INSPECTION_TEMPERATURE,
      })
      const result = response.choices[0].message.content
      console.log('[AIService] Hazard inspection response received.')
      return { result, sessionId }
    } catch (apiError) {
      console.error('[AIService] API error:', apiError)
      throw new Error(`AI 服务暂时不可用: ${apiError.message}`)
    }
  },

  /**
   * 归档会话（软删除）
   * @param {string} sessionId — 会话 ID
   */
  async clearSession(sessionId) {
    if (sessionId) {
      try { await sessionDal.archive(sessionId) } catch (e) { /* 忽略 */ }
    }
  },
}

module.exports = aiService
