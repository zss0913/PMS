<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'

interface AnnouncementItem {
  id: number
  title: string
  content: string
  publishTime: string | null
}

const list = ref<AnnouncementItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = (await get('/api/mp/announcements')) as {
      success?: boolean
      list?: AnnouncementItem[]
    }
    if (res.success && Array.isArray(res.list)) {
      list.value = res.list
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="page">
    <view class="intro">物业公告与重要通知</view>
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">暂无消息</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card">
        <view class="title">{{ item.title }}</view>
        <view class="content">{{ item.content }}</view>
        <view class="time" v-if="item.publishTime">{{ item.publishTime }}</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.intro {
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 24rpx;
}

.loading,
.empty {
  text-align: center;
  padding: 100rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.list {
  .card {
    @include pms-card;
    @include pms-tap;
    padding: 32rpx;
    margin-bottom: 24rpx;
  }
  .title {
    font-size: 32rpx;
    font-weight: 600;
    color: $pms-text;
    margin-bottom: 16rpx;
    font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  }
  .content {
    font-size: 28rpx;
    color: $pms-text-muted;
    line-height: 1.65;
  }
  .time {
    font-size: 22rpx;
    color: $pms-text-dim;
    margin-top: 20rpx;
  }
}
</style>
