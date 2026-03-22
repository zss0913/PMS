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
    <view class="toolbar">
      <button class="btn-add" size="mini" @click="goCreate">+ 报修</button>
    </view>
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">暂无工单</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card">
        <view class="title">{{ item.title }}</view>
        <view class="meta">
          <text>{{ item.code }}</text>
          <text class="dot">·</text>
          <text>{{ item.type }}</text>
          <text class="dot">·</text>
          <text class="status">{{ item.status }}</text>
        </view>
        <view class="time">{{ item.createdAt }}</view>
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

.toolbar {
  margin-bottom: 24rpx;
}

.btn-add {
  background: linear-gradient(135deg, $pms-accent 0%, #0ea5e9 100%);
  color: #fff;
  border: none;
  border-radius: 12rpx;
  font-weight: 600;
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
    font-size: 30rpx;
    font-weight: 600;
    color: $pms-text;
    margin-bottom: 16rpx;
  }
  .meta {
    font-size: 24rpx;
    color: $pms-text-muted;
    margin-bottom: 12rpx;
  }
  .dot {
    margin: 0 8rpx;
    color: $pms-text-dim;
  }
  .status {
    color: $pms-accent;
  }
  .time {
    font-size: 22rpx;
    color: $pms-text-dim;
  }
}
</style>
