<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'

interface WorkOrderItem {
  id: number
  code: string
  title: string
  type: string
  status: string
  createdAt: string
}

/** 与 PC / Next m/staff 工单状态 Tab 一致 */
const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: '待派单', label: '待派单' },
  { value: '待响应', label: '待响应' },
  { value: '处理中', label: '处理中' },
  { value: '待员工确认费用', label: '待员工确认费用' },
  { value: '待租客确认费用', label: '待租客确认费用' },
  { value: '待处理', label: '待处理' },
  { value: '待评价', label: '待评价' },
  { value: '评价完成', label: '评价完成' },
  { value: '已取消', label: '已取消' },
] as const

const list = ref<WorkOrderItem[]>([])
const loading = ref(true)
const activeTab = ref<string>('')
/** 输入框内容 */
const titleDraft = ref('')
/** 已参与请求的标题关键词（模糊） */
const appliedTitleQ = ref('')

function buildQueryParams(): Record<string, string> | undefined {
  const p: Record<string, string> = {}
  if (activeTab.value) {
    p.status = activeTab.value
  }
  const q = appliedTitleQ.value.trim()
  if (q) {
    p.titleQ = q
  }
  return Object.keys(p).length > 0 ? p : undefined
}

async function loadList(silent: boolean) {
  if (!silent) {
    loading.value = true
  }
  try {
    const res = (await get('/api/mp/work-orders', buildQueryParams())) as {
      success?: boolean
      list?: WorkOrderItem[]
    }
    if (res.success && Array.isArray(res.list)) {
      list.value = res.list
    }
  } catch {
    if (!silent) {
      uni.showToast({ title: '加载失败', icon: 'none' })
    }
  } finally {
    loading.value = false
  }
}

function selectTab(value: string) {
  if (activeTab.value === value) return
  activeTab.value = value
  void loadList(false)
}

function applyTitleSearch() {
  appliedTitleQ.value = titleDraft.value.trim()
  void loadList(false)
}

function clearTitleSearch() {
  titleDraft.value = ''
  appliedTitleQ.value = ''
  void loadList(false)
}

/** 每次进入页面或从详情返回时拉取最新列表，与详情中的状态一致 */
onShow(() => {
  void loadList(list.value.length > 0)
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

function emptyHint(): string {
  const parts: string[] = []
  if (activeTab.value) {
    parts.push(`「${activeTab.value}」`)
  }
  if (appliedTitleQ.value.trim()) {
    parts.push(`标题含「${appliedTitleQ.value.trim()}」`)
  }
  if (parts.length === 0) {
    return '暂无工单'
  }
  return `当前筛选下暂无工单（${parts.join('，')}）`
}
</script>

<template>
  <view class="page">
    <scroll-view class="tabs-wrap" scroll-x :show-scrollbar="false" :enable-flex="true">
      <view class="tabs-inner">
        <view
          v-for="tab in STATUS_TABS"
          :key="tab.value || 'all'"
          class="tab-chip"
          :class="{ 'tab-chip--on': activeTab === tab.value }"
          @tap="selectTab(tab.value)"
        >
          <text class="tab-text">{{ tab.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="search-bar">
      <input
        v-model="titleDraft"
        class="search-input"
        type="text"
        confirm-type="search"
        placeholder="标题关键词模糊搜索"
        @confirm="applyTitleSearch"
      />
      <button class="search-btn" @click="applyTitleSearch">搜索</button>
      <button
        v-if="appliedTitleQ.trim() || titleDraft.trim()"
        class="search-clear"
        @click="clearTitleSearch"
      >
        清除
      </button>
    </view>

    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">{{ emptyHint() }}</view>
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
  padding-top: 16rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.tabs-wrap {
  width: 100%;
  white-space: nowrap;
  margin-bottom: 20rpx;
}

.tabs-inner {
  display: inline-flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 12rpx;
  padding: 0 8rpx 8rpx;
}

.tab-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: $pms-surface;
  border: 1rpx solid $pms-border;
  flex-shrink: 0;
}

.tab-chip--on {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.55);
}

.tab-text {
  font-size: 24rpx;
  color: $pms-text-muted;
  white-space: nowrap;
}

.tab-chip--on .tab-text {
  color: $pms-accent;
  font-weight: 600;
}

.search-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  background: $pms-surface;
  border: 1rpx solid $pms-border;
  font-size: 28rpx;
  color: $pms-text;
  box-sizing: border-box;
}

.search-btn {
  flex-shrink: 0;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 28rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  background: $pms-accent;
  color: #fff;
  border: none;
}

.search-btn::after {
  border: none;
}

.search-clear {
  flex-shrink: 0;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 20rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  background: transparent;
  color: $pms-text-muted;
  border: 1rpx solid $pms-border;
}

.search-clear::after {
  border: none;
}

.loading,
.empty {
  text-align: center;
  padding: 80rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
  line-height: 1.5;
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
