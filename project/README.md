# 智检系统 (Smart Inspection System)

本项目是一个基于 **uni-app** 开发的 **安全生产社会服务平台**，一套代码同时支持 **网页版 (H5)** 和 **微信小程序**。系统通过接入 **豆包 (Doubao/Ark)** 等大模型，实现企业安全隐患的智能识别、风险分析与专业报告生成。

## 设计框架与架构

本系统按项目书要求采用“四层解耦架构”，确保前后端分离、AI 服务可独立扩展：

### 1. 前端层（uni-app：H5 + 微信小程序）
- **企业信息录入**：支持企业基础安全数据的标准化采集。
- **隐患图片上传**：支持现场隐患图片的拍摄与上传。
- **报告生成与下载**：一键生成 AI 分析后的 Word/PDF 巡检报告并支持本地下载。

### 2. 后端应用层（Node.js / Express）
- **用户权限管理 (RBAC)**：严格的管理员与普通用户角色权限隔离。
- **业务逻辑处理**：核心 AI 调度、会话状态维护及文件流转逻辑。
- **报告生成引擎**：基于 `pdfkit` 和 `docx` 的自动化报告排版与生成。

### 3. AI 服务层（Python RAG 微服务，建议拆分）
- **文档解析**：PDF/Word/图片解析为结构化文本块。
- **向量化**：分块文本 embedding 写入向量库。
- **检索**：query 检索证据片段，为大模型分析提供依据。
- **结构化生成**：输出结构化 JSON，便于报告模板落地。

### 4. 数据层（MySQL + 向量库 + 文件存储）
- **MySQL（业务数据）**：用户、角色、企业信息、会话历史、日志、系统配置等。
- **向量数据库（Chroma / Milvus）**：知识库向量检索。
- **文件存储（本地/对象存储）**：知识库文件、上传图片、生成报告等。

设计文档详见：[DESIGN_DOC.md](./DESIGN_DOC.md)
接口文档详见：[API_DOC.md](./API_DOC.md)
部署文档详见：[DEPLOY.md](./DEPLOY.md)
稳定演示版本说明详见：[STABLE_VERSION.md](./STABLE_VERSION.md)
数据库 DDl 详见：[database/schema.sql](./database/schema.sql)
ER 图详见：[../er-diagram.md](../er-diagram.md)

## 权限模型 (RBAC)

系统预设两个核心角色，所有操作行为均留痕记录：

| 角色类型 | 核心权限 | 操作限制 |
| :--- | :--- | :--- |
| **系统管理员** | 1. 账号全生命周期管理（CRUD、分配权限）；<br>2. 本地知识库维护（上传、修改、删除文档）；<br>3. 对接 AI 大模型配置；<br>4. 查看全量用户操作记录；<br>5. 拥有所有企业隐患排查数据权限。 | **最高权限角色**，无操作限制。 |
| **普通用户** | 1. 企业基本信息录入与编辑；<br>2. 现场隐患图片上传；<br>3. 触发 AI 智能分析隐患；<br>4. 查看并下载 Word 格式隐患排查报告；<br>5. 查看自身操作的历史记录。 | 仅能操作管理员分配的权限内容，**无法管理用户与知识库**。 |

## 技术栈

- **后端**：Node.js + Express + MySQL + 字节跳动 Ark/Doubao SDK
- **前端框架**：**uni-app (Vue 3 + Vite)**
- **UI 设计**：蓝白极简风格，响应式卡片设计
- **文档处理**：Word 模板填充 + Word 导出 PDF；`pdfkit` 作为 PDF 降级方案
- **字体支持**：内置 `simhei.ttf` 完美支持中文字符

## 目录结构

```
项目/
├── README.md                 ← 项目总览
├── DESIGN_DOC.md             ← 设计文档
├── API_DOC.md                ← 接口文档
├── DEPLOY.md                 ← 部署运维手册
├── database/
│   └── schema.sql            ← 数据库完整 DDL（12 表）
├── backend/                  ← Node.js 后端
│   ├── server.js             ← 主入口，REST API 路由
│   ├── common/               ← 公共模块
│   │   ├── Constants.js      ← 全局常量
│   │   ├── ErrorCode.js      ← 错误码枚举
│   │   └── Result.js         ← 统一响应格式 {code, msg, data}
│   ├── bll/                  ← 业务逻辑层
│   │   ├── aiService.js      ← AI 大模型对接
│   │   ├── docService.js     ← Word/PDF 报告生成
│   │   ├── knowledgeService.js
│   │   └── userService.js    ← 认证 + 账户安全
│   └── dal/                  ← 数据访问层
│       ├── db.js             ← MySQL 连接池
│       ├── schemaInit.js     ← 数据库自动迁移
│       ├── userDal.js        ← 12 个 DAL 模块...
│       └── ...
└── uni-app-frontend/         ← uni-app 前端（H5 + 微信小程序）
    └── pages/                ← login, index, process, admin, history, settings...
```

