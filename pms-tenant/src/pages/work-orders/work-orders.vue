<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'

/** 与 PC 端工单状态一致 */
const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: '待派单', label: '待派单' },
  { value: '待响应', label: '待响应' },
  { value: '处理中', label: '处理中' },
  { value: '待员工确认费用', label: '待员工确认费用' },
  { value: '待租客确认费用', label: '待租客确认费用' },
  { value: '待评价', label: '待评价' },
  { value: '评价完成', label: '评价完成' },
  { value: '已取消', label: '已取消' },
] as const

interface WorkOrderItem {
  id: number
  code: string
  title: string
  type: string
  status: string
  createdAt: string
  buildingName?: string | null
  tenantName?: string | null
}

const list = ref<WorkOrderItem[]>([])
const loading = ref(true)
const statusTab = ref('')
const titleQ = ref('')
const titleInputDraft = ref('')
const statusBarHeight = ref(20)
/** 导航栏内容区高度（pt），保证可点区域 */
const navContentHeight = 48
/** 导航与下方内容区的呼吸间距（px），UI/UX Pro Max */
const navContentGapPx = 14

let searchDebounce: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  try {
    const sys = uni.getSystemInfoSync()
    statusBarHeight.value = sys.statusBarHeight ?? 20
  } catch {
    statusBarHeight.value = 20
  }
})

async function loadList() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (statusTab.value) params.status = statusTab.value
    if (titleQ.value.trim()) params.titleQ = titleQ.value.trim()
    const res = (await get('/api/mp/work-orders', params)) as {
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
}

onShow(() => {
  void loadList()
})

function goBack() {
  try {
    const pages = getCurrentPages()
    if (!pages || pages.length <= 1) {
      uni.switchTab({ url: '/pages/index/index' })
      return
    }
  } catch {
    uni.switchTab({ url: '/pages/index/index' })
    return
  }
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' })
    },
  })
}

function goCreate() {
  uni.navigateTo({ url: '/pages/work-orders/create' })
}

function goDetail(workOrderId: number) {
  uni.navigateTo({ url: `/pages/work-orders/detail?id=${workOrderId}` })
}

function setStatus(v: string) {
  if (statusTab.value === v) return
  statusTab.value = v
  void loadList()
}

function onSearchInput(e: { detail?: { value?: string } }) {
  const v = e.detail?.value ?? ''
  titleInputDraft.value = v
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    titleQ.value = v
    void loadList()
  }, 400)
}

function clearSearch() {
  titleInputDraft.value = ''
  titleQ.value = ''
  if (searchDebounce) clearTimeout(searchDebounce)
  void loadList()
}

const topInsetPx = () => statusBarHeight.value + navContentHeight
const pageContentTopPx = () => topInsetPx() + navContentGapPx

function formatListTime(iso: string) {
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
}
</script>

<template>
  <view class="shell">
    <!-- 自定义导航：右上角「报事报修」进入提交页 -->
    <view class="nav-wrap" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar" :style="{ minHeight: navContentHeight + 'px' }">
        <view class="nav-side nav-left">
          <view class="nav-back-hit" hover-class="nav-back-hit--active" @click.stop="goBack">
            <text class="nav-back">‹</text>
          </view>
        </view>
        <text class="nav-title">报事报修</text>
        <view class="nav-side nav-right">
          <view class="nav-action-hit" hover-class="nav-action-hit--active" @click.stop="goCreate">
            <text class="nav-action">报事报修</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page" :style="{ paddingTop: pageContentTopPx() + 'px' }">
      <view class="filter-panel">
        <text class="filter-label">按状态筛选</text>
        <view class="tabs-wrap">
          <scroll-view scroll-x class="tabs-scroll" :show-scrollbar="false" :enable-flex="true">
            <view class="tabs-inner">
              <view
                v-for="tab in STATUS_TABS"
                :key="tab.value || 'all'"
                class="tab-item"
                :class="{ active: statusTab === tab.value }"
                @click="setStatus(tab.value)"
              >
                {{ tab.label }}
              </view>
            </view>
          </scroll-view>
        </view>
        <view class="search-divider" />
        <text class="filter-label filter-label--second">标题搜索</text>
        <view class="search-row">
          <input
            class="search-input"
            type="text"
            :value="titleInputDraft"
            placeholder="按标题模糊搜索"
            placeholder-class="search-ph"
            confirm-type="search"
            @input="onSearchInput"
          />
          <text v-if="titleInputDraft" class="search-clear" @click="clearSearch">清除</text>
        </view>
      </view>

      <view v-if="loading" class="loading">加载中…</view>
      <view v-else-if="list.length === 0" class="empty">
        {{ titleQ.trim() || statusTab ? '暂无符合条件的工单' : '暂无工单' }}
      </view>
      <view v-else class="list">
        <view
          v-for="item in list"
          :key="item.id"
          class="card"
          hover-class="card--active"
          @click="goDetail(item.id)"
        >
          <view class="card-top">
            <view class="title">{{ item.title }}</view>
            <text class="chev">›</text>
          </view>
          <view class="meta">
            <text>{{ item.code }}</text>
            <text class="dot">·</text>
            <text>{{ item.type }}</text>
            <text class="dot">·</text>
            <text class="status">{{ item.status }}</text>
          </view>
          <view v-if="item.buildingName" class="sub">{{ item.buildingName }}</view>
          <view class="time">{{ formatListTime(item.createdAt) }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.shell {
  min-height: 100vh;
  background: $pms-bg-deep;
}

.nav-wrap {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(180deg, $pms-bg 0%, rgba(15, 23, 42, 0.97) 100%);
  border-bottom: 1rpx solid $pms-border;
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
}

.nav-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 12rpx 8rpx;
  box-sizing: border-box;
}

