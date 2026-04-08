<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import type { MpEmployeeProfile } from '@/store/user'

const userStore = useUserStore()

const emp = computed(() => {
  const u = userStore.user
  if (!u || u.type !== 'employee') return null
  return u as MpEmployeeProfile
})

onShow(() => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  void userStore.fetchUser()
})

function goChangePassword() {
  uni.navigateTo({ url: '/pages/profile/change-password' })
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

      <view v-if="emp" class="meta-block">
        <view class="meta-row">
          <text class="meta-label">物业公司</text>
          <text class="meta-value">{{ emp.companyName?.trim() || '—' }}</text>
        </view>
        <view class="meta-section">
          <text class="meta-label">职责</text>
          <view class="duty-lines">
            <text v-if="emp.roleName" class="duty-line">角色：{{ emp.roleName }}</text>
            <text v-if="emp.departmentName" class="duty-line">部门：{{ emp.departmentName }}</text>
            <text v-if="emp.projectName" class="duty-line">项目：{{ emp.projectName }}</text>
            <text v-if="emp.position" class="duty-line">岗位：{{ emp.position }}</text>
            <text v-if="emp.businessTypes" class="duty-line">负责范围：{{ emp.businessTypes }}</text>
            <text class="duty-line leader">
              {{ emp.isLeader ? '组长' : '组员' }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <view class="menu-list">
      <view class="menu-item" @click="goChangePassword">
        <text class="menu-text">修改密码</text>
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

.meta-block {
  position: relative;
  z-index: 1;
  margin-top: 28rpx;
  padding-top: 28rpx;
  border-top: 1rpx solid rgba(148, 163, 184, 0.2);
}

.meta-row {
  margin-bottom: 20rpx;
}

.meta-section {
  margin-top: 8rpx;
}

.meta-label {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  margin-bottom: 8rpx;
  letter-spacing: 0.02em;
}

.meta-value {
  font-size: 28rpx;
  color: $pms-text;
  line-height: 1.5;
}

.duty-lines {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.duty-line {
  font-size: 26rpx;
  color: $pms-text-muted;
  line-height: 1.45;
}

.duty-line.leader {
  color: #86efac;
  font-weight: 600;
  margin-top: 4rpx;
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
