<template>
  <view class="page">
    <view class="hero">
      <view class="hero-orb" />
      <view class="hero-inner">
        <text class="brand">PMS · STAFF</text>
        <text class="title">物业员工端</text>
        <text v-if="userStore.user" class="subtitle">欢迎回来，{{ userStore.user.name }}</text>
        <text v-else class="subtitle">智能工单与巡检工作台</text>
      </view>
    </view>

    <view class="menu-grid">
      <view class="menu-card" @tap="goTodos">
        <view class="icon-wrap">
          <text class="icon-char">办</text>
        </view>
        <text class="menu-label">待办汇总</text>
        <text class="menu-hint">工单、巡检、卫生吐槽</text>
      </view>
      <view class="menu-card" @tap="goWorkOrders">
        <view class="icon-wrap">
          <text class="icon-char">单</text>
        </view>
        <text class="menu-label">工单管理</text>
        <text class="menu-hint">按状态查看与处理</text>
      </view>
      <view class="menu-card" @tap="goInspectionTasks">
        <view class="icon-wrap">
          <text class="icon-char">巡</text>
        </view>
        <text class="menu-label">巡检任务</text>
        <text class="menu-hint">计划与执行</text>
      </view>
      <view class="menu-card" @tap="goComplaints">
        <view class="icon-wrap">
          <text class="icon-char">吐</text>
        </view>
        <text class="menu-label">卫生吐槽</text>
        <text class="menu-hint">查看租客反馈，指派与办结</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user.js'
import { openPage } from '../../utils/navigate.js'

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

function goTodos() {
  openPage('/pages/todos/todos')
}

function goWorkOrders() {
  openPage('/pages/workorder/list')
}

function goInspectionTasks() {
  openPage('/pages/inspection/list')
}

function goComplaints() {
  openPage('/pages/complaints/list')
}
</script>

<style lang="scss" scoped>
/* 浅色 + 蓝色强调（property-employee-app 原版风格） */
.page {
  min-height: 100vh;
  padding: 32rpx 32rpx 48rpx;
  box-sizing: border-box;
  background: #f5f6f7;
}

.hero {
  position: relative;
  overflow: hidden;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  margin-bottom: 32rpx;
  border: 1rpx solid #ebeef5;
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.hero-orb {
  position: absolute;
  right: -60rpx;
  top: -60rpx;
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(41, 121, 255, 0.12) 0%, transparent 70%);
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
  color: #2979ff;
  margin-bottom: 16rpx;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  color: #333;
  letter-spacing: 0.02em;
}

.subtitle {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #909399;
  line-height: 1.5;
}

.menu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}

.menu-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
  border: 1rpx solid #ebeef5;
  &:active {
    opacity: 0.92;
  }
}

.icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: rgba(41, 121, 255, 0.1);
  border: 1rpx solid rgba(41, 121, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.icon-char {
  font-size: 32rpx;
  font-weight: 700;
  color: #2979ff;
}

.menu-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.menu-hint {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #909399;
}
</style>
