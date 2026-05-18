<template>
  <view class="admin-container">
    <!-- 顶部 Tab 切换 -->
    <view class="admin-tabs">
      <view 
        class="tab-item" 
        :class="{ 'tab-active': activeTab === 'users' }" 
        @click="activeTab = 'users'"
      >用户管理</view>
      <view 
        class="tab-item" 
        :class="{ 'tab-active': activeTab === 'knowledge' }" 
        @click="activeTab = 'knowledge'"
      >安全生产知识库</view>
      <view 
        class="tab-item" 
        :class="{ 'tab-active': activeTab === 'logs' }" 
        @click="activeTab = 'logs'"
      >操作日志</view>
      <view 
        class="tab-item" 
        :class="{ 'tab-active': activeTab === 'config' }" 
        @click="activeTab = 'config'"
      >模型配置</view>
    </view>

    <!-- 用户管理面板 -->
    <view v-if="activeTab === 'users'" class="panel">
      <view class="panel-header">
        <text class="panel-title">系统注册用户 ({{ userList.length }})</text>
        <button class="mini-btn add-btn" @click="showAddUserModal = true">添加用户</button>
      </view>

      <view class="user-list">
        <view v-for="u in userList" :key="u.id" class="user-card card">
          <view class="user-main">
            <view class="user-info-row">
              <text class="user-name">{{ u.username }}</text>
              <text class="role-badge" :class="u.role === 'admin' ? 'badge-admin' : 'badge-user'">
                {{ u.role === 'admin' ? '管理员' : '检查员' }}
              </text>
            </view>
            <view class="user-stats">
              <text class="stat-text">检查次数: {{ u.chatCount || 0 }}</text>
              <text class="stat-text">注册时间: {{ formatDate(u.created_at) }}</text>
            </view>
          </view>
          <view class="user-actions">
            <button class="mini-btn edit-btn" @click="openEditModal(u)">编辑</button>
            <button class="mini-btn delete-btn" @click="handleDeleteUser(u)">删除</button>
          </view>
        </view>
      </view>
    </view>

    <!-- 知识库管理面板 -->
    <view v-if="activeTab === 'knowledge'" class="panel">
      <view class="panel-header">
        <text class="panel-title">安全标准规范 ({{ knowledgeList.length }})</text>
        <view class="panel-actions">
          <button class="mini-btn" @click="openCategoryModal">分类管理</button>
          <button class="mini-btn add-btn" @click="showAddKnowledgeModal = true">上传规范</button>
        </view>
      </view>

      <view class="knowledge-filter">
        <text class="filter-label">按分类查看</text>
        <picker mode="selector" :range="categoryFilterOptions" range-key="name" @change="onKnowledgeFilterChange">
          <view class="picker-value">
            {{ activeCategoryName }}
          </view>
        </picker>
      </view>

      <view class="knowledge-list">
        <view v-for="g in displayedKnowledgeGroups" :key="g.key" class="knowledge-group">
          <view class="group-header" @click="toggleGroup(g.key)">
            <text class="group-title">{{ g.name }} ({{ g.items.length }})</text>
            <text class="group-toggle">{{ collapsedGroupKeys.includes(g.key) ? '展开' : '收起' }}</text>
          </view>
          <view v-if="!collapsedGroupKeys.includes(g.key)">
            <view v-for="k in g.items" :key="k.id" class="knowledge-card card">
              <view class="k-info">
                <text class="k-title">{{ k.title }}</text>
                <text class="k-desc">{{ k.description || '暂无描述' }}</text>
                <text class="k-path">文件: {{ k.file_path }}</text>
              </view>
              <view class="k-actions">
                <button class="mini-btn edit-btn" @click="openEditKnowledgeModal(k)">修改</button>
                <button class="mini-btn delete-btn" @click="handleDeleteKnowledge(k.id)">删除</button>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 操作日志面板 -->
    <view v-if="activeTab === 'logs'" class="panel">
      <view class="panel-header">
        <text class="panel-title">全量用户操作记录</text>
        <button class="mini-btn" @click="fetchLogs">刷新</button>
      </view>
      <view class="log-list">
        <view v-for="log in logList" :key="log.id" class="log-card card">
          <view class="log-main">
            <text class="log-user">{{ log.username }}</text>
            <text class="log-action">{{ log.action }}</text>
            <text class="log-time">{{ formatDate(log.created_at) }}</text>
          </view>
          <text class="log-details">{{ log.details }}</text>
        </view>
      </view>
    </view>

    <!-- 模型配置面板 -->
    <view v-if="activeTab === 'config'" class="panel">
      <view class="panel-header">
        <text class="panel-title">AI 大模型接口配置</text>
      </view>
      <view class="config-card card">
        <view class="form-item">
          <text class="label">Ark API Key</text>
          <view class="password-input-wrapper">
            <input class="modal-input" v-model="aiConfig.apiKey" type="text" :password="!showApiKey" placeholder="请输入 API Key" />
            <image
              class="toggle-password-icon"
              :src="showApiKey ? '/static/icons/eye-off.png' : '/static/icons/eye.png'"
              @tap="showApiKey = !showApiKey"
            />
          </view>
        </view>
        <view class="form-item">
          <text class="label">Ark Model ID</text>
          <input class="modal-input" v-model="aiConfig.model" placeholder="请输入模型 ID" />
        </view>
        <button class="modal-btn confirm" @click="saveAiConfig">保存配置</button>
      </view>
    </view>

    <!-- 添加/编辑用户弹窗 -->
    <view v-if="showAddUserModal || showEditUserModal" class="modal-mask" @click="closeUserModal">
      <view class="modal-content" @click.stop="">
        <text class="modal-title">{{ showEditUserModal ? '编辑用户' : '添加新用户' }}</text>
        <view class="modal-body">
          <input class="modal-input" v-model="userForm.username" placeholder="用户名" />
          <view class="password-input-wrapper">
            <input
              class="modal-input"
              v-model="userForm.password"
              type="text"
              :password="!showUserPassword"
              :placeholder="showEditUserModal ? '新密码 (留空不修改)' : '初始密码'"
            />
            <image
              class="toggle-password-icon"
              :src="showUserPassword ? '/static/icons/eye-off.png' : '/static/icons/eye.png'"
              @tap="showUserPassword = !showUserPassword"
            />
          </view>
          <view class="role-selector">
            <text class="label">选择角色：</text>
            <radio-group class="radio-group" @change="onRoleChange">
              <label class="radio-label">
                <radio value="user" :checked="userForm.role === 'user'" /> 普通用户
              </label>
              <label class="radio-label">
                <radio value="admin" :checked="userForm.role === 'admin'" /> 管理员
              </label>
            </radio-group>
          </view>
        </view>
        <view class="modal-btns">
          <button class="modal-btn cancel" @click="closeUserModal">取消</button>
          <button class="modal-btn confirm" @click="saveUser">保存</button>
        </view>
      </view>
    </view>

    <!-- 添加知识弹窗 -->
    <view v-if="showAddKnowledgeModal || showEditKnowledgeModal" class="modal-mask" @click="closeKnowledgeModal">
      <view class="modal-content" @click.stop="">
        <text class="modal-title">{{ showEditKnowledgeModal ? '修改知识条目' : '添加知识库文件' }}</text>
        <view class="modal-body">
          <input class="modal-input" v-model="knowledgeForm.title" placeholder="标题" />
          <textarea class="modal-input-area" v-model="knowledgeForm.description" placeholder="描述信息" />
          <view class="form-item">
            <text class="label">分类</text>
            <picker mode="selector" :range="categoryPickerOptions" range-key="name" @change="onCategoryChange">
              <view class="picker-value">
                {{ selectedCategoryName }}
              </view>
            </picker>
          </view>
          
          <view class="file-picker-section">
            <!-- #ifdef H5 -->
            <button class="modal-btn file-btn" @click="handleSelectFile">
              {{ knowledgeForm.file ? '已选择: ' + knowledgeForm.file.name : (showEditKnowledgeModal ? '更换文件(可选)' : '选择 PDF/Docx 文件') }}
            </button>
            <!-- #endif -->
            
            <!-- #ifndef H5 -->
            <button class="modal-btn file-btn" @click="handleChooseMessageFile">
              {{ knowledgeForm.tempFilePath ? '已选择文件' : (showEditKnowledgeModal ? '更换微信聊天文件(可选)' : '选择微信聊天文件') }}
            </button>
            <!-- #endif -->
          </view>
        </view>

        <view class="modal-btns">
          <button class="modal-btn cancel" @click="closeKnowledgeModal">取消</button>
          <button class="modal-btn confirm" @click="saveKnowledge">确定</button>
        </view>
      </view>
    </view>

    <!-- 知识库分类管理弹窗 -->
    <view v-if="showCategoryModal" class="modal-mask" @click="closeCategoryModal">
      <view class="modal-content" @click.stop="">
        <text class="modal-title">知识库分类管理</text>
        <view class="modal-body">
          <input class="modal-input" v-model="categoryForm.name" placeholder="分类名称" />
          <input class="modal-input" v-model="categoryForm.sort" placeholder="排序(数字，可选)" type="number" />
          <view class="modal-btns">
            <button class="modal-btn cancel" @click="resetCategoryForm">清空</button>
            <button class="modal-btn confirm" @click="saveCategory">{{ categoryForm.id ? '更新' : '新增' }}</button>
          </view>
          <view style="height: 12px;"></view>
          <scroll-view scroll-y class="category-list" :scroll-with-animation="true">
            <view v-for="c in categoryList" :key="c.id" class="category-row">
              <view class="category-main" @click="editCategory(c)">
                <text class="category-name">{{ c.name }}</text>
                <text class="category-sort">排序: {{ c.sort }}</text>
              </view>
              <button class="mini-btn delete-btn" @click.stop="deleteCategory(c)">删除</button>
            </view>
          </scroll-view>
        </view>
        <view class="modal-btns">
          <button class="modal-btn confirm" @click="closeCategoryModal">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { apiUrl, normalizeUser } from '../../common/api-config'

