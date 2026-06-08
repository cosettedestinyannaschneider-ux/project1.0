/**
 * AI 服务模块
 * 负责对接大模型（豆包/DeepSeek/千问），实现隐患智能分析与会话管理
 *
 * @created 2026-04-12
 * @updated 2026-05-18 — 多模型动态切换，解除 .env 硬编码
 */
const { OpenAI } = require('openai')
const fs = require('fs')
const pdfParse = require('pdf-parse')
const historyDal = require('../dal/historyDal')
const sessionDal = require('../dal/sessionDal')
const aiModelConfigDal = require('../dal/aiModelConfigDal')
const C = require('../common/Constants')
require('dotenv').config()

/**
 * 创建 OpenAI 兼容客户端实例
 * @param {string} baseUrl — API 地址
 * @param {string} apiKey  — API 密钥
 * @returns {OpenAI}
 */
const createClient = (baseUrl, apiKey) => new OpenAI({ baseURL: baseUrl, apiKey })

/**
 * 获取当前激活的客户端（从 ai_model_configs 表读取）
 * 若无激活配置，降级使用 .env
 * @returns {Promise<{client: OpenAI, modelName: string, configId: number|null}>}
 */
const getActiveClient = async () => {
  const config = await aiModelConfigDal.findActive()
  if (config && config.api_key_encrypted && config.base_url) {
    return {
      client: createClient(config.base_url, config.api_key_encrypted),
      modelName: config.model_name,
      configId: config.id,
    }
  }
  // 降级：使用 .env
  return {
    client: createClient(C.ARK_BASE_URL, process.env.ARK_API_KEY || ''),
    modelName: process.env.ARK_MODEL || 'default',
    configId: null,
  }
}

/**
 * 按指定配置 ID 获取客户端
 * @param {number} modelId — ai_model_configs.id
 * @returns {Promise<{client: OpenAI, modelName: string, configId: number}>}
 */
const getClientById = async (modelId) => {
  const config = await aiModelConfigDal.findById(modelId)
  if (!config) throw new Error('模型配置不存在')
  return {
    client: createClient(config.base_url, config.api_key_encrypted),
    modelName: config.model_name,
    configId: config.id,
  }
}