## 环境要求

- **Node.js**：16.x+
- **MySQL**：5.7+
- **HBuilderX** / **VS Code**
- **微信开发者工具**：用于调试小程序版

## 安装与运行

### 1. 后端服务 (Backend)

1. 进入 `backend` 目录：`cd backend`
2. 安装依赖：`npm install`
3. 配置环境变量：
   - 在 `backend` 目录下创建或修改 `.env` 文件。
   - 配置 MySQL 连接信息 (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)。
   - 配置 AI 密钥 (`ARK_API_KEY`, `ARK_MODEL`)。
4. 启动服务：`npm start` (默认运行在 3000 端口)。3000端口被占用：win11命令行执行:netstat -ano | findstr 3000   查看占用进程，终止后重试。=> taskkill /PID **** /F

### 2. 统一前端 (uni-app)

1. 使用 **VS Code** 或 **HBuilderX** 导入 `uni-app-frontend` 目录。
2. **安装依赖**：在 `uni-app-frontend` 目录下运行 `npm ci`（已提交 `package-lock.json`，可保证本地与 CI 依赖一致；仅在需要更新依赖时使用 `npm install`）。
3. **运行至网页 (H5) [重要]**：
   - 必须通过命令行运行：`npm run dev:h5`。
   - **严禁直接右键 open with live server 或直接打开 index.html**，否则 Vite 代理将失效，导致上传报错。
   - **跨域解决**：项目已配置 Vite 代理，H5 环境下会自动转发请求至 `localhost:3000`，无需手动修改 IP。
4. **运行至微信小程序**：
   - 运行命令：`npm run dev:mp-weixin`。
   - 使用 **微信开发者工具** 导入 `uni-app-frontend/unpackage/dist/dev/mp-weixin` 目录。
   - **注意**：小程序端如无法访问后端，请在登录页进入“服务器设置”填写电脑局域网 IP（开发联调），或使用已配置 HTTPS 的正式域名（真机/上线必需）。
5. **构建验证**：
   - H5 生产构建：`npm run build:h5`。
   - 微信小程序构建：`npm run build:mp-weixin`。
6. **重要配置**：在微信开发者工具中勾选“不校验合法域名”。

## 多端运行说明（H5 + 微信小程序）

- **H5 开发**：必须使用 `npm run dev:h5` 启动，依赖 Vite 代理转发 `/api` 与 `/uploads`。
- **H5 部署**：生产环境建议使用 Nginx 托管前端静态资源，并反向代理 `/api`、`/uploads` 到后端服务。
- **小程序开发联调**：可通过局域网 IP 访问后端；如 IP 变更或无法连接，请在登录页进入“服务器设置”配置后端地址并测试 `/api/health`。
- **小程序真机/上线**：必须使用 HTTPS 域名，并在微信公众平台配置 request/downloadFile 合法域名；HTTP 与内网 IP 会被限制。

## 核心功能

1. **多端统一**：一套代码同时支持网页和微信小程序，逻辑完全同步。
2. **Doubao 风格聊天**：
   - 支持历史会话侧边栏，可跳转、删除历史对话。
   - 支持连续对话，AI 具备上下文记忆功能。
3. **AI 智能处理**：支持纯文字提示、图片识别、文档链接等多模态处理。
4. **专业文档导出**：一键生成排版精美的 Word 和 PDF 文件，支持图片自动嵌入。
5. **管理员后台 (RBAC)**：
   - 用户管理：支持增删改查及对话次数统计。
   - 知识库管理 (RAG 准备)：支持上传 PDF/Docx 文件，支持修改标题/描述及更换文件。
6. **企业信息管理**：仅对普通用户开放；管理员登录后默认进入管理端，不显示企业信息录入与地区滑动选择。
7. **历史记录管理**：支持云端存储处理历史，随时查看及重新下载文档。
8. **隐患图片上传与管理**：支持普通用户多图上传、预览与删除，形成隐患图片档案（9.5 模块）。

## 接口文档 (API Documentation)

本项目的后端接口已完成详尽记录，请参阅：[API_DOC.md](./API_DOC.md)

### 核心接口概览
- **用户登录**: `POST /api/login`
- **企业信息更新**: `POST /api/enterprise/update`
- **AI 智能巡检**: `POST /api/process` (支持文本+图片)
- **知识库管理**: `POST /api/admin/knowledge/add`

## 更新日志 (Latest)

