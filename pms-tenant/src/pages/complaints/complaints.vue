<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'

interface ComplaintItem {
  id: number
  location: string
  description: string
  status: string
  createdAt: string
}

const list = ref<ComplaintItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await get<{ list: ComplaintItem[] }>('/api/mp/complaints')
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
    <view v-else-if="list.length === 0" class="empty">暂无吐槽</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card">
        <view class="location">{{ item.location }}</view>
        <view class="desc">{{ item.description }}</view>
        <view class="meta">
          <text class="status">{{ item.status }}</text>
          <text class="time">{{ item.createdAt }}</text>
        </view>
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
  .location {
    font-size: 30rpx;
    font-weight: bold;
    margin-bottom: 12rpx;
  }
  .desc {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 16rpx;
  }
  .meta {
    font-size: 24rpx;
    color: #999;
  }
}
</style>
