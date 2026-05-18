/**
 * 统一响应格式工具
 * 规范：{ code: number, msg: string, data?: any }
 *
 * @created 2026-05-18
 */
const { ErrorCode } = require('./ErrorCode')

/**
 * 成功响应
 * @param {*} data    — 业务数据
 * @param {string} [msg] — 可选消息
 * @returns {{ code: 0, msg: string, data: * }}
 */
const success = (data = null, msg = 'ok') => ({
  code: ErrorCode.SUCCESS,
  msg,
  data,
})

/**
 * 失败响应
 * @param {number} code    — 错误码，来自 ErrorCode 枚举
 * @param {string} [msg]   — 错误消息（不传则使用默认消息）
 * @param {*}      [data]  — 可选附带数据
 * @returns {{ code: number, msg: string, data?: * }}
 */
const fail = (code, msg, data = null) => ({
  code,
  msg: msg || '服务器错误',
  data,
})

/**
 * Express 中间件：将 res.success / res.fail 挂载到响应对象
 */
const responseMiddleware = (req, res, next) => {
  res.success = (data, msg) => res.json(success(data, msg))
  res.fail = (code, msg, data) => res.json(fail(code, msg, data))
  next()
}

module.exports = { success, fail, responseMiddleware }
