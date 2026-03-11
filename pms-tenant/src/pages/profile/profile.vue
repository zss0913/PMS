<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

onMounted(() => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
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
      <text class="name">{{ userStore.user.name }}</text>
      <text class="phone">{{ userStore.user.phone }}</text>
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
    <view class="logout-wrap">
      <button class="btn-logout" @click="logout">退出登录</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 40rpx;
}
.user-card {
  background: linear-gradient(135deg, #007aff 0%, #0051d5 100%);
  border-radius: 20rpx;
  padding: 48rpx;
  margin-bottom: 40rpx;
  .name {
    display: block;
    font-size: 36rpx;
    font-weight: bold;
    color: #fff;
  }
  .phone {
    font-size: 28rpx;
    color: rgba(255,255,255,0.8);
    margin-top: 12rpx;
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
.menu-text { font-size: 30rpx; }
.arrow { color: #999; font-size: 36rpx; }
.logout-wrap {
  margin-top: 60rpx;
}
.btn-logout {
  background: #fff;
  color: #f56c6c;
  border: 1rpx solid #f56c6c;
  border-radius: 12rpx;
  height: 88rpx;
  line-height: 88rpx;
}
</style>