.nav-side {
  min-width: 140rpx;
  flex-shrink: 0;
}

.nav-left {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.nav-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.nav-back-hit {
  min-width: 88rpx;
  min-height: 88rpx;
  margin-left: -8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  @include pms-tap;
}

.nav-back-hit--active {
  opacity: 0.75;
  background: rgba(148, 163, 184, 0.12);
}

.nav-back {
  font-size: 52rpx;
  font-weight: 300;
  color: $pms-text;
  line-height: 1;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: $pms-text;
}

.nav-action-hit {
  min-height: 72rpx;
  padding: 0 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  @include pms-tap;
}

.nav-action-hit--active {
  background: rgba(56, 189, 248, 0.12);
}

.nav-action {
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-accent;
}

.page {
  padding: 0 24rpx calc(48rpx + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  min-height: 100vh;
}

.filter-panel {
  @include pms-card;
  padding: 28rpx 24rpx 32rpx;
  margin-bottom: 28rpx;
}

.filter-label {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: $pms-text-dim;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 20rpx;
}

.filter-label--second {
  margin-top: 8rpx;
  margin-bottom: 16rpx;
}

.search-divider {
  height: 1rpx;
  background: $pms-border;
  margin: 28rpx 0 24rpx;
}

.tabs-wrap {
  margin-bottom: 0;
}

.tabs-scroll {
  width: 100%;
  white-space: nowrap;
}

.tabs-inner {
  display: inline-flex;
  flex-direction: row;
  gap: 12rpx;
  padding-bottom: 4rpx;
}

.tab-item {
  flex-shrink: 0;
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  color: $pms-text-muted;
  border: 1rpx solid $pms-border;
  background: $pms-surface;
  @include pms-tap;
}

.tab-item.active {
  color: $pms-accent;
  border-color: rgba(56, 189, 248, 0.55);
  background: rgba(14, 165, 233, 0.12);
  font-weight: 600;
}

.search-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 0;
}

.search-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: $pms-surface;
  font-size: 28rpx;
  color: $pms-text;
  box-sizing: border-box;
}

.search-ph {
  color: $pms-text-dim;
}

.search-clear {
  font-size: 26rpx;
  color: $pms-accent;
  flex-shrink: 0;
  @include pms-tap;
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
    padding: 32rpx;
    margin-bottom: 24rpx;
  }
  .card--active {
    opacity: 0.92;
    transform: scale(0.99);
  }
  .card-top {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16rpx;
    margin-bottom: 16rpx;
  }
  .title {
    flex: 1;
    font-size: 30rpx;
    font-weight: 600;
    color: $pms-text;
    line-height: 1.4;
  }
  .chev {
    flex-shrink: 0;
    font-size: 40rpx;
    font-weight: 300;
    color: $pms-text-dim;
    line-height: 1;
    margin-top: -4rpx;
  }
  .meta {
    font-size: 24rpx;
    color: $pms-text-muted;
    margin-bottom: 12rpx;
  }
  .sub {
    font-size: 24rpx;
    color: $pms-text-dim;
    margin-bottom: 8rpx;
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