- **2026-05-18**:
  - **数据库重构**：6 表 → 12 表，新增 departments/sessions/inspection_reports/inspection_report_images/ai_model_configs/report_templates 六张表；enterprises 主键从 user_id 迁移为独立 id；全部表增加 FOREIGN KEY 约束与索引；数据库迁移脚本设为幂等（schemaInit.js）。
  - **统一返回格式**：所有 API 统一为 `{code, msg, data}` 格式，定义 4 位错误码体系；新增 common/Result.js、common/ErrorCode.js、common/Constants.js 公共模块。
  - **会话持久化**：AI 会话从内存 Map 迁移至 sessions 表，服务器重启不丢失。
  - **账户安全**：连续 5 次登录失败锁定 30 分钟；登录成功重置计数；支持账户状态管理（active/disabled/locked）。
  - **AI 模型动态配置**：新增 ai_model_configs 表，管理员可动态切换模型，不再硬编码 .env。
  - **企业信息增强**：新增 industry/enterprise_type/scale/inspector_name/inspection_date 字段。
  - **多图关联**：新增 inspection_report_images 中间表，建立报告到隐患图片的多对多关系。
  - **文档完善**：新增 DEPLOY.md（Docker/Nginx/PM2/安全加固），更新 API_DOC.md（错误码对照表 + 新路由），更新 README 目录结构。
  - **代码规范**：禁止硬编码，常量统一维护；关键节点日志统一前缀 [Server]/[AIService]；公共方法全部 JSDoc 注释。
- **2026-04-13**:
  - **管理员/普通用户分流**：管理员登录后默认进入管理端，普通用户进入智检页；管理员端不显示企业信息录入入口。
  - **小程序连通性**：新增“服务器设置”页面，可配置后端地址并测试 `/api/health`，解决多端 IP 变更导致的登录/注册失败。
  - **管理端鉴权修复**：管理端请求统一携带 `X-Admin-Id`，修复 H5 文件上传场景下因 multipart 解析时序导致的 401。
  - **密码显示图标统一**：登录/注册/管理端密码显示切换统一为眼睛图标（eye / eye-off）。
  - **H5 地区选择兼容**：H5 环境下地区选择暂用手动输入格式 `省-市-区`，避免 `picker mode="region"` 的运行告警。
  - **密码安全**：后端密码改为加盐哈希存储，并对历史明文密码登录进行自动迁移（登录成功后自动升级为哈希）。
  - **隐患图片模块**：新增隐患图片上传与管理接口与前端弹窗，支持多图上传/预览/删除（9.5）。
  - **H5 删除确认修复**：隐患图片删除在 H5 下改为内置确认弹窗，避免被全屏遮罩层覆盖导致“无反应”。
- **2026-04-12**:
  - **企业信息管理**：重构了企业信息录入弹窗，采用更符合移动端体验的专业表单布局，并新增了**省市区级联滑动选择器 (Region Picker)**，增加了必填项校验逻辑。
  - **代码注释强化**：对核心业务逻辑（企业管理、AI 分析、上传流程）补充了详尽的代码注释。
  - **UI 交互修复**：修复了侧边栏底部按钮在暗色背景下因颜色过浅而不可见的问题。
  - **接口文档同步**：新增 [API_DOC.md](./API_DOC.md) 详尽记录了所有业务接口，并同步更新了 README。
  - **H5 跨域优化**：配置 Vite Proxy 代理，解决 H5 环境下上传文件因跨域或 Private Network 限制导致的“网络请求失败”误报。
  - **上传逻辑重构**：针对 H5 环境，弃用 `uni.uploadFile`，改用标准的 `FormData` 发送请求，提升代理环境下的稳定性。
  - **管理后台修复**：修复了角色修改无效、知识库修改/添加点击无反应、数据库未定义等交互 Bug。
  - **交互增强**：管理后台增加操作加载提示 (`Loading`)，提升用户体验。
  - **代码规范**：统一将数据库操作下沉至 DAL 层，简化 Server 端逻辑。
  - **README 完善**：补充了 H5 必须通过 `npm run dev:h5` 启动的说明，避免代理失效。
  - **功能新增**：用户管理模块支持管理员修改用户密码（编辑时留空表示不修改）。
  - **架构对齐**：根据“智检系统”设计框架，在 README 中正式确立了三层架构与权限模型文档。




## 注意事项

- **网络连接**：小程序端需与后端处于同一局域网；如无法访问后端，请在登录页“服务器设置”中填写正确的局域网 IP/端口。
- **联调 IP**：当前电脑 WLAN IPv4 为 `192.168.1.66`，如果你使用的是其他网络，请以 `ipconfig` 输出为准更新“服务器设置”。
- **权限与注册**：注册默认创建普通用户账号；管理员账号建议由数据库初始化或管理员后台创建。
- **字体配置**：PDF 生成需依赖 `C:/Windows/Fonts/simhei.ttf`，请确保服务器端系统路径正确。
- **端口管理**：若提示端口 3000 被占用，请使用 `netstat -ano | findstr :3000` 结束相关进程。
