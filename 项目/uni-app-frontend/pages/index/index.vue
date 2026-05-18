<template>
  <view class="container">
    <view class="header">
      <text class="brand">🛡️ 智检系统</text>
      <view class="nav-links">
        <text class="nav-link" @click="goToPage('login')">登录</text>
        <text class="nav-link" @click="goToPage('register')">注册</text>
      </view>
    </view>

    <swiper class="banner" circular autoplay interval="3000">
      <swiper-item>
        <image class="banner-image" src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80" />
        <view class="banner-caption">安全生产 · 智能监测</view>
      </swiper-item>
      <swiper-item>
        <image class="banner-image" src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80" />
        <view class="banner-caption">社会服务 · 智检分析</view>
      </swiper-item>
    </swiper>

    <view class="card">
      <text class="section-title">智检系统简介</text>
      <text class="intro-text">基于豆包大模型，为安全生产提供全流程智能化解决方案。支持文字、图片、PDF 多模态分析，生成专业级检测报告。</text>
      <button class="start-btn" type="primary" @click="goToPage('process')">立即开始体验</button>
    </view>

    <view class="features row">
      <view class="col-6 feature-item">
        <view class="feature-icon">🛡️</view>
        <text class="feature-title">智能安全监测</text>
        <text class="feature-desc">识别违规行为与安全隐患</text>
      </view>
      <view class="col-6 feature-item">
        <view class="feature-icon">📄</view>
        <text class="feature-title">多模态文档分析</text>
        <text class="feature-desc">深度解析 PDF 报告内容</text>
      </view>
    </view>
  </view>
</template>

<script setup>
const goToPage = (page) => {
  uni.navigateTo({ url: `/pages/${page}/${page}` })
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.brand {
  font-size: 24px;
  font-weight: bold;
  color: #0d6efd;
}
.nav-link {
  margin-left: 15px;
  color: #0d6efd;
  font-size: 14px;
}
.banner {
  height: 200px;
  border-radius: 15px;
  overflow: hidden;
  margin-bottom: 20px;
}
.banner-image {
  width: 100%;
  height: 100%;
}
.banner-caption {
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 10px;
  background-color: rgba(0,0,0,0.5);
  color: white;
  text-align: center;
}
.intro-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 20px;
  display: block;
}
.start-btn {
  border-radius: 10px;
}
.features {
  display: flex;
  flex-wrap: wrap;
}
.feature-item {
  width: 50%;
  padding: 10px;
  text-align: center;
}
.feature-icon {
  font-size: 32px;
  margin-bottom: 10px;
}
.feature-title {
  font-size: 16px;
  font-weight: bold;
  display: block;
}
.feature-desc {
  font-size: 12px;
  color: #999;
}
</style>
