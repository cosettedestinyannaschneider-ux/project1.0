const db = require('./db')

/**
 * 数据库结构初始化与迁移模块
 *
 * 采用渐进式 ALTER：对已有表只增列、不改列，所有操作通过 try/catch 保证幂等。
 * 服务器每次启动时执行，确保数据库结构与代码保持同步。
 */
const schemaInit = {
  async init() {
    console.log('[schemaInit] 开始检查数据库结构...')

    // FK 依赖顺序：departments → users → enterprises → sessions → inspection_reports
    //              → inspection_report_images → hazard_images → action_logs
    //              → knowledge_categories → knowledge
    //              → ai_model_configs → report_templates
    await this.step01_departments()
    await this.step02_users()
    await this.step03_enterprises()
    await this.step04_sessions()
    await this.step05_inspectionReports()
    await this.step06_inspectionReportImages()
    await this.step07_hazardImages()
    await this.step08_knowledgeCategories()
    await this.step09_knowledge()
    await this.step10_actionLogs()
    await this.step11_aiModelConfigs()
    await this.step12_reportTemplates()

    console.log('[schemaInit] 数据库结构检查完成')
  },

  /** 检查列是否存在 */
  async _hasColumn(table, column) {
    try {
      const [rows] = await db.execute(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`)
      return rows.length > 0
    } catch { return false }
  },

  /** 检查表是否存在 */
  async _hasTable(table) {
    try {
      const [rows] = await db.execute(`SHOW TABLES LIKE '${table}'`)
      return rows.length > 0
    } catch { return false }
  },

  /** 安全添加列：存在则跳过 */
  async _addColumn(table, colDef) {
    const colName = colDef.trim().split(/\s+/)[0].replace(/`/g, '')
    if (await this._hasColumn(table, colName)) return
    try { await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${colDef}`) }
    catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') console.warn(`[schemaInit] ${table}.${colName}: ${e.message}`) }
  },

  /** 安全添加索引：存在则跳过 */
  async _addIndex(table, indexName, indexDef) {
    try { await db.execute(`ALTER TABLE \`${table}\` ADD ${indexDef}`) }
    catch (e) { /* 索引已存在则忽略 */ }
  },

  /** 安全添加外键：存在则跳过 */
  async _addFK(table, fkName, fkDef) {
    try { await db.execute(`ALTER TABLE \`${table}\` ADD CONSTRAINT ${fkName} ${fkDef}`) }
    catch (e) { /* FK 已存在则忽略 */ }
  },

  // =========================================================================
  // Step 1: 部门表（立项书：用户需填写所属部门）
  // =========================================================================
  async step01_departments() {
    if (await this._hasTable('departments')) return
    await db.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id          INT           NOT NULL AUTO_INCREMENT,
        name        VARCHAR(100)  NOT NULL,
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_departments_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    await db.execute(`INSERT IGNORE INTO departments (id, name) VALUES
      (1, '安全管理部'), (2, '技术排查部'), (3, '综合管理部')`)
    console.log('[schemaInit] departments 已创建')
  },

  // =========================================================================
  // Step 2: 用户表（增强安全字段）
  // =========================================================================
  async step02_users() {
    // 新增字段
    for (const colDef of [
      'department_id INT DEFAULT NULL',
      "status VARCHAR(20) NOT NULL DEFAULT 'active'",
      'login_attempts INT NOT NULL DEFAULT 0',
      'locked_until DATETIME DEFAULT NULL',
      'last_login_at DATETIME DEFAULT NULL',
      'created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
      'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ]) {
      await this._addColumn('users', colDef)
    }

    // 索引
    await this._addIndex('users', 'uk_users_username', 'UNIQUE KEY uk_users_username (username)')
    await this._addIndex('users', 'idx_users_role', 'KEY idx_users_role (role)')
    await this._addIndex('users', 'idx_users_department_id', 'KEY idx_users_department_id (department_id)')

    // 修改 password 为 VARCHAR(255) 以容纳 scrypt 哈希
    try { await db.execute("ALTER TABLE users MODIFY password VARCHAR(255) NOT NULL COMMENT 'scrypt加盐哈希'") }
    catch (e) { /* 忽略 */ }

    // 外键（departments 表必须已存在）
    await this._addFK('users', 'fk_users_department',
      'FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL ON UPDATE CASCADE')
  },

  // =========================================================================
  // Step 3: 企业表（PK 从 user_id 迁移到独立 id）
  // =========================================================================
  async step03_enterprises() {
    const hasId = await this._hasColumn('enterprises', 'id')

    if (!hasId) {
      // 先删除旧主键（user_id），再添加自增 id 作为新主键
      try { await db.execute('ALTER TABLE enterprises DROP PRIMARY KEY') } catch (e) { /* 可能没有主键 */ }
      try { await db.execute('ALTER TABLE enterprises MODIFY user_id INT NOT NULL') } catch (e) { /* 已经是 INT */ }
      try { await db.execute('ALTER TABLE enterprises ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST') }
      catch (e) { console.warn('[schemaInit] enterprises 添加 id 列失败:', e.message) }
    }

    // 新增业务字段
    for (const colDef of [
      'industry VARCHAR(100) DEFAULT NULL',
      'enterprise_type VARCHAR(100) DEFAULT NULL',
      'scale VARCHAR(50) DEFAULT NULL',
      'production_process TEXT DEFAULT NULL',
      'inspector_name VARCHAR(100) DEFAULT NULL',
      'inspection_date DATE DEFAULT NULL',
      'project_name VARCHAR(200) DEFAULT NULL',
      "status VARCHAR(20) NOT NULL DEFAULT 'active'",
      'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ]) {
      await this._addColumn('enterprises', colDef)
    }

    // 索引
    await this._addIndex('enterprises', 'idx_enterprises_name', 'KEY idx_enterprises_name (name(100))')
    await this._addIndex('enterprises', 'idx_enterprises_region', 'KEY idx_enterprises_region (region(100))')
    await this._addIndex('enterprises', 'idx_enterprises_status', 'KEY idx_enterprises_status (status)')

    // 外键
    await this._addFK('enterprises', 'fk_enterprises_user',
      'FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE')
  },

  // =========================================================================
  // Step 4: 会话表（替代内存 Map）
  // =========================================================================
  async step04_sessions() {
    if (await this._hasTable('sessions')) return
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          VARCHAR(64)   NOT NULL,
        user_id     INT           NOT NULL,
        title       VARCHAR(200)  DEFAULT '新对话',
        status      VARCHAR(20)   NOT NULL DEFAULT 'active',
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sessions_user_id (user_id),
        KEY idx_sessions_created_at (created_at),
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    console.log('[schemaInit] sessions 已创建')
  },

  // =========================================================================
  // Step 5: 排查报告表（原 results 表重命名并增强）
  // =========================================================================
  async step05_inspectionReports() {
    const hasResults = await this._hasTable('results')
    const hasReports = await this._hasTable('inspection_reports')

    if (hasResults && !hasReports) {
      // 重命名旧表
      try { await db.execute('RENAME TABLE results TO inspection_reports') }
      catch (e) { console.warn('[schemaInit] 重命名 results → inspection_reports 失败:', e.message) }
    }

    // 如果是全新环境，创建 inspection_reports 表
    if (!hasResults && !hasReports) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS inspection_reports (
          id              INT           NOT NULL AUTO_INCREMENT,
          user_id         INT           NOT NULL,
          enterprise_id   INT           DEFAULT NULL,
          session_id      VARCHAR(64)   DEFAULT NULL,
          title           VARCHAR(300)  DEFAULT NULL,
          prompt          TEXT          DEFAULT NULL,
          result          LONGTEXT      DEFAULT NULL,
          word_path       VARCHAR(500)  DEFAULT NULL,
          pdf_path        VARCHAR(500)  DEFAULT NULL,
          image_path      VARCHAR(500)  DEFAULT NULL,
          status          VARCHAR(20)   NOT NULL DEFAULT 'completed',
          created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_ir_user_id (user_id),
          KEY idx_ir_session_id (session_id),
          KEY idx_ir_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    }

    // 为已有 inspection_reports 表添加新列
    if (hasReports || hasResults) {
      for (const colDef of [
        'enterprise_id INT DEFAULT NULL',
        'title VARCHAR(300) DEFAULT NULL',
        "status VARCHAR(20) NOT NULL DEFAULT 'completed'",
        'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      ]) {
        await this._addColumn('inspection_reports', colDef)
      }
      // 确保 session_id 迁移无问题的索引
      await this._addIndex('inspection_reports', 'idx_ir_enterprise_id', 'KEY idx_ir_enterprise_id (enterprise_id)')
      await this._addIndex('inspection_reports', 'idx_ir_status', 'KEY idx_ir_status (status)')
    }

    // 外键
    await this._addFK('inspection_reports', 'fk_ir_user',
      'FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE')
    await this._addFK('inspection_reports', 'fk_ir_enterprise',
      'FOREIGN KEY (enterprise_id) REFERENCES enterprises (id) ON DELETE SET NULL ON UPDATE CASCADE')
    await this._addFK('inspection_reports', 'fk_ir_session',
      'FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE SET NULL ON UPDATE CASCADE')
  },

  // =========================================================================
  // Step 6: 报告-图片中间表（支持多图分析）
  // =========================================================================
  async step06_inspectionReportImages() {
    if (await this._hasTable('inspection_report_images')) return
    await db.execute(`
      CREATE TABLE IF NOT EXISTS inspection_report_images (
        id          INT           NOT NULL AUTO_INCREMENT,
        report_id   INT           NOT NULL,
        image_id    INT           NOT NULL,
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_report_image (report_id, image_id),
        KEY idx_iri_image_id (image_id),
        CONSTRAINT fk_iri_report FOREIGN KEY (report_id) REFERENCES inspection_reports (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_iri_image FOREIGN KEY (image_id) REFERENCES hazard_images (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    console.log('[schemaInit] inspection_report_images 已创建')
  },

  // =========================================================================
  // Step 7: 隐患图片表（增强字段）
  // =========================================================================
  async step07_hazardImages() {
    // 确保表存在（旧项目可能还没有这张表）
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS hazard_images (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          file_path VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NULL,
          file_size INT NULL,
          label VARCHAR(100) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_hazard_images_user_id (user_id),
          INDEX idx_hazard_images_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    } catch (e) { /* 表已存在 */ }

    // 新增列
    for (const colDef of [
      'enterprise_id INT DEFAULT NULL',
      'image_width INT UNSIGNED DEFAULT NULL',
      'image_height INT UNSIGNED DEFAULT NULL',
      'hazard_type VARCHAR(100) DEFAULT NULL',
      "status VARCHAR(20) NOT NULL DEFAULT 'active'",
      'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ]) {
      await this._addColumn('hazard_images', colDef)
    }

    // file_size 类型改为 BIGINT（从 INT 扩展）
    try { await db.execute('ALTER TABLE hazard_images MODIFY file_size BIGINT UNSIGNED DEFAULT NULL') }
    catch (e) { /* 忽略 */ }

    // 索引
    await this._addIndex('hazard_images', 'idx_hi_enterprise_id', 'KEY idx_hi_enterprise_id (enterprise_id)')
    await this._addIndex('hazard_images', 'idx_hi_hazard_type', 'KEY idx_hi_hazard_type (hazard_type)')
    await this._addIndex('hazard_images', 'idx_hi_status', 'KEY idx_hi_status (status)')

    // 外键
    await this._addFK('hazard_images', 'fk_hi_user',
      'FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE')
    await this._addFK('hazard_images', 'fk_hi_enterprise',
      'FOREIGN KEY (enterprise_id) REFERENCES enterprises (id) ON DELETE SET NULL ON UPDATE CASCADE')
  },

  // =========================================================================
  // Step 8: 知识库分类表（补字段）
  // =========================================================================
  async step08_knowledgeCategories() {
    // 确保表存在
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          sort INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_knowledge_categories_name (name),
          INDEX idx_knowledge_categories_sort (sort)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    } catch (e) { /* 已存在 */ }

    for (const colDef of [
      'description VARCHAR(500) DEFAULT NULL',
      'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ]) {
      await this._addColumn('knowledge_categories', colDef)
    }

    // 种子数据
    const categories = [
      '煤矿安全', '非煤矿山安全', '危险化学品与化工安全', '建筑施工安全',
      '消防安全', '特种设备安全', '交通运输安全', '工贸行业安全',
      '电力安全', '石油天然气安全', '农林牧渔安全', '职业健康与劳动安全',
      '应急与事故管理', '其他专项安全', '安全生产隐患排查报告'
    ]
    for (let i = 0; i < categories.length; i++) {
      try { await db.execute('INSERT IGNORE INTO knowledge_categories (name, sort) VALUES (?, ?)', [categories[i], i + 1]) }
      catch (e) { /* 忽略 */ }
    }
  },

  // =========================================================================
  // Step 9: 知识库条目表（补字段）
  // =========================================================================
  async step09_knowledge() {
    // 确保表存在
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS knowledge (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          file_path VARCHAR(255) DEFAULT NULL,
          description TEXT DEFAULT NULL,
          category_id INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    } catch (e) { /* 已存在 */ }

    for (const colDef of [
      'file_size BIGINT UNSIGNED DEFAULT NULL',
      'file_type VARCHAR(20) DEFAULT NULL',
      "status VARCHAR(20) NOT NULL DEFAULT 'active'",
      'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ]) {
      await this._addColumn('knowledge', colDef)
    }

    await this._addIndex('knowledge', 'idx_knowledge_status', 'KEY idx_knowledge_status (status)')
    await this._addIndex('knowledge', 'idx_knowledge_title', 'KEY idx_knowledge_title (title(100))')

    // 外键
    await this._addFK('knowledge', 'fk_knowledge_category',
      'FOREIGN KEY (category_id) REFERENCES knowledge_categories (id) ON DELETE SET NULL ON UPDATE CASCADE')
  },

  // =========================================================================
  // Step 10: 操作日志表（补字段）
  // =========================================================================
  async step10_actionLogs() {
    // 确保表存在
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS action_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          details TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
    } catch (e) { /* 已存在 */ }

    await this._addColumn('action_logs', 'ip_address VARCHAR(45) DEFAULT NULL')
    await this._addIndex('action_logs', 'idx_al_action', 'KEY idx_al_action (action)')
    await this._addIndex('action_logs', 'idx_al_created_at', 'KEY idx_al_created_at (created_at)')

    await this._addFK('action_logs', 'fk_al_user',
      'FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE')
  },

  // =========================================================================
  // Step 11: AI 模型配置表（替代 .env 硬编码）
  // =========================================================================
  async step11_aiModelConfigs() {
    if (await this._hasTable('ai_model_configs')) return
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ai_model_configs (
        id                INT           NOT NULL AUTO_INCREMENT,
        name              VARCHAR(100)  NOT NULL,
        base_url          VARCHAR(500)  NOT NULL,
        api_key_encrypted VARCHAR(500)  NOT NULL,
        model_name        VARCHAR(100)  NOT NULL,
        is_active         TINYINT(1)    NOT NULL DEFAULT 0,
        max_tokens        INT           NOT NULL DEFAULT 4096,
        temperature       DECIMAL(3,2)  NOT NULL DEFAULT 0.70,
        timeout_ms        INT           NOT NULL DEFAULT 60000,
        created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_amc_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    // 从 .env 读取当前配置写入种子数据
    const baseUrl = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
    const apiKey = process.env.ARK_API_KEY || ''
    const model = process.env.ARK_MODEL || 'deepseek-v3'
    try {
      await db.execute(
        'INSERT IGNORE INTO ai_model_configs (name, base_url, api_key_encrypted, model_name, is_active) VALUES (?, ?, ?, ?, 1)',
        ['default', baseUrl, apiKey, model]
      )
    } catch (e) { /* 忽略 */ }
    console.log('[schemaInit] ai_model_configs 已创建')
  },

  // =========================================================================
  // Step 12: 报告模板表（立项书 §四(七)）
  // =========================================================================
  async step12_reportTemplates() {
    if (await this._hasTable('report_templates')) return
    await db.execute(`
      CREATE TABLE IF NOT EXISTS report_templates (
        id          INT           NOT NULL AUTO_INCREMENT,
        name        VARCHAR(200)  NOT NULL,
        file_path   VARCHAR(500)  DEFAULT NULL,
        description TEXT          DEFAULT NULL,
        is_default  TINYINT(1)    NOT NULL DEFAULT 0,
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    console.log('[schemaInit] report_templates 已创建')
  },
}

module.exports = schemaInit
