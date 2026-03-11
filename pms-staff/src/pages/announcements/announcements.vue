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
    const res = await get<{ list: AnnouncementItem[] }>('/api/mp/announcements')
    if (res.success && res.data) {
      list.value = res.data.list
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
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else-if="list.length === 0" class="empty">暂无公告</view>
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
}
.loading, .empty {
  text-align: center;
  padding: 80rpx;
  color: #999;
}
.list {
  .card {
    background: #fff;
    border-radius: 16rpx;
    padding: 32rpx;
    margin-bottom: 24rpx;
  }
  .title {
    font-size: 32rpx;
    font-weight: bold;
    margin-bottom: 16rpx;
  }
  .content {
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
  }
  .time {
    font-size: 24rpx;
    color: #999;
    margin-top: 16rpx;
  }
}
</style>
