<template>
  <view class="personal-container">
    <view class="menu-group">
      <u-cell-group :border="false">
        <u-cell title="姓名" :value="userStore.user?.name || '—'"></u-cell>
        <u-cell title="手机号" :value="userStore.user?.phone || '—'"></u-cell>
        <u-cell title="所属部门" :value="userStore.user?.departmentName || '—'"></u-cell>
        <u-cell title="岗位" :value="userStore.user?.position || '—'"></u-cell>
        <u-cell title="角色" :value="userStore.user?.roleName || '—'"></u-cell>
        <u-cell title="所属项目" :value="userStore.user?.projectName || '—'"></u-cell>
        <u-cell title="物业公司" :value="userStore.user?.companyName || '—'"></u-cell>
      </u-cell-group>
    </view>
  </view>
</template>

<script setup>
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
</script>

<style lang="scss" scoped>
.personal-container {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
  background: #f5f6f7;
}

.menu-group {
  background-color: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}
</style>
