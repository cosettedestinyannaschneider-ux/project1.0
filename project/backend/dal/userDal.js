const db = require('./db')

const userDal = {
  async findByUsername(username) {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username])
    return rows[0]
  },

  /**
   * 创建用户
   * @param {string} username
   * @param {string} password  哈希后的密码
   * @param {string} role
   * @param {number} [departmentId]
   */
  async createUser(username, password, role = 'user', departmentId = null) {
    const [result] = await db.execute(
      'INSERT INTO users (username, password, role, department_id) VALUES (?, ?, ?, ?)',
      [username, password, role, departmentId]
    )
    return result.insertId
  },

  async findAll() {
    const [rows] = await db.execute(
      `SELECT u.id, u.username, u.role, u.status, u.department_id,
              u.last_login_at, u.created_at,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id`
    )
    return rows
  },

  async updateUser(id, username, password, role, departmentId = null) {
    let sql = 'UPDATE users SET username = ?, role = ?, department_id = ?'
    let params = [username, role, departmentId]
    if (password) {
      sql += ', password = ?'
      params.push(password)
    }
    sql += ' WHERE id = ?'
    params.push(id)
    return await db.execute(sql, params)
  },

  async updatePassword(id, passwordHash) {
    return await db.execute('UPDATE users SET password = ? WHERE id = ?', [passwordHash, id])
  },

  /** 软禁用用户（不物理删除） */
  async deleteUser(id) {
    return await db.execute("UPDATE users SET status = 'disabled' WHERE id = ?", [id])
  },

  async findById(id) {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id])
    return rows[0]
  },

  /** 登录失败：累加失败次数，≥5 次则锁定 30 分钟 */
  async incrementLoginAttempts(id) {
    await db.execute(
      `UPDATE users SET login_attempts = login_attempts + 1,
        locked_until = IF(login_attempts + 1 >= 5, DATE_ADD(NOW(), INTERVAL 30 MINUTE), NULL),
        status = IF(login_attempts + 1 >= 5, 'locked', status)
       WHERE id = ?`,
      [id]
    )
  },

  /** 登录成功：重置失败计数，记录登录时间 */
  async resetLoginAttempts(id) {
    await db.execute(
      "UPDATE users SET login_attempts = 0, locked_until = NULL, status = 'active', last_login_at = NOW() WHERE id = ?",
      [id]
    )
  },

  async findByDepartment(deptId) {
    const [rows] = await db.execute('SELECT id, username, role, status FROM users WHERE department_id = ?', [deptId])
    return rows
  },
}

module.exports = userDal
