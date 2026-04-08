<template>
  <view class="container">
    <u-tabs :list="tabs" :current="current" :scrollable="true" @click="handleTabClick"></u-tabs>
    <view class="search-bar">
      <u-search
        v-model="titleInputDraft"
        placeholder="搜索标题"
        :show-action="false"
        @clear="clearSearch"
      ></u-search>
    </view>

    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="workOrders.length === 0" class="empty">
      {{ titleQ.trim() || statusValue ? '暂无符合条件的工单' : '暂无工单' }}
    </view>
    <view v-else class="list">
      <view
        v-for="item in workOrders"
        :key="item.id"
        class="list-item"
        @click="goToDetail(item.id)"
      >
        <view class="header">
          <text class="title">{{ item.title }}</text>
          <u-tag :text="item.status" :type="statusTagType(item.status)" size="mini"></u-tag>
        </view>
        <view class="content">
          <view class="meta">
            <text class="mono">{{ item.code }}</text>
            <text class="dot">·</text>
            <text>{{ item.type }}</text>
          </view>
          <view v-if="item.buildingName" class="sub">{{ item.buildingName }}</view>
          <view class="time">提交时间：{{ fmtTime(item.createdAt) }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { formatDateTime } from '../../utils/datetime.js'

/** 与 pms-tenant「我的工单」及 PC 工单状态一致 */
const STATUS_VALUES = [
  '',
  '待派单',
  '待响应',
  '处理中',
  '待员工确认费用',
  '待租客确认费用',
  '待评价',
  '评价完成',
  '已取消',
]

const tabs = STATUS_VALUES.map((v) => ({
  name: v === '' ? '全部' : v,
}))

const current = ref(0)
const statusValue = ref('')
const workOrders = ref([])
const loading = ref(true)
const titleQ = ref('')
const titleInputDraft = ref('')

let searchDebounce = null

function fmtTime(s) {
  return formatDateTime(s)
}

function statusTagType(status) {
  const s = String(status || '')
  if (s === '已取消') return 'error'
  if (s === '评价完成') return 'success'
  if (s === '待评价' || s === '待租客确认费用') return 'warning'
  if (s === '待员工确认费用' || s === '待派单' || s === '待响应') return 'primary'
  return 'info'
}

async function loadList() {
  loading.value = true
  try {
    const params = {}
    if (statusValue.value) params.status = statusValue.value
    if (titleQ.value.trim()) params.titleQ = titleQ.value.trim()
    const res = await get('/api/mp/work-orders', params)
    workOrders.value = res.success && Array.isArray(res.list) ? res.list : []
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    workOrders.value = []
  } finally {
    loading.value = false
  }
}

function handleTabClick(e) {
  const idx = typeof e.index === 'number' ? e.index : 0
  current.value = idx
  statusValue.value = STATUS_VALUES[idx] ?? ''
  void loadList()
}

function clearSearch() {
  titleInputDraft.value = ''
  titleQ.value = ''
}

watch(
  () => titleInputDraft.value,
  (v) => {
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      titleQ.value = v
      void loadList()
    }, 400)
  }
)

onBeforeUnmount(() => {
  if (searchDebounce) clearTimeout(searchDebounce)
})

onShow(() => {
  void loadList()
})

function goToDetail(id) {
  uni.navigateTo({ url: '/pages/repair/detail?id=' + id })
}
</script>

<style lang="scss" scoped>
.container {
  padding: 0;
  min-height: 100vh;
  background: #f5f6f7;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

.search-bar {
  padding: 16rpx 24rpx;
  background: #fff;
}

.loading,
.empty {
  text-align: center;
  padding: 80rpx 40rpx;
  color: #909399;
  font-size: 28rpx;
}

.list {
  padding: 24rpx;
}

.list-item {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16rpx;
    margin-bottom: 16rpx;
    .title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      flex: 1;
      line-height: 1.4;
    }
  }

  .content {
    .meta {
      font-size: 24rpx;
      color: #909399;
      margin-bottom: 8rpx;
    }
    .mono {
      font-size: 24rpx;
      font-family: monospace;
    }
    .dot {
      margin: 0 8rpx;
      color: #c0c4cc;
    }
    .sub {
      font-size: 24rpx;
      color: #606266;
      margin-bottom: 8rpx;
    }
    .time {
      font-size: 24rpx;
      color: #999;
      margin-top: 16rpx;
    }
  }
}
</style>
