const db = require('./db')

const enterpriseDal = {
  async findByUserId(userId) {
    const [rows] = await db.execute('SELECT * FROM enterprises WHERE user_id = ? LIMIT 1', [userId])
    return rows[0]
  },

  async findById(id) {
    const [rows] = await db.execute('SELECT * FROM enterprises WHERE id = ?', [id])
    return rows[0]
  },

  async listByUserId(userId) {
    const [rows] = await db.execute(
      "SELECT * FROM enterprises WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC",
      [userId]
    )
    return rows
  },

  async createOrUpdate(userId, data) {
    const existing = await this.findByUserId(userId)
    if (existing) {
      const [res] = await db.execute(
        `UPDATE enterprises
         SET name = ?, region = ?, address = ?, contact = ?, phone = ?,
             industry = ?, enterprise_type = ?, scale = ?,
             inspector_name = ?, inspection_date = ?
         WHERE user_id = ?`,
        [
          data.name, data.region, data.address, data.contact, data.phone,
          data.industry || null, data.enterprise_type || null, data.scale || null,
          data.inspector_name || null, data.inspection_date || null,
          userId
        ]
      )
      return res
    } else {
      const [res] = await db.execute(
        `INSERT INTO enterprises
         (user_id, name, region, address, contact, phone,
          industry, enterprise_type, scale, inspector_name, inspection_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, data.name, data.region, data.address, data.contact, data.phone,
          data.industry || null, data.enterprise_type || null, data.scale || null,
          data.inspector_name || null, data.inspection_date || null
        ]
      )
      return res.insertId
    }
  },

  async findAll() {
    const [rows] = await db.execute(`
      SELECT e.*, u.username
      FROM enterprises e
      JOIN users u ON e.user_id = u.id
      ORDER BY e.updated_at DESC
    `)
    return rows
  },
}

module.exports = enterpriseDal
