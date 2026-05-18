/**
 * 用户服务模块
 * 负责认证、授权、密码管理
 *
 * @created 2026-04-12
 * @updated 2026-05-18 — 增加账户锁定/登录追踪/部门关联
 */
const userDal = require('../dal/userDal')
const crypto = require('crypto')
const C = require('../common/Constants')

/** 判断密码字段是否为 scrypt 哈希格式 */
const isScryptHash = (value) => typeof value === 'string' && value.startsWith('scrypt$')

/**
 * 使用 scrypt 对密码加盐哈希
 * @param {string} plainPassword — 明文密码
 * @returns {Promise<string>} scrypt$salt$hash 格式字符串
 */
const hashPassword = async (plainPassword) => {
  const salt = crypto.randomBytes(C.PASSWORD_SALT_LENGTH).toString('hex')
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(plainPassword, salt, C.PASSWORD_HASH_LENGTH, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(derivedKey.toString('hex'))
    })
  })
  return `scrypt$${salt}$${hash}`
}

/**
 * 校验 scrypt 哈希
 * @param {string} plainPassword — 明文密码
 * @param {string} storedHash    — 存储的哈希值
 * @returns {Promise<boolean>}
 */
const verifyPassword = async (plainPassword, storedHash) => {
  if (!isScryptHash(storedHash)) return false
  const parts = storedHash.split('$')
  if (parts.length !== 3) return false
  const salt = parts[1]
  const hash = parts[2]
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(plainPassword, salt, C.PASSWORD_HASH_LENGTH, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(derivedKey.toString('hex'))
    })
  })
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'))
}

const userService = {
  /**
   * 用户登录（含账户锁定检测与自动迁移明文密码）
   *
   * @param {string} username — 用户名
   * @param {string} password — 明文密码
   * @returns {Promise<{success: boolean, user?: object, message?: string}>}
   */
  async login(username, password) {
    const user = await userDal.findByUsername(username)
    if (!user || !password) return { success: false, message: '用户名或密码错误' }

    // 检查账户状态
    if (user.status === C.STATUS_LOCKED && user.locked_until) {
      if (new Date(user.locked_until) > new Date()) {
        return { success: false, message: '账户已被锁定，请稍后再试' }
      }
      // 锁定期已过，自动解锁
      await userDal.resetLoginAttempts(user.id)
      user.status = C.STATUS_ACTIVE
    }
    if (user.status === C.STATUS_DISABLED) {
      return { success: false, message: '账户已被禁用' }
    }

    let passwordOk = false

    // 兼容旧明文密码：验证通过后自动迁移为哈希
    if (!isScryptHash(user.password)) {
      if (user.password !== password) {
        await userDal.incrementLoginAttempts(user.id)
        return { success: false, message: '用户名或密码错误' }
      }
      const nextHash = await hashPassword(password)
      await userDal.updatePassword(user.id, nextHash)
      passwordOk = true
    } else {
      passwordOk = await verifyPassword(password, user.password)
    }

    if (passwordOk) {
      await userDal.resetLoginAttempts(user.id)
      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          department_id: user.department_id,
        },
      }
    }

    // 登录失败：累计失败次数
    await userDal.incrementLoginAttempts(user.id)
    return { success: false, message: '用户名或密码错误' }
  },

  /**
   * 按 ID 获取用户
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async getUserById(id) {
    return await userDal.findById(id)
  },

  /**
   * 注册用户
   * @param {string} username      — 用户名
   * @param {string} password      — 明文密码
   * @param {string} role          — 角色 admin|user
   * @param {number} [departmentId] — 部门 ID
   * @returns {Promise<{success: boolean, message?: string}>}
   */
  async register(username, password, role, departmentId = null) {
    const existing = await userDal.findByUsername(username)
    if (existing) return { success: false, message: '用户名已存在' }
    const passwordHash = await hashPassword(password)
    await userDal.createUser(username, passwordHash, role, departmentId)
    return { success: true }
  },

  /**
   * 获取所有用户（管理员接口）
   * @param {number} adminId — 管理员 ID
   * @returns {Promise<Array>}
   * @throws {Error} 权限不足
   */
  async getAllUsers(adminId) {
    const admin = await userDal.findById(adminId)
    if (!admin || admin.role !== C.ROLE_ADMIN) throw new Error('权限不足')
    return await userDal.findAll()
  },

  /**
   * 管理员更新用户信息
   * @param {number} adminId      — 管理员 ID
   * @param {number} targetId     — 目标用户 ID
   * @param {string} username     — 新用户名
   * @param {string} password     — 新密码（空字符串表示不修改）
   * @param {string} role         — 角色
   * @param {number} [departmentId] — 部门 ID
   * @returns {Promise<{success: boolean}>}
   * @throws {Error} 权限不足
   */
  async updateUserInfo(adminId, targetId, username, password, role, departmentId = null) {
    const admin = await userDal.findById(adminId)
    if (!admin || admin.role !== C.ROLE_ADMIN) throw new Error('权限不足')
    const nextPassword = password ? await hashPassword(password) : ''
    await userDal.updateUser(targetId, username, nextPassword, role, departmentId)
    return { success: true }
  },

  /**
   * 禁用用户（软删除）
   * @param {number} adminId  — 管理员 ID
   * @param {number} targetId — 目标用户 ID
   * @throws {Error} 权限不足
   */
  async removeUser(adminId, targetId) {
    const admin = await userDal.findById(adminId)
    if (!admin || admin.role !== C.ROLE_ADMIN) throw new Error('权限不足')
    await userDal.deleteUser(targetId)
    return { success: true }
  },
}

module.exports = userService
