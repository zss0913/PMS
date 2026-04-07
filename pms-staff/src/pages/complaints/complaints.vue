<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'

type StatusTab = 'all' | 'pending' | 'processing' | 'completed'

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'processing', label: '处理中' },
  { key: 'completed', label: '已处理' },
]

interface ComplaintItem {
  id: number
  code: string
  description: string
  status: string
  buildingName?: string
  tenantName?: string
  assignedToName?: string | null
  createdAt: string
}

const list = ref<ComplaintItem[]>([])
const loading = ref(true)
const activeTab = ref<StatusTab>('all')
const counts = ref({ all: 0, pending: 0, processing: 0, completed: 0 })

async function loadList() {
  loading.value = true
  try {
    const res = (await get('/api/mp/staff/complaints', { statusTab: activeTab.value })) as {
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
      {{ activeTab === 'all' ? '暂无卫生吐槽' : '该状态下暂无记录' }}
    </view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card" @click="goDetail(item.id)">
        <view class="row-top">
          <text class="code">{{ item.code }}</text>
          <text class="status">{{ item.status }}</text>
        </view>
        <view v-if="item.buildingName || item.tenantName" class="meta">
          <text v-if="item.buildingName">{{ item.buildingName }}</text>
          <text v-if="item.buildingName && item.tenantName" class="sep">·</text>
          <text v-if="item.tenantName">{{ item.tenantName }}</text>
        </view>
        <view v-if="item.assignedToName" class="assignee">处理人：{{ item.assignedToName }}</view>
        <view class="desc">{{ item.description }}</view>
        <view class="time">{{ fmtTime(item.createdAt) }}</view>
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
  gap: 12rpx;
  padding: 0 8rpx;
}

.tab-item {
  display: inline-block;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  color: $pms-text-muted;
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid $pms-border;
}

.tab-item.active {
  color: $pms-accent;
  border-color: rgba(34, 197, 94, 0.45);
  background: rgba(34, 197, 94, 0.12);
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
  .code {
    font-size: 28rpx;
    font-weight: 600;
    color: $pms-text;
  }
  .status {
    font-size: 24rpx;
    color: $pms-accent;
  }
  .meta {
    font-size: 24rpx;
    color: $pms-text-muted;
    margin-bottom: 8rpx;
  }
  .sep {
    margin: 0 8rpx;
  }
  .assignee {
    font-size: 24rpx;
    color: $pms-text-dim;
    margin-bottom: 8rpx;
  }
  .desc {
    font-size: 28rpx;
    color: $pms-text;
    line-height: 1.5;
  }
  .time {
    margin-top: 12rpx;
    font-size: 22rpx;
    color: $pms-text-dim;
  }
}
</style>