const user = ref({})
const activeTab = ref('users')
const userList = ref([])
const knowledgeList = ref([])
const logList = ref([])
const aiConfig = ref({ apiKey: '', model: '' })
const categoryList = ref([])
const activeCategoryId = ref('all')
const collapsedGroupKeys = ref([])

// 弹窗状态
const showAddUserModal = ref(false)
const showEditUserModal = ref(false)
const showAddKnowledgeModal = ref(false)
const showEditKnowledgeModal = ref(false)
const showCategoryModal = ref(false)

const userForm = ref({ id: null, username: '', password: '', role: 'user' })
const knowledgeForm = ref({ id: null, title: '', description: '', category_id: null, file: null, tempFilePath: '' })
const categoryForm = ref({ id: null, name: '', sort: '' })
const showUserPassword = ref(false)
const showApiKey = ref(false)

/**
 * 管理员接口鉴权：统一通过 header 传递 admin_id
 * 兼容 multipart/form-data 场景（文件上传时 body 可能尚未解析）
 */
const getAdminHeaders = () => ({ 'x-admin-id': String(user.value.id || '') })

onMounted(() => {
  const storedUser = normalizeUser(uni.getStorageSync('user'))
  if (storedUser && storedUser.role === 'admin' && storedUser.id) {
    user.value = storedUser
    fetchUsers()
    fetchKnowledge()
    fetchCategories()
    fetchLogs()
    fetchAiConfig()
  } else {
    uni.removeStorageSync('user')
    uni.reLaunch({ url: '/pages/login/login' })
  }
})

