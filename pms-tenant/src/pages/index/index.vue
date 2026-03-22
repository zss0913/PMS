<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

onMounted(async () => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  if (!userStore.user) {
    await userStore.fetchUser()
  }
})

function goBills() {
  uni.navigateTo({ url: '/pages/bills/bills' })
}

function goWorkOrders() {
  uni.navigateTo({ url: '/pages/work-orders/work-orders' })
}

function goAnnouncements() {
  uni.navigateTo({ url: '/pages/announcements/announcements' })
}

function goComplaints() {
  uni.navigateTo({ url: '/pages/complaints/complaints' })
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <view class="hero-orb" />
      <view class="hero-inner">
        <text class="brand">PMS · TENANT</text>
        <text class="title">物业租客端</text>
        <text class="subtitle" v-if="userStore.user">你好，{{ userStore.user.name }}</text>
        <text class="subtitle" v-else>账单、报修与服务一站通达</text>
      </view>
    </view>

    <view class="menu-grid">
      <view class="menu-card" @click="goBills">
        <view class="icon-wrap">
          <text class="icon-char">账</text>
        </view>
        <text class="menu-label">我的账单</text>
        <text class="menu-hint">费用与缴费</text>
      </view>
      <view class="menu-card" @click="goWorkOrders">
        <view class="icon-wrap">
          <text class="icon-char">修</text>
        </view>
        <text class="menu-label">报事报修</text>
        <text class="menu-hint">提交与进度</text>
      </view>
      <view class="menu-card" @click="goAnnouncements">
        <view class="icon-wrap">
          <text class="icon-char">告</text>
        </view>
        <text class="menu-label">公告</text>
        <text class="menu-hint">小区通知</text>
      </view>
      <view class="menu-card" @click="goComplaints">
        <view class="icon-wrap">
          <text class="icon-char">评</text>
        </view>
        <text class="menu-label">卫生吐槽</text>
        <text class="menu-hint">意见反馈</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 32rpx 32rpx 48rpx;
  box-sizing: border-box;
}

.hero {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  padding: 48rpx 40rpx;
  margin-bottom: 40rpx;
  border: 1rpx solid $pms-border;
  background: linear-gradient(145deg, $pms-surface 0%, $pms-bg-deep 100%);
}

.hero-orb {
  position: absolute;
  right: -80rpx;
  top: -80rpx;
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  background: radial-gradient(circle, $pms-accent-soft 0%, transparent 70%);
  pointer-events: none;
}

.hero-inner {
  position: relative;
  z-index: 1;
}

.brand {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: $pms-accent;
  margin-bottom: 16rpx;
}

.title {
  display: block;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 48rpx;
  font-weight: 700;
  color: $pms-text;
  letter-spacing: 0.02em;
}

.subtitle {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: $pms-text-muted;
  line-height: 1.5;
}

.menu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}

.menu-card {
  @include pms-card;
  @include pms-tap;
  padding: 36rpx 28rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: $pms-accent-soft;
  border: 1rpx solid rgba(56, 189, 248, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.icon-char {
  font-size: 32rpx;
  font-weight: 700;
  color: $pms-accent;
}

.menu-label {
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
}

.menu-hint {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $pms-text-dim;
}
</style>
