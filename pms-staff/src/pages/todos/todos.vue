<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'

interface TodoItem {
  id: number
  code: string
  title: string
  type: string
  status: string
}

const workOrders = ref<TodoItem[]>([])
const inspectionTasks = ref<TodoItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await get<{ workOrders: TodoItem[]; inspectionTasks: TodoItem[] }>('/api/mp/my-todos')
    if (res.success && res.data) {
      workOrders.value = res.data.workOrders || []
      inspectionTasks.value = res.data.inspectionTasks || []
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
    <view v-else>
      <view class="section" v-if="workOrders.length > 0">
        <view class="section-title">待处理工单</view>
        <view v-for="item in workOrders" :key="'wo-' + item.id" class="card">
          <view class="title">{{ item.title }}</view>
          <view class="meta">{{ item.code }} · {{ item.status }}</view>
        </view>
      </view>
      <view class="section" v-if="inspectionTasks.length > 0">
        <view class="section-title">巡检任务</view>
        <view v-for="item in inspectionTasks" :key="'it-' + item.id" class="card">
          <view class="title">{{ item.code || item.title }}</view>
          <view class="meta">{{ item.status }}</view>
        </view>
      </view>
      <view v-if="!loading && workOrders.length === 0 && inspectionTasks.length === 0" class="empty">
        暂无待办
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
.section {
  margin-bottom: 40rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 24rpx;
}
.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}
.title {
  font-size: 30rpx;
  font-weight: bold;
  margin-bottom: 12rpx;
}
.meta {
  font-size: 24rpx;
  color: #666;
}
</style>
