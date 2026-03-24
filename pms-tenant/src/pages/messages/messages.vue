<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const loading = ref(true)

onMounted(() => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    loading.value = false
    return
  }
  void userStore.fetchUser()
  loading.value = false
})
</script>

<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else class="empty-wrap">
      <text class="empty-title">暂无消息通知</text>
      <text class="empty-desc">账单催缴、工单进展、公告等提醒将在此汇总展示。</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 48rpx 32rpx;
  box-sizing: border-box;
  background: $pms-bg-deep;
}

.state,
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 24rpx;
}

.state {
  font-size: 28rpx;
  color: $pms-text-muted;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
  margin-bottom: 16rpx;
  text-align: center;
}

.empty-desc {
  font-size: 26rpx;
  color: $pms-text-dim;
  line-height: 1.55;
  text-align: center;
  max-width: 560rpx;
}
</style>