const fetchUsers = () => {
  uni.request({
    url: apiUrl('/api/admin/users/list'),
    method: 'POST',
    header: getAdminHeaders(),
    data: { admin_id: user.value.id },
    success: (res) => {
      if (res.data.success) userList.value = res.data.data
    },
    fail: (err) => {
      console.error('Fetch users failed:', err)
      uni.showToast({ title: '用户列表加载失败', icon: 'none' })
    }
  })
}

const fetchKnowledge = () => {
  uni.request({
    url: apiUrl('/api/admin/knowledge/list'),
    method: 'POST',
    header: getAdminHeaders(),
    data: { admin_id: user.value.id },
    success: (res) => {
      if (res.data.success) knowledgeList.value = res.data.data
    },
    fail: (err) => {
      console.error('Fetch knowledge failed:', err)
      uni.showToast({ title: '知识库加载失败', icon: 'none' })
    }
  })
}

const categoryPickerOptions = computed(() => {
  return [{ id: 0, name: '未分类' }, ...(categoryList.value || [])]
})

/**
 * 获取知识库分类（用于上传选择与分类管理）
 */
const fetchCategories = () => {
  uni.request({
    url: apiUrl('/api/admin/knowledge/categories/list'),
    method: 'POST',
    header: getAdminHeaders(),
    data: { admin_id: user.value.id },
    success: (res) => {
      if (res.data?.success) categoryList.value = res.data.data || []
    },
    fail: (err) => {
      console.error('Fetch categories failed:', err)
      uni.showToast({ title: '分类加载失败', icon: 'none' })
    }
  })
}

