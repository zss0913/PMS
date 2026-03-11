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
    <view class="header">
      <text class="title">物业租客端</text>
      <text class="subtitle" v-if="userStore.user">欢迎，{{ userStore.user.name }}</text>
    </view>
    <view class="menu-list">
      <view class="menu-item" @click="goBills">
        <text class="menu-text">我的账单</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goWorkOrders">
        <text class="menu-text">报事报修</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goAnnouncements">
        <text class="menu-text">公告</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goComplaints">
        <text class="menu-text">卫生吐槽</text>
        <text class="arrow">›</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 40rpx;
}
.header {
  margin-bottom: 60rpx;
  .title {
    font-size: 44rpx;
    font-weight: bold;
    display: block;
  }
  .subtitle {
    font-size: 28rpx;
    color: #666;
    margin-top: 16rpx;
  }
}
.menu-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx;
  border-bottom: 1rpx solid #eee;
  &:last-child {
    border-bottom: none;
  }
}
.menu-text {
  font-size: 30rpx;
}
.arrow {
  color: #999;
  font-size: 36rpx;
}
</style>
