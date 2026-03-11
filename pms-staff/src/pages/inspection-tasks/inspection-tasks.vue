<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'

interface TaskItem {
  id: number
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
}

const list = ref<TaskItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await get<{ list: TaskItem[] }>('/api/mp/inspection-tasks')
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
    <view v-else-if="list.length === 0" class="empty">暂无巡检任务</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card">
        <view class="title">{{ item.planName || item.code }}</view>
        <view class="meta">
          <text>{{ item.inspectionType }}</text>
          <text>{{ item.scheduledDate }}</text>
        </view>
        <view class="status">{{ item.status }}</view>
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
    font-size: 30rpx;
    font-weight: bold;
    margin-bottom: 16rpx;
  }
  .meta {
    font-size: 24rpx;
    color: #666;
    margin-bottom: 8rpx;
  }
  .status {
    font-size: 24rpx;
    color: #007aff;
  }
}
</style>