const selectedCategoryName = computed(() => {
  const id = knowledgeForm.value.category_id
  if (!id) return '未分类'
  const hit = categoryList.value.find((c) => Number(c.id) === Number(id))
  return hit?.name || '未分类'
})

/**
 * 上传/编辑时选择分类
 */
const onCategoryChange = (e) => {
  const idx = Number(e.detail.value)
  const item = categoryPickerOptions.value[idx]
  knowledgeForm.value.category_id = item && Number(item.id) > 0 ? Number(item.id) : null
}

const categoryFilterOptions = computed(() => {
  return [{ id: 'all', name: '全部' }, ...categoryPickerOptions.value]
})

const activeCategoryName = computed(() => {
  const id = activeCategoryId.value
  if (id === 'all') return '全部'
  const hit = categoryFilterOptions.value.find((c) => String(c.id) === String(id))
  return hit?.name || '全部'
})

const onKnowledgeFilterChange = (e) => {
  const idx = Number(e.detail.value)
  const item = categoryFilterOptions.value[idx]
  activeCategoryId.value = item ? item.id : 'all'
}

const knowledgeGroups = computed(() => {
  const map = new Map()
  ;(knowledgeList.value || []).forEach((k) => {
    const key = k.category_id ? Number(k.category_id) : 0
    const name = k.category_name || (key === 0 ? '未分类' : '未分类')
    if (!map.has(key)) map.set(key, { key, name, items: [] })
    map.get(key).items.push(k)
  })

  const ordered = []
  ;(categoryList.value || []).forEach((c) => {
    const key = Number(c.id)
    if (map.has(key)) ordered.push({ key, name: c.name, items: map.get(key).items })
  })
  if (map.has(0)) ordered.push({ key: 0, name: '未分类', items: map.get(0).items })
  return ordered
})

const displayedKnowledgeGroups = computed(() => {
  if (activeCategoryId.value === 'all') return knowledgeGroups.value
  const target = Number(activeCategoryId.value) || 0
  return knowledgeGroups.value.filter((g) => Number(g.key) === target)
})

const toggleGroup = (key) => {
  const idx = collapsedGroupKeys.value.indexOf(key)
  if (idx >= 0) collapsedGroupKeys.value.splice(idx, 1)
  else collapsedGroupKeys.value.push(key)
}

