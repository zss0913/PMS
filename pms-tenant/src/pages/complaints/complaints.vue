<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'
import { resolveMediaUrl, isMediaVideoUrl } from '@/api/work-order-upload'

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

type StatusTab = 'all' | 'pending' | 'processing' | 'completed'

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'processing', label: '处理中' },
  { key: 'completed', label: '已处理' },
]

const list = ref<ComplaintItem[]>([])
const loading = ref(true)
const activeTab = ref<StatusTab>('all')
const counts = ref({ all: 0, pending: 0, processing: 0, completed: 0 })

async function loadList() {
  loading.value = true
  try {
    const res = (await get('/api/mp/complaints', { statusTab: activeTab.value })) as {
      success?: boolean
      data?: { list?: ComplaintItem[]; counts?: typeof counts.value }
    }
    if (res.success && res.data?.list) {
      list.value = res.data.list
    } else {
      list.value = []
    }
    if (res.data?.counts) {
      counts.value = {
        all: res.data.counts.all ?? 0,
        pending: res.data.counts.pending ?? 0,
        processing: res.data.counts.processing ?? 0,
        completed: res.data.counts.completed ?? 0,
      }
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
    list.value = []
  } finally {
    loading.value = false
  }
}

function setTab(key: StatusTab) {
  if (activeTab.value === key) return
  activeTab.value = key
  void loadList()
}

function tabCount(key: StatusTab): number {
  return counts.value[key]
}

onShow(() => {
  void loadList()
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

    <view class="tabs-card">
      <scroll-view scroll-x class="tabs-scroll" :show-scrollbar="false" :enable-flex="true">
        <view class="tabs-inner">
          <view
            v-for="tab in TABS"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            @click="setTab(tab.key)"
          >
            {{ tab.label }}（{{ tabCount(tab.key) }}）
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">
      {{ activeTab === 'all' ? '暂无吐槽，点击上方提交' : '该状态下暂无记录' }}
    </view>
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
          <template v-for="(u, i) in item.images.slice(0, 3)" :key="i">
            <video
              v-if="isMediaVideoUrl(u)"
              :src="resolveMediaUrl(u)"
              class="thumb thumb-video"
              muted
              :show-center-play-btn="false"
              :controls="false"
            />
            <image
              v-else
              :src="resolveMediaUrl(u)"
              mode="aspectFill"
              class="thumb"
            />
          </template>
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
  background: $pms-bg-deep;
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

.tabs-card {
  @include pms-card;
  padding: 16rpx 8rpx 20rpx;
  margin-bottom: 24rpx;
}

.tabs-scroll {
  width: 100%;
  white-space: nowrap;
}

.tabs-inner {
  display: inline-flex;
  flex-direction: row;
  gap: 8rpx;
  padding: 4rpx 8rpx 8rpx;
  min-width: 100%;
  box-sizing: border-box;
}

.tab-item {
  flex-shrink: 0;
  padding: 14rpx 22rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: $pms-text-muted;
  border: 1rpx solid transparent;
  background: transparent;
  @include pms-tap;
}

.tab-item.active {
  color: $pms-accent;
  font-weight: 600;
  border-color: rgba(56, 189, 248, 0.45);
  background: rgba(14, 165, 233, 0.12);
  box-shadow: inset 0 -4rpx 0 0 $pms-accent;
}

.loading,
.empty {
  text-align: center;
  padding: 80rpx 40rpx;
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
  .thumb-video {
    object-fit: cover;
    background: rgba(0, 0, 0, 0.35);
  }
}
</style>
