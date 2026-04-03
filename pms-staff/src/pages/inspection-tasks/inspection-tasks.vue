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
  buildingName?: string | null
}

const list = ref<TaskItem[]>([])
const loading = ref(true)
const tab = ref<'all' | '待执行' | '巡检中' | '已完成'>('all')

async function load() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (tab.value !== 'all') params.status = tab.value
    const res = await get<{ list: TaskItem[] }>('/api/mp/inspection-tasks', params)
    if (res.success && res.data?.list) {
      list.value = res.data.list
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/inspection-tasks/detail?id=${id}` })
}

function setTab(t: typeof tab.value) {
  tab.value = t
  void load()
}
</script>

<template>
  <view class="page">
    <view class="tabs">
      <view
        v-for="t in (['all', '待执行', '巡检中', '已完成'] as const)"
        :key="t"
        class="tab"
        :class="{ on: tab === t }"
        @click="setTab(t)"
      >
        {{ t === 'all' ? '全部' : t }}
      </view>
    </view>
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">暂无巡检任务</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card" @click="goDetail(item.id)">
        <view class="title">{{ item.planName || item.code }}</view>
        <view class="meta">
          <text>{{ item.inspectionType }}</text>
          <text class="sep">|</text>
          <text>{{ item.scheduledDate?.slice(0, 10) }}</text>
        </view>
        <view v-if="item.buildingName" class="sub">楼宇：{{ item.buildingName }}</view>
        <view class="status">{{ item.status }}</view>
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

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.tab {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  background: rgba(255, 255, 255, 0.06);
  color: $pms-text-muted;
  &.on {
    background: rgba(34, 197, 94, 0.2);
    color: $pms-accent;
  }
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
  .sub {
    font-size: 24rpx;
    color: $pms-text-dim;
    margin-bottom: 12rpx;
  }
  .sep {
    margin: 0 12rpx;
    color: $pms-text-dim;
  }
  .status {
    font-size: 24rpx;
    font-weight: 500;
    color: $pms-accent;
  }
}
</style>