const fetchLogs = () => {
  uni.request({
    url: apiUrl('/api/admin/logs/list'),
    method: 'POST',
    header: getAdminHeaders(),
    data: { admin_id: user.value.id },
    success: (res) => {
      if (res.data.success) logList.value = res.data.data
    },
    fail: (err) => console.error('Fetch logs failed:', err)
  })
}

const fetchAiConfig = () => {
  uni.request({
    url: apiUrl('/api/admin/config/ai'),
    method: 'POST',
    header: getAdminHeaders(),
    data: { admin_id: user.value.id },
    success: (res) => {
      if (res.data.success) aiConfig.value = res.data.data
    }
  })
}

const saveAiConfig = () => {
  uni.request({
    url: apiUrl('/api/admin/config/ai/update'),
    method: 'POST',
    header: getAdminHeaders(),
    data: { admin_id: user.value.id, ...aiConfig.value },
    success: (res) => {
      if (res.data.success) uni.showToast({ title: '配置已保存' })
    }
  })
}

const openEditModal = (u) => {
  userForm.value = { id: u.id, username: u.username, role: u.role, password: '' }
  showEditUserModal.value = true
}

const closeUserModal = () => {
  showAddUserModal.value = false
  showEditUserModal.value = false
  userForm.value = { id: null, username: '', password: '', role: 'user' }
}

const onRoleChange = (e) => {
  console.log('Role changed:', e.detail.value);
  userForm.value.role = e.detail.value;
}

const saveUser = () => {
  console.log('Saving user...', userForm.value);
  const isEdit = showEditUserModal.value
  const url = isEdit ? '/api/admin/users/update' : '/api/admin/users/add'
  const data = isEdit 
    ? { 
        admin_id: user.value.id, 
        target_id: userForm.value.id, 
        username: userForm.value.username, 
        role: userForm.value.role,
        password: userForm.value.password // 传递密码，后端判断是否为空
      }
    : { 
        admin_id: user.value.id,
        username: userForm.value.username, 
        password: userForm.value.password, 
        role: userForm.value.role 
      }

  uni.showLoading({ title: '保存中...' });
  uni.request({
    url: apiUrl(url),
    method: 'POST',
    header: getAdminHeaders(),
    data,
    success: (res) => {
      uni.hideLoading();
      console.log('Save user response:', res.data);
      if (res.data.success) {
        uni.showToast({ title: '保存成功' })
        closeUserModal()
        fetchUsers()
      } else {
        uni.showToast({ title: res.data.message || '操作失败', icon: 'none' })
      }
    },
    fail: (err) => {
      uni.hideLoading();
      console.error('Save user failed:', err);
      uni.showToast({ title: '请求失败', icon: 'none' })
    }
  })
}

const handleDeleteUser = (u) => {
  if (u.id === user.value.id) return uni.showToast({ title: '不能删除自己', icon: 'none' })
  uni.showModal({
    title: '确认删除',
    content: `确定删除用户 ${u.username} 吗？`,
    success: (res) => {
      if (res.confirm) {
        uni.request({
          url: apiUrl('/api/admin/users/delete'),
          method: 'POST',
          header: getAdminHeaders(),
          data: { admin_id: user.value.id, target_id: u.id },
          success: (res) => {
            console.log('Delete user response:', res.data);
            fetchUsers()
            uni.showToast({ title: '已删除' })
          }
        })
      }
    }
  })
}

// 知识库文件处理
const handleSelectFile = () => {
  // #ifdef H5
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,.docx,.doc,.txt'
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('File selected:', file.name);
      knowledgeForm.value.file = file;
      // 自动把文件名填充到标题中，如果标题还没写
      if (!knowledgeForm.value.title) {
        knowledgeForm.value.title = file.name.split('.')[0];
      }
    }
  }
  input.click()
  // #endif
}

