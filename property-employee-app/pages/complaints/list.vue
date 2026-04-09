<template>
  <view class="container">
    <u-tabs :list="tabList" :current="current" @click="handleTabClick"></u-tabs>

    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="list.length === 0" class="hint">{{ emptyHint }}</view>
    <view v-else class="list-wrap">
      <view v-for="item in list" :key="item.id" class="card" @tap="goDetail(item.id)">
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

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { openPage } from '../../utils/navigate.js'

const TAB_KEYS = ['all', 'pending', 'processing', 'completed']
const LABELS = {
  all: '全部',
  pending: '待处理',
  processing: '处理中',
  completed: '已处理',
}

const current = ref(0)
const loading = ref(true)
const list = ref([])
const counts = ref({ all: 0, pending: 0, processing: 0, completed: 0 })

const tabList = computed(() =>
  TAB_KEYS.map((k) => ({ name: `${LABELS[k]} ${counts.value[k] ?? 0}` }))
)

const emptyHint = computed(() => {
  const k = TAB_KEYS[current.value]
  if (k === 'all') return '暂无卫生吐槽'
  return '该状态下暂无记录'
})

async function loadList() {
  loading.value = true
  try {
    const statusTab = TAB_KEYS[current.value]
    const res = await get('/api/mp/staff/complaints', { statusTab })
    if (res.success && res.data && Array.isArray(res.data.list)) {
      list.value = res.data.list
      const c = res.data.counts
      if (c) {
        counts.value = {
          all: c.all ?? 0,
          pending: c.pending ?? 0,
          processing: c.processing ?? 0,
          completed: c.completed ?? 0,
        }
      }
    } else {
      list.value = []
    }
  } catch (e) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' })
    list.value = []
  } finally {
    loading.value = false
  }
}

onShow(() => {
  void loadList()
})

function handleTabClick(item) {
  current.value = item.index
  void loadList()
}

function goDetail(id) {
  openPage('/pages/complaints/detail?id=' + id)
}

function fmtTime(s) {
  try {
    return s.slice(0, 16).replace('T', ' ')
  } catch {
    return s
  }
}
</script>

<style lang="scss" scoped>
.container {
  padding: 0;
  min-height: 100vh;
  background: #f5f6f7;
}

.hint {
  text-align: center;
  padding: 80rpx 40rpx;
  color: #909399;
  font-size: 28rpx;
}

.list-wrap {
  padding: 24rpx;
  box-sizing: border-box;
  padding-bottom: 48rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
  border: 1rpx solid #ebeef5;
  &:active {
    opacity: 0.92;
  }
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
  color: #333;
}

.status {
  font-size: 24rpx;
  color: #2979ff;
}

.meta {
  font-size: 24rpx;
  color: #909399;
  margin-bottom: 8rpx;
}

.sep {
  margin: 0 8rpx;
}

.assignee {
  font-size: 24rpx;
  color: #c0c4cc;
  margin-bottom: 8rpx;
}

.desc {
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}

.time {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #c0c4cc;
}
</style>
