<template>
  <view class="mine-container">
    <view class="user-info" @tap="goPersonalInfo">
      <u-avatar :text="avatarText" size="50"></u-avatar>
      <view class="info-text">
        <view class="name">{{ displayName }}</view>
        <view class="phone">{{ displayPhone }}</view>
      </view>
      <u-icon name="arrow-right" color="#c0c4cc" size="18"></u-icon>
    </view>

    <view class="menu-group">
      <u-cell-group :border="false">
        <u-cell icon="lock" title="修改密码" isLink url="/pages/password/password"></u-cell>
        <u-cell icon="info-circle" title="关于我们" isLink url="/pages/about/about"></u-cell>
      </u-cell-group>
    </view>

    <view class="logout-btn">
      <u-button type="error" text="退出登录" @click="handleLogout"></u-button>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user.js'

const userStore = useUserStore()

onShow(async () => {
  if (!userStore.token) {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  if (!userStore.user) {
    await userStore.fetchUser()
  }
})

const displayName = computed(() => {
  const user = userStore.user
  if (!user) return '未登录员工'
  const dept = user.departmentName ? ` (${user.departmentName})` : ''
  return `${user.name || '未命名员工'}${dept}`
})

const displayPhone = computed(() => userStore.user?.phone || '')
const avatarText = computed(() => (userStore.user?.name || '员工').slice(-2))

const goPersonalInfo = () => {
  uni.navigateTo({ url: '/pages/profile/personal-info' })
}

const handleLogout = () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.reLaunch({ url: '/pages/login/login' })
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.mine-container {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
  background: #f5f6f7;
}

.user-info {
  display: flex;
  align-items: center;
  background-color: #fff;
  padding: 40rpx 30rpx;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.info-text {
  margin-left: 30rpx;
  flex: 1;
  .name {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
  }
  .phone {
    font-size: 28rpx;
    color: #999;
    margin-top: 10rpx;
  }
}

.menu-group {
  background-color: #fff;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.logout-btn {
  margin-top: 40rpx;
}
</style>
