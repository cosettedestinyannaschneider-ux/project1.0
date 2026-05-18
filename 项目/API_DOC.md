# 智检系统 API 接口文档

基础路径：`http://localhost:3000`

## 统一返回格式

```json
{ "code": 0, "msg": "ok", "data": {} }
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 0 = 成功；1xxx 认证；2xxx 参数；3xxx 业务；4xxx 资源；5xxx 服务器 |
| msg | string | 可读消息 |
| data | any | 业务数据（成功时返回） |

## 错误码对照表

| 码位 | 错误码 | 说明 |
|------|--------|------|
| 1xxx 认证 | 1001 | 未登录或登录已过期 |
| | 1002 | 用户名或密码错误 |
| | 1003 | 账户已被锁定 |
| | 1004 | 账户已被禁用 |
| | 1005 | 权限不足 |
| | 1006 | 仅限管理员操作 |
| 2xxx 参数 | 2001 | 缺少必要参数 |
| | 2002 | 参数格式不正确 |
| | 2003 | 用户名已存在 |
| | 2004 | 请上传文件 |
| | 2005 | 文件格式不支持 |
| 3xxx 业务 | 3001 | AI 服务暂时不可用 |
| | 3002 | 报告生成失败 |
| | 3003 | 图片处理失败 |
| 4xxx 资源 | 4001 | 资源不存在 |
| | 4003 | 未找到隐患照片 |
| | 4004 | 记录不存在 |
| 5xxx 服务 | 5001 | 服务器内部错误 |
| | 5002 | 数据库操作失败 |

---

## 0. 健康检查

### 0.1 服务状态
- **URL**: `GET /api/health`
- **返回**: `{ code: 0, msg: "Backend is running", data: { status: "running" } }`

---

## 1. 用户与认证模块

### 1.1 用户登录
- **URL**: `POST /api/login`
- **参数**: `username` (String), `password` (String)
- **成功**: `{ code: 0, data: { id, username, role, department_id } }`
- **失败**: `{ code: 1002/1003/1004, msg: "..." }`

### 1.2 用户注册
- **URL**: `POST /api/register`
- **参数**: `username` (String), `password` (String), `role` (String, 默认 "user"), `department_id` (Number, 可选)
- **成功**: `{ code: 0, msg: "注册成功" }`
- **失败**: `{ code: 2003, msg: "用户名已存在" }`

### 1.3 部门列表（公共）
- **URL**: `GET /api/departments/list`
- **返回**: `{ code: 0, data: [{ id, name, created_at }] }`

---

## 2. 企业信息管理

### 2.1 获取企业信息
- **URL**: `POST /api/enterprise/get`
- **参数**: `user_id` (Number)
- **返回**: `{ code: 0, data: { id, name, region, address, contact, phone, industry, enterprise_type, scale, inspector_name, inspection_date, ... } }`

### 2.2 更新企业信息
- **URL**: `POST /api/enterprise/update`
- **参数**: `user_id` (Number), `name` (String, 必填), `region`, `address`, `contact`, `phone`, `industry`, `enterprise_type`, `scale`, `inspector_name`, `inspection_date`

---

## 3. AI 巡检与处理

### 3.1 AI 智能巡检（单文件）
- **URL**: `POST /api/process`
- **方法**: `POST` (Multipart/form-data)
- **参数**: `user_id` (Number), `prompt` (String), `session_id` (String, 可选), `file` (File, 可选)
- **返回**: `{ code: 0, data: { result, wordPath, pdfPath, sessionId, id } }`

### 3.2 多图智能隐患分析
- **URL**: `POST /api/hazard/analyze`
- **方法**: `POST` (JSON)
- **参数**: `user_id` (Number), `prompt` (String, 可选), `session_id` (String, 可选), `image_ids` (Number[]), `enterprise_id` (Number, 可选)
- **返回**: `{ code: 0, data: { result, wordPath, pdfPath, sessionId, id } }`

### 3.3 编辑保存分析结果
- **URL**: `POST /api/history/update-result`
- **参数**: `id` (Number), `result` (String), `user_id` (Number)
- **返回**: `{ code: 0, data: { wordPath, pdfPath } }`

---

## 4. 会话管理

### 4.1 获取会话列表
- **URL**: `GET /api/sessions/:user_id`
- **返回**: `{ code: 0, data: [{ session_id, title, created_at }] }`

### 4.2 获取会话详情
- **URL**: `GET /api/session/:session_id`
- **返回**: `{ code: 0, data: [{ id, prompt, result, word_path, pdf_path, ... }] }`

### 4.3 删除会话
- **URL**: `POST /api/session/delete`
- **参数**: `session_id` (Number)

---

## 5. 隐患图片管理（9.5 模块）

### 5.1 上传隐患图片
- **URL**: `POST /api/hazard/images/upload`
- **方法**: `POST` (Multipart, 最多 9 张)
- **参数**: `user_id` (Number), `files` (File[]), `enterprise_id` (Number, 可选)

### 5.2 获取图片列表
- **URL**: `GET /api/hazard/images/list/:user_id`

### 5.3 删除图片（软删除）
- **URL**: `POST /api/hazard/images/delete`
- **参数**: `user_id` (Number), `id` (Number)

### 5.4 更新图片标签
- **URL**: `POST /api/hazard/images/label`
- **参数**: `user_id` (Number), `id` (Number), `label` (String)

---

## 6. 报告管理（9.7 模块）

### 6.1 删除报告记录
- **URL**: `POST /api/history/delete`
- **参数**: `user_id` (Number), `id` (Number)

### 6.2 查看历史记录
- **URL**: `GET /api/history/:user_id`

---

## 7. 知识库管理

### 7.1 知识列表
- **URL**: `GET /api/knowledge/list`
- **URL**: `GET /api/knowledge/categories/list`
- **返回**: `{ code: 0, data: [...] }`

### 7.2 上传知识文件
- **URL**: `POST /api/knowledge/upload`
- **方法**: `POST` (Multipart)
- **参数**: `title`, `description`, `category_id` (可选), `file`

### 7.3 更新/删除知识
- **URL**: `POST /api/knowledge/update` | `POST /api/knowledge/delete`

---

## 8. 管理员接口

> 鉴权：请求体携带 `admin_id`，或请求头 `X-Admin-Id`

### 8.1 用户管理
| 方法 | URL | 说明 |
|------|-----|------|
| POST | `/api/admin/users/list` | 用户列表（含部门、对话统计） |
| POST | `/api/admin/users/add` | 创建用户（含 department_id） |
| POST | `/api/admin/users/update` | 更新用户信息 |
| POST | `/api/admin/users/delete` | 禁用用户（软删除） |

### 8.2 部门管理
| 方法 | URL | 说明 |
|------|-----|------|
| POST | `/api/admin/departments/list` | 部门列表 |
| POST | `/api/admin/departments/add` | 新增部门 |
| POST | `/api/admin/departments/update` | 更新部门 |
| POST | `/api/admin/departments/delete` | 删除部门 |

### 8.3 知识库管理
| 方法 | URL | 说明 |
|------|-----|------|
| POST | `/api/admin/knowledge/list` | 知识库列表 |
| POST | `/api/admin/knowledge/add` | 上传知识文件 |
| POST | `/api/admin/knowledge/update` | 更新知识条目 |
| POST | `/api/admin/knowledge/delete` | 归档知识条目 |
| POST | `/api/admin/knowledge/categories/*` | 分类 CRUD |

### 8.4 AI 模型配置
| 方法 | URL | 说明 |
|------|-----|------|
| POST | `/api/admin/config/ai` | 当前激活的配置 |
| POST | `/api/admin/config/ai/list` | 全部配置列表 |
| POST | `/api/admin/config/ai/add` | 新增模型配置 |
| POST | `/api/admin/config/ai/update` | 更新模型配置 |
| POST | `/api/admin/config/ai/activate` | 激活指定配置 |
| POST | `/api/admin/config/ai/delete` | 删除配置 |

> 新增配置示例：`{ name, base_url, api_key, model_name, max_tokens?, temperature?, timeout_ms? }`

### 8.5 报告模板管理
| 方法 | URL | 说明 |
|------|-----|------|
| POST | `/api/admin/templates/list` | 模板列表 |
| POST | `/api/admin/templates/add` | 新增模板 |
| POST | `/api/admin/templates/update` | 更新模板 |
| POST | `/api/admin/templates/set-default` | 设为默认模板 |
| POST | `/api/admin/templates/delete` | 删除模板 |

### 8.6 操作日志
- **URL**: `POST /api/admin/logs/list`
- **返回**: 最近 500 条操作记录（含 IP 地址）

### 8.7 全量历史
- **URL**: `POST /api/admin/history`
- **返回**: 全量用户排查报告列表
