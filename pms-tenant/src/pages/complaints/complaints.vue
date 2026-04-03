<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'
import { resolveMediaUrl } from '@/api/work-order-upload'

interface ComplaintItem {
  id: number
  location: string
  description: string
  status: string
  buildingName?: string
  tenantName?: string
  createdAt: string
  images?: string[]
}

const list = ref<ComplaintItem[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await get<{ list: ComplaintItem[] }>('/api/mp/complaints')
    if (res.success && res.data?.list) {
      list.value = res.data.list
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function goSubmit() {
  uni.navigateTo({ url: '/pages/complaints/submit' })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/complaints/detail?id=${id}` })
}

function fmtTime(s: string) {
  try {
    return s.slice(0, 16).replace('T', ' ')
  } catch {
    return s
  }
}
</script>

<template>
  <view class="page">
    <view class="toolbar">
      <button class="btn" type="primary" @click="goSubmit">我要吐槽</button>
    </view>
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">暂无吐槽，点击上方提交</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card" @click="goDetail(item.id)">
        <view class="row-top">
          <text class="status">{{ item.status }}</text>
          <text class="time">{{ fmtTime(item.createdAt) }}</text>
        </view>
        <view v-if="item.buildingName || item.tenantName" class="meta">
          <text v-if="item.buildingName">{{ item.buildingName }}</text>
          <text v-if="item.buildingName && item.tenantName" class="sep">·</text>
          <text v-if="item.tenantName">{{ item.tenantName }}</text>
        </view>
        <view class="desc">{{ item.description }}</view>
        <view v-if="item.images?.length" class="thumbs">
          <image
            v-for="(u, i) in item.images.slice(0, 3)"
            :key="i"
            :src="resolveMediaUrl(u)"
            mode="aspectFill"
            class="thumb"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
  padding-bottom: 48rpx;
}

.toolbar {
  margin-bottom: 24rpx;
}
.btn {
  width: 100%;
  background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
  border: none;
  font-size: 30rpx;
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
    padding: 28rpx;
    margin-bottom: 24rpx;
  }
  .row-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12rpx;
  }
  .status {
    font-size: 26rpx;
    font-weight: 600;
    color: $pms-accent;
  }
  .time {
    font-size: 22rpx;
    color: $pms-text-dim;
  }
  .meta {
    font-size: 24rpx;
    color: $pms-text-muted;
    margin-bottom: 12rpx;
  }
  .sep {
    margin: 0 8rpx;
  }
  .desc {
    font-size: 28rpx;
    color: $pms-text;
    line-height: 1.55;
  }
  .thumbs {
    display: flex;
    gap: 12rpx;
    margin-top: 16rpx;
  }
  .thumb {
    width: 160rpx;
    height: 160rpx;
    border-radius: 12rpx;
  }
}
</style>
