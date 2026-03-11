<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'

interface WorkOrderItem {
  id: number
  code: string
  title: string
  type: string
  status: string
  createdAt: string
}

const list = ref<WorkOrderItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await get<{ list: WorkOrderItem[] }>('/api/mp/work-orders')
    if (res.success && res.data) {
      list.value = res.data.list
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function goCreate() {
  uni.showToast({ title: '请在小程序内提交报修', icon: 'none' })
}
</script>

<template>
  <view class="page">
    <view class="header">
      <button class="btn-add" size="mini" @click="goCreate">+ 报修</button>
    </view>
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else-if="list.length === 0" class="empty">暂无工单</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card">
        <view class="title">{{ item.title }}</view>
        <view class="meta">
          <text>{{ item.code }}</text>
          <text>{{ item.type }}</text>
          <text>{{ item.status }}</text>
        </view>
        <view class="time">{{ item.createdAt }}</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
}
.header {
  margin-bottom: 24rpx;
}
.btn-add {
  background: #007aff;
  color: #fff;
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
  .time {
    font-size: 24rpx;
    color: #999;
  }
}
</style>