const handleChooseMessageFile = () => {
  // #ifndef H5
  wx.chooseMessageFile({
    count: 1,
    type: 'file',
    success: (res) => {
      console.log('WX File selected:', res.tempFiles[0].name);
      knowledgeForm.value.tempFilePath = res.tempFiles[0].path
      knowledgeForm.value.title = knowledgeForm.value.title || res.tempFiles[0].name.split('.')[0]
    }
  })
  // #endif
}

const saveKnowledge = () => {
  console.log('Saving knowledge...', knowledgeForm.value);
  const isEdit = showEditKnowledgeModal.value;
  
  // 判断当前环境和是否有新文件
  let hasNewFile = false;
  // #ifdef H5
  hasNewFile = !!knowledgeForm.value.file;
  // #endif
  // #ifndef H5
  hasNewFile = !!knowledgeForm.value.tempFilePath;
  // #endif

  // #ifdef H5
  // 在 H5 环境下，直接使用原生的 FormData 和 fetch/XMLHttpRequest 往往比 uni.uploadFile 在代理环境下更稳定
  const formData = new FormData();
  formData.append('admin_id', String(user.value.id || ''));
  formData.append('id', String(knowledgeForm.value.id || ''));
  formData.append('title', String(knowledgeForm.value.title || ''));
  formData.append('description', String(knowledgeForm.value.description || ''));
  formData.append('category_id', String(knowledgeForm.value.category_id || ''));
  formData.append('isUpdate', String(isEdit ? 'true' : 'false'));
  if (knowledgeForm.value.file) {
    formData.append('file', knowledgeForm.value.file);
  }

  console.log('H5 Uploading via FormData...', apiUrl('/api/admin/knowledge/add'));

  // H5 环境下使用 fetch + FormData，避免 uni.request 在部分浏览器/代理环境的兼容问题
  fetch(apiUrl('/api/admin/knowledge/add'), {
    method: 'POST',
    headers: getAdminHeaders(),
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    uni.hideLoading();
    console.log('Fetch upload success:', data);
    if (data.success) {
      uni.showToast({ title: isEdit ? '更新成功' : '添加成功' });
      closeKnowledgeModal();
      fetchKnowledge();
    } else {
      uni.showToast({ title: data.message || '操作失败', icon: 'none' });
    }
  })
  .catch(err => {
    uni.hideLoading();
    console.error('Fetch upload error:', err);
    uni.showModal({
      title: '上传失败',
      content: '请确保是通过 npm run dev:h5 启动，并检查后端服务。',
      showCancel: false
    });
  });
  return;
  // #endif

  // #ifndef H5
  const uploadOptions = {
    url: apiUrl('/api/admin/knowledge/add'),
    name: 'file',
    formData: {
      admin_id: user.value.id,
      id: isEdit ? knowledgeForm.value.id : '', // 传入 ID 表示是更新文件
      title: knowledgeForm.value.title,
      description: knowledgeForm.value.description,
      category_id: knowledgeForm.value.category_id,
      isUpdate: isEdit ? 'true' : 'false'
    }
  };

  console.log('Uploading knowledge file...', uploadOptions.url);
  const finalOptions = {
    url: uploadOptions.url,
    name: uploadOptions.name,
    header: getAdminHeaders(),
    formData: {
      admin_id: String(uploadOptions.formData.admin_id || ''),
      id: String(uploadOptions.formData.id || ''),
      title: String(uploadOptions.formData.title || ''),
      description: String(uploadOptions.formData.description || ''),
      category_id: String(uploadOptions.formData.category_id || ''),
      isUpdate: String(uploadOptions.formData.isUpdate)
    },
    success: (res) => {
      uni.hideLoading();
      console.log('Upload success response:', res);
      let data;
      try {
        data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      } catch (e) {
        console.error('JSON parse error:', res.data);
        return uni.showToast({ title: '服务器响应格式错误', icon: 'none' });
      }

      if (data && data.success) {
        uni.showToast({ title: isEdit ? '更新成功' : '添加成功' })
        closeKnowledgeModal()
        fetchKnowledge()
      } else {
        uni.showToast({ title: (data && data.message) || '操作失败', icon: 'none' })
      }
    },
    fail: (err) => {
      uni.hideLoading();
      console.error('Upload fail details:', JSON.stringify(err));
      
      // 在 H5 环境下，如果上传成功了但还是报错，可能是 CORS 问题
      // 检查 err 的内容，如果提示已经完成或状态是成功，则手动刷新
      if (err.statusCode === 200 || err.errMsg.includes('success')) {
        uni.showToast({ title: '添加成功' })
        closeKnowledgeModal()
        fetchKnowledge()
        return;
      }

      // 检查是否是由于地址问题导致的失败
      if (err.errMsg && (err.errMsg.includes('fail') || err.errMsg.includes('timeout'))) {
        uni.showModal({
          title: '网络请求失败',
          content: '无法连接到服务器，请检查后端是否启动及服务器设置是否正确。',
          showCancel: false
        });
      } else {
        uni.showToast({ title: '网络请求失败: ' + (err.errMsg || ''), icon: 'none' })
      }
    }
  };

  finalOptions.filePath = knowledgeForm.value.tempFilePath
  uni.uploadFile(finalOptions)
  // #endif
}

