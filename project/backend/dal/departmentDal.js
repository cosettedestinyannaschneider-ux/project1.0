const db = require('./db')

const departmentDal = {
  async findAll() {
    const [rows] = await db.execute('SELECT * FROM departments ORDER BY id ASC')
    return rows
  },

  async findById(id) {
    const [rows] = await db.execute('SELECT * FROM departments WHERE id = ?', [id])
    return rows[0]
  },

  async create(name) {
    const [res] = await db.execute('INSERT INTO departments (name) VALUES (?)', [name])
    return res.insertId
  },

  async updateById(id, name) {
    await db.execute('UPDATE departments SET name = ? WHERE id = ?', [name, id])
  },

  async deleteById(id) {
    await db.execute('DELETE FROM departments WHERE id = ?', [id])
  },
}

module.exports = departmentDal