/**
 * 根据文件扩展名推断图片 MIME 类型
 * @param {string} filePath — 文件路径
 * @returns {string}
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
 * 从 inspection_reports 表重建对话上下文
 * @param {string|null} sessionId
 * @param {number|null} userId
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
   * AI 处理入口（通用）
   *
   * @param {string}  prompt       — 用户输入
   * @param {string}  [filePath]   — 上传文件路径
   * @param {string}  [sessionId]  — 会话 ID
   * @param {boolean} [isInspection] — 是否隐患分析模式
   * @param {number}  [modelId]    — 指定模型配置 ID（可选，不传用激活模型）
   * @returns {Promise<{result: string, sessionId: string}>}
   */
  async processAI(prompt, filePath, sessionId = null, isInspection = false, modelId = null) {
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
        userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } })
        userContent.push({ type: 'text', text: actualPrompt || '请描述这张图片的内容' })
      } else {
        userContent.push({ type: 'text', text: actualPrompt })
      }
    } else {
      userContent.push({ type: 'text', text: actualPrompt })
    }

    const { messages } = await buildMessages(actualSessionId)
    messages.push({ role: 'user', content: userContent })

    // 多模型：按 modelId 或激活模型创建客户端
    const { client, modelName } = modelId
      ? await getClientById(modelId)
      : await getActiveClient()

    console.log(`[AIService] Using model: ${modelName}, sending request...`)
    try {
      const response = await client.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: C.AI_DEFAULT_MAX_TOKENS,
        temperature: C.AI_DEFAULT_TEMPERATURE,
      })
      const result = response.choices[0].message.content
      console.log(`[AIService] Response received, length: ${result?.length}`)
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
   * @param {string} [params.prompt]
   * @param {string} [params.sessionId]
   * @param {object} [params.enterprise]
   * @param {Array}  params.images
   * @param {number} [params.userId]
   * @param {number} [params.modelId]  — 指定模型配置 ID
   * @returns {Promise<{result: string, sessionId: string}>}
   */
  async processHazardImagesInspection(params) {
    const prompt = params?.prompt || ''
    let sessionId = (params?.sessionId && params.sessionId !== 'null' && params.sessionId !== 'undefined')
      ? params.sessionId : null
    const enterprise = params?.enterprise || null
    const images = Array.isArray(params?.images) ? params.images : []
    const userId = params?.userId || null
    const modelId = params?.modelId || null

    const { messages, sessionId: resolvedSessionId } = await buildMessages(sessionId, userId)
    sessionId = resolvedSessionId

    const userContent = []
    images.forEach((img) => {
      const absPath = img?.absPath
      if (!absPath || !fs.existsSync(absPath)) return
      const mime = inferImageMime(absPath)
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${fs.readFileSync(absPath, { encoding: 'base64' })}` },
      })
    })

    const enterpriseText = enterprise
      ? `企业信息：${enterprise.name || ''}，${enterprise.project_name ? '项目：' + enterprise.project_name + '，' : ''}${enterprise.region || ''}${enterprise.address || ''}，联系人：${enterprise.contact || ''}，电话：${enterprise.phone || ''}`
      : '企业信息：未提供'

    const imageMetaText = images.length
      ? images.map((img, idx) => `#${idx + 1} image_id=${img.id} 名称=${img.originalName || ''} 标签=${img.label || ''}`.trim()).join('\n')
      : '无图片'

    const analysisInstruction = `${prompt || '请对这些隐患照片进行一次性智能隐患分析'}
【企业信息】${enterpriseText}
【图片清单】
${imageMetaText}

【系统指令】
你是一名安全生产专家。你必须对每一张图片分别进行专业隐患分析，并根据你自身的专业知识搜索和引用真实的法规/标准条款。返回合法的 JSON（不要带任何 Markdown 代码块，纯 JSON 字符串）。

返回结构必须为：
{
  "items": [
    {
      "image_id": 1,
      "hazard_description": "现场隐患的具体描述",
      "hazard_level": "一般隐患或重大隐患",
      "suggestion": "整改建议（含所依据法规条款，格式：建议内容。（依据：《XX法》第X条/《GB XXXX-XXXX》第X.X节））",
      "responsibility": "责任归属单位/部门名称"
    }
  ],
  "reference_standards": ["本次排查实际引用的法规/标准全称列表"],
  "comprehensive_opinion": {
    "improvement_directions": [
      { "title": "改进方向标题", "content": "具体分析和建议内容（200-400字）" }
    ],
    "general_suggestions": "综合建议总结（200-400字）"
  }
}

严格要求：
1) items 数量必须等于图片数量，顺序必须与图片清单一致
2) hazard_level 由你根据隐患严重程度自主判断，只能填"一般隐患"或"重大隐患"
3) suggestion 必须是具体的、可操作的整改措施，并在此处引用所依据的具体法规条款
4) responsibility 填写隐患问题对应的责任单位/部门
5) reference_standards 列出本次分析实际引用的全部法规/标准，不要编造不存在的法规
6) comprehensive_opinion 必须结合本次发现的全部隐患来写，不要套用空泛模板
   - improvement_directions 给出 2-4 个安全管理改进方向，每个含标题和详细内容
   - general_suggestions 给出综合建议总结
7) 报告整体风格要求：严谨、专业、客观`

    userContent.push({ type: 'text', text: analysisInstruction })
    messages.push({ role: 'user', content: userContent })

    const { client, modelName } = modelId
      ? await getClientById(modelId)
      : await getActiveClient()

    console.log(`[AIService] Hazard inspection using model: ${modelName}`)
    try {
      const response = await client.chat.completions.create({
        model: modelName,
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
   * 归档会话
   * @param {string} sessionId
   */
  async clearSession(sessionId) {
    if (sessionId) {
      try { await sessionDal.archive(sessionId) } catch (e) { /* 忽略 */ }
    }
  },
}

module.exports = aiService