const openEditKnowledgeModal = (k) => {
  knowledgeForm.value = { id: k.id, title: k.title, description: k.description, category_id: k.category_id || null, file: null, tempFilePath: '' };
  showEditKnowledgeModal.value = true;
}

const closeKnowledgeModal = () => {
  showAddKnowledgeModal.value = false;
  showEditKnowledgeModal.value = false;
  knowledgeForm.value = { id: null, title: '', description: '', category_id: null, file: null, tempFilePath: '' };
}

/**
 * 打开/关闭分类管理弹窗
 */
const openCategoryModal = () => {
  showCategoryModal.value = true
  fetchCategories()
}

const closeCategoryModal = () => {
  showCategoryModal.value = false
  resetCategoryForm()
}

const resetCategoryForm = () => {
  categoryForm.value = { id: null, name: '', sort: '' }
}

/**
 * 编辑分类（点击列表行）
 * @param {{id:number,name:string,sort:number}} c
 */
const editCategory = (c) => {
  categoryForm.value = { id: c.id, name: c.name, sort: String(c.sort ?? '') }
}

/**
 * 新增/更新分类
 */
const saveCategory = () => {
  const isEdit = !!categoryForm.value.id
  const url = isEdit ? '/api/admin/knowledge/categories/update' : '/api/admin/knowledge/categories/add'
  uni.request({
    url: apiUrl(url),
    method: 'POST',
    header: getAdminHeaders(),
    data: {
      admin_id: user.value.id,
      id: categoryForm.value.id,
      name: categoryForm.value.name,
      sort: categoryForm.value.sort
    },
    success: (res) => {
      if (res.data?.success) {
        uni.showToast({ title: isEdit ? '已更新' : '已新增' })
        resetCategoryForm()
        fetchCategories()
      } else {
        uni.showToast({ title: res.data?.message || '操作失败', icon: 'none' })
      }
    },
    fail: () => uni.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
  })
}

/**
 * 删除分类
 * @param {{id:number,name:string}} c
 */
const deleteCategory = (c) => {
  if (!c?.id) return
  uni.showModal({
    title: '确认删除',
    content: `确定删除分类「${c.name}」吗？`,
    success: (res) => {
      if (!res.confirm) return
      uni.request({
        url: apiUrl('/api/admin/knowledge/categories/delete'),
        method: 'POST',
        header: getAdminHeaders(),
        data: { admin_id: user.value.id, id: c.id },
        success: (res) => {
          if (res.data?.success) {
            uni.showToast({ title: '已删除' })
            fetchCategories()
          } else {
            uni.showToast({ title: res.data?.message || '删除失败', icon: 'none' })
          }
        },
        fail: () => uni.showToast({ title: '网络错误，请稍后重试', icon: 'none' })
      })
    }
  })
}

