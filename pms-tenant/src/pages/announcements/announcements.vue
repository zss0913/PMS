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
const buildingId = ref<number | null>(null)

function formatTime(v: string | null) {
  if (!v) return ''
  try {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('zh-CN')
  } catch {
    return v
  }
}

function goDetail(item: AnnouncementItem) {
  let url = `/pages/announcements/detail?id=${item.id}`
  if (buildingId.value != null) url += `&buildingId=${buildingId.value}`
  uni.navigateTo({ url })
}

onMounted(async () => {
  try {
    const ctx = (await get('/api/mp/work-order-submit-context')) as {
      success?: boolean
      data?: { buildingId?: number | null }
    }
    if (ctx.success && ctx.data?.buildingId != null) {
      buildingId.value = ctx.data.buildingId
    }
    const params: Record<string, string> = {}
    if (buildingId.value != null) params.buildingId = String(buildingId.value)
    const res = (await get('/api/mp/announcements', params)) as {
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
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">暂无公告</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card" @click="goDetail(item)">
        <view class="title">{{ item.title }}</view>
        <view class="meta" v-if="formatTime(item.publishTime)">{{ formatTime(item.publishTime) }}</view>
        <view class="hint">点击查看全文 ›</view>
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
  .title {
    font-size: 32rpx;
    font-weight: 600;
    color: $pms-text;
    margin-bottom: 12rpx;
  }
  .meta {
    font-size: 22rpx;
    color: $pms-text-dim;
  }
  .hint {
    margin-top: 16rpx;
    font-size: 24rpx;
    color: $pms-accent;
  }
}
</style>
