<template>
  <view class="container register-container">
    <view class="card register-card">
      <view class="brand-logo">🛡️</view>
      <text class="brand-name">加入智检系统</text>
      <text class="brand-slogan">开启安全生产智能化新篇章</text>

      <view class="register-form">
        <view class="form-item">
          <text class="label">账号</text>
          <input class="input" type="text" v-model="username" placeholder="请输入用户名" />
        </view>
        <view class="form-item">
          <text class="label">密码</text>
          <view class="password-input-wrapper">
            <input class="input" type="text" :password="!showPassword" v-model="password" placeholder="请输入密码" />
            <image
              class="toggle-password-icon"
              :src="showPassword ? '/static/icons/eye-off.png' : '/static/icons/eye.png'"
              @tap="showPassword = !showPassword"
            />
          </view>
        </view>
        <button class="submit-btn" type="primary" :loading="loading" @click="handleRegister">立即注册</button>
        <view class="login-link">
          <text class="text-muted">已有账号？</text>
          <text class="link-text" @click="goToLogin">去登录</text>
        </view>
        <view class="login-link">
          <text class="text-muted">连接不上？</text>
          <text class="link-text" @click="goToSettings">服务器设置</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { apiUrl, unwrapResponse } from '../../common/api-config'

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

/**
 * 用户注册
 * 出于权限安全，注册仅创建普通用户账号（role=user）
 */
const handleRegister = () => {
  if (!username.value || !password.value) {
    uni.showToast({ title: '请输入账号和密码', icon: 'none' })
    return
  }

  loading.value = true
  uni.request({
    url: apiUrl('/api/register'),
    method: 'POST',
    data: { username: username.value, password: password.value, role: 'user' },
    success: (res) => {
      const result = unwrapResponse(res)
      if (result.ok) {
        uni.showToast({ title: '注册成功', icon: 'success' })
        setTimeout(() => {
          uni.navigateTo({ url: '/pages/login/login' })
        }, 1000)
      } else {
        uni.showToast({ title: result.msg || '注册失败', icon: 'none' })
      }
    },
    fail: () => {
      uni.showToast({ title: '网络错误，请检查服务器设置/合法域名', icon: 'none' })
    },
    complete: () => {
      loading.value = false
    }
  })
}

const goToLogin = () => {
  uni.navigateTo({ url: '/pages/login/login' })
}

const goToSettings = () => {
  uni.navigateTo({ url: '/pages/settings/settings' })
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
}
.register-card {
  width: 90%;
  max-width: 400px;
  text-align: center;
  padding: 40px 20px;
}
.brand-logo {
  font-size: 48px;
  margin-bottom: 10px;
}
.brand-name {
  font-size: 24px;
  font-weight: bold;
  display: block;
}
.brand-slogan {
  font-size: 14px;
  color: #999;
  margin-bottom: 30px;
  display: block;
}
.form-item {
  text-align: left;
  margin-bottom: 20px;
}
.label {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 10px;
  display: block;
}
.input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  background-color: #f8f9fa;
  border: 1px solid #eee;
  box-sizing: border-box;
}
.password-input-wrapper {
  position: relative;
}
.password-input-wrapper .input {
  padding-right: 44px;
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
.radio-label {
  margin-right: 20px;
  font-size: 14px;
}
.login-link {
  margin-top: 20px;
  font-size: 14px;
}
.link-text {
  color: #0d6efd;
  font-weight: bold;
  margin-left: 5px;
}
</style>