const handleDeleteKnowledge = (id) => {
  uni.request({
    url: apiUrl('/api/admin/knowledge/delete'),
    method: 'POST',
    header: getAdminHeaders(),
    data: { admin_id: user.value.id, id },
    success: () => {
      fetchKnowledge()
      uni.showToast({ title: '已删除' })
    }
  })
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
}
</script>

<style scoped>
.admin-container {
  padding: 20px;
  background-color: #f4f7f9;
  min-height: 100vh;
}

.password-input-wrapper {
  position: relative;
  width: 100%;
}

.toggle-password-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  width: 22px;
  height: 22px;
  transform: translateY(-50%);
  z-index: 2;
}

.admin-tabs {
  display: flex;
  background: #fff;
  border-radius: 10px;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 15px;
  font-size: 16px;
  color: #666;
  cursor: pointer;
}

.tab-active {
  background-color: #0d6efd;
  color: #fff;
  font-weight: bold;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.panel-actions {
  display: flex;
  gap: 10px;
}

.knowledge-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-label {
  font-size: 14px;
  color: #333;
}

.knowledge-group {
  margin-bottom: 14px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  margin-bottom: 10px;
}

.group-title {
  font-size: 15px;
  font-weight: bold;
  color: #222;
}

.group-toggle {
  font-size: 12px;
  color: #0d6efd;
}

.panel-title {
  font-size: 18px;
  font-weight: bold;
}

.user-card, .knowledge-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  margin-bottom: 12px;
}

.user-name {
  font-size: 16px;
  font-weight: bold;
  margin-right: 10px;
}

.role-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
}

.badge-admin { background-color: #dc3545; }
.badge-user { background-color: #6c757d; }

.user-stats {
  margin-top: 8px;
  display: flex;
  gap: 15px;
}

.stat-text {
  font-size: 12px;
  color: #999;
}

.log-main {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}
.log-user { font-weight: bold; color: #0d6efd; }
.log-action { color: #28a745; font-size: 12px; }
.log-time { color: #999; font-size: 11px; }
.log-details { font-size: 12px; color: #666; background: #f8f9fa; padding: 5px; border-radius: 4px; }

.config-card {
  padding: 20px;
}
.form-item {
  margin-bottom: 15px;
}
.form-item .label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #333;
}

.user-actions, .k-actions {
  display: flex;
  gap: 8px;
}

.edit-btn { background-color: #0d6efd; color: #fff; }
.delete-btn { background-color: #dc3545; color: #fff; }
.add-btn { background-color: #28a745; color: #fff; }

.k-title { font-weight: bold; display: block; margin-bottom: 5px; }
.k-desc { font-size: 13px; color: #666; display: block; }
.k-path { font-size: 11px; color: #999; }

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal-content {
  background: #fff;
  width: 80%;
  max-width: 400px;
  padding: 25px;
  border-radius: 12px;
  position: relative;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
  display: block;
}

.modal-body {
  margin-bottom: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 15px;
  font-size: 14px;
  box-sizing: border-box;
}

.radio-group {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.radio-label {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.modal-input-area {
  width: 100%;
  height: 80px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 15px;
  font-size: 14px;
  box-sizing: border-box;
}

.picker-value {
  height: 44px;
  line-height: 44px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 15px;
  font-size: 14px;
  color: #333;
  box-sizing: border-box;
}

.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.category-list {
  max-height: 50vh;
}

.category-main {
  flex: 1;
}

.category-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.category-sort {
  display: block;
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.modal-btns {
  display: flex;
  gap: 10px;
}

.modal-btn {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  font-size: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cancel { background: #f8f9fa; color: #666; }
.confirm { background: #0d6efd; color: #fff; }
.file-btn { background: #e9ecef; color: #495057; border: 1px dashed #ced4da; margin-bottom: 10px; }
</style>
