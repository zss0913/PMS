<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

onMounted(() => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
  }
})

function goInspectionTasks() {
  uni.navigateTo({ url: '/pages/inspection-tasks/inspection-tasks' })
}

function goMessages() {
  uni.switchTab({ url: '/pages/messages/messages' })
}

function logout() {
  uni.showModal({
    title: '提示',
    content: '确定退出登录？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.navigateTo({ url: '/pages/login/login' })
      }
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="user-card" v-if="userStore.user">
      <view class="user-glow" />
      <text class="name">{{ userStore.user.name }}</text>
      <text class="phone">{{ userStore.user.phone }}</text>
    </view>
    <view class="menu-list">
      <view class="menu-item" @click="goInspectionTasks">
        <text class="menu-text">巡检任务</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goMessages">
        <text class="menu-text">消息通知</text>
        <text class="arrow">›</text>
      </view>
    </view>
    <view class="logout-wrap">
      <button class="btn-logout" @click="logout">退出登录</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 32rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.user-card {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  padding: 48rpx 40rpx;
  margin-bottom: 32rpx;
  border: 1rpx solid rgba(34, 197, 94, 0.35);
  background: linear-gradient(135deg, $pms-surface 0%, $pms-bg-deep 55%, #052e16 100%);
}

.user-glow {
  position: absolute;
  right: -40rpx;
  top: -40rpx;
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: radial-gradient(circle, $pms-accent-soft 0%, transparent 70%);
  pointer-events: none;
}

.name {
  position: relative;
  z-index: 1;
  display: block;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 40rpx;
  font-weight: 700;
  color: $pms-text;
}

.phone {
  position: relative;
  z-index: 1;
  display: block;
  font-size: 26rpx;
  color: $pms-text-muted;
  margin-top: 12rpx;
}

.menu-list {
  @include pms-card;
  overflow: hidden;
}

.menu-item {
  @include pms-tap;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 34rpx 32rpx;
  border-bottom: 1rpx solid $pms-border;
  &:last-child {
    border-bottom: none;
  }
}

.menu-text {
  font-size: 30rpx;
  color: $pms-text;
}

.arrow {
  color: $pms-text-dim;
  font-size: 36rpx;
}

.logout-wrap {
  margin-top: 48rpx;
}

.btn-logout {
  background: transparent;
  color: $pms-danger;
  border: 1rpx solid rgba(248, 113, 113, 0.45);
  border-radius: 16rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
}
</style>
