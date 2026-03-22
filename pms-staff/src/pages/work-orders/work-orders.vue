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
    const res = (await get('/api/mp/work-orders')) as {
      success?: boolean
      list?: WorkOrderItem[]
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

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/work-orders/detail?id=${id}` })
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">暂无工单</view>
    <view v-else class="list">
      <view
        v-for="item in list"
        :key="item.id"
        class="card"
        @click="goDetail(item.id)"
      >
        <view class="card-top">
          <view class="title">{{ item.title }}</view>
          <text class="arrow">›</text>
        </view>
        <view class="meta">
          <text>{{ item.code }}</text>
          <text class="dot">·</text>
          <text>{{ item.type }}</text>
          <text class="dot">·</text>
          <text class="status">{{ item.status }}</text>
        </view>
        <view class="time">{{ formatTime(item.createdAt) }}</view>
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
  .card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16rpx;
    margin-bottom: 16rpx;
  }
  .title {
    font-size: 30rpx;
    font-weight: 600;
    color: $pms-text;
    flex: 1;
    min-width: 0;
  }
  .arrow {
    font-size: 40rpx;
    color: $pms-text-dim;
    line-height: 1;
    flex-shrink: 0;
  }
  .meta {
    font-size: 24rpx;
    color: $pms-text-muted;
    margin-bottom: 12rpx;
    flex-wrap: wrap;
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
