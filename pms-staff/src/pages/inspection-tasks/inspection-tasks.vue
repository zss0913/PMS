<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'

const FILTER_STORAGE = 'pms_inspection_list_filters_v1'

interface TaskItem {
  id: number
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  buildingName?: string | null
}

/** 与 PC 端巡检大类一致，对应任务 inspectionType 前缀（工程巡检、安保巡检等） */
const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: '工程', label: '工程巡检' },
  { key: '安保', label: '安保巡检' },
  { key: '设备', label: '设备巡检' },
  { key: '绿化', label: '绿化巡检' },
]

const list = ref<TaskItem[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 15
const hasMore = ref(false)
const refresherTriggered = ref(false)
const categoryKey = ref(CATEGORY_TABS[0]!.key)

const filterDateFrom = ref('')
const filterDateTo = ref('')
const filterStatus = ref('')

const statusBarH = ref(20)
const navBarH = ref(44)
/** 与微信胶囊对齐，避免「筛选」被遮挡（单位 px） */
const navFilterRightPx = ref(24)
/** 窗口高度、底部安全区（px），用于列表区域 scroll-view */
const windowHeightPx = ref(667)
const safeBottomPx = ref(0)
/** 吸顶分类条总高度：上内边距 + tab 行 + 下内边距（与 .tabs-sticky 样式一致，单位 rpx 换算） */
const tabsStickyBlockPx = ref(56)

const listHeightPx = computed(() => {
  const top = statusBarH.value + navBarH.value + tabsStickyBlockPx.value
  return Math.max(120, windowHeightPx.value - top - safeBottomPx.value)
})

function rpxToPx(rpx: number, winW: number) {
  return (rpx / 750) * winW
}

const hasActiveFilters = computed(
  () =>
    Boolean(filterDateFrom.value || filterDateTo.value || filterStatus.value)
)

function initNavMetrics() {
  try {
    const sys = uni.getSystemInfoSync()
    const winW = sys.windowWidth || 375
    windowHeightPx.value = sys.windowHeight || 667
    safeBottomPx.value = sys.safeAreaInsets?.bottom ?? 0
    statusBarH.value = sys.statusBarHeight || 20
    // 与 .tabs-sticky：上内边距 + tab 行 + 与条数间距 + 条数行 + 下内边距
    tabsStickyBlockPx.value = rpxToPx(16 + 72 + 10 + 34 + 20, winW)
    // #ifdef MP-WEIXIN
    const mb = uni.getMenuButtonBoundingClientRect()
    if (mb && mb.top != null && mb.height) {
      navBarH.value = (mb.top - statusBarH.value) * 2 + mb.height
    }
    if (mb && mb.left != null && sys.windowWidth) {
      navFilterRightPx.value = Math.max(16, sys.windowWidth - mb.left + 8)
    }
    // #endif
  } catch {
    /* ignore */
  }
}

function readFiltersFromStorage() {
  try {
    const raw = uni.getStorageSync(FILTER_STORAGE)
    if (!raw) {
      filterDateFrom.value = ''
      filterDateTo.value = ''
      filterStatus.value = ''
      return
    }
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw
    filterDateFrom.value = p.dateFrom || ''
    filterDateTo.value = p.dateTo || ''
    filterStatus.value = p.status || ''
  } catch {
    filterDateFrom.value = ''
    filterDateTo.value = ''
    filterStatus.value = ''
  }
}

function buildParams(forPage: number) {
  const params: Record<string, string> = {
    category: categoryKey.value,
    page: String(forPage),
    pageSize: String(pageSize),
  }
  if (filterDateFrom.value) params.dateFrom = filterDateFrom.value
  if (filterDateTo.value) params.dateTo = filterDateTo.value
  if (filterStatus.value) params.status = filterStatus.value
  return params
}

/** 重新拉第一页（进入页、筛选、切换分类） */
async function load() {
  loading.value = true
  page.value = 1
  try {
    const res = await get<{
      list: TaskItem[]
      total?: number
      hasMore?: boolean
    }>('/api/mp/inspection-tasks', buildParams(1))
    if (res.success && res.data?.list) {
      list.value = res.data.list
      total.value = typeof res.data.total === 'number' ? res.data.total : list.value.length
      hasMore.value = Boolean(res.data.hasMore)
    }
  } catch {
    list.value = []
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function onRefresherRefresh() {
  refresherTriggered.value = true
  page.value = 1
  try {
    const res = await get<{
      list: TaskItem[]
      total?: number
      hasMore?: boolean
    }>('/api/mp/inspection-tasks', buildParams(1))
    if (res.success && res.data?.list) {
      list.value = res.data.list
      total.value = typeof res.data.total === 'number' ? res.data.total : list.value.length
      hasMore.value = Boolean(res.data.hasMore)
    }
  } catch {
    uni.showToast({ title: '刷新失败', icon: 'none' })
  } finally {
    refresherTriggered.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  const next = page.value + 1
  loadingMore.value = true
  try {
    const res = await get<{
      list: TaskItem[]
      total?: number
      hasMore?: boolean
      page?: number
    }>('/api/mp/inspection-tasks', buildParams(next))
    if (res.success && res.data?.list) {
      const seen = new Set(list.value.map((x) => x.id))
      for (const row of res.data.list) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          list.value.push(row)
        }
      }
      total.value = typeof res.data.total === 'number' ? res.data.total : total.value
      hasMore.value = Boolean(res.data.hasMore)
      page.value = next
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loadingMore.value = false
  }
}

function onScrollToLower() {
  void loadMore()
}

onMounted(() => {
  initNavMetrics()
})

onShow(() => {
  readFiltersFromStorage()
  void load()
})

function goBack() {
  uni.navigateBack({
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' })
    },
  })
}

function openFilter() {
  uni.navigateTo({ url: '/pages/inspection-tasks/filter' })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/inspection-tasks/detail?id=${id}` })
}

function setCategory(key: string) {
  categoryKey.value = key
  void load()
}
</script>

<template>
  <view class="wrap">
    <view class="nav" :style="{ paddingTop: statusBarH + 'px' }">
      <view class="nav-inner" :style="{ height: navBarH + 'px' }">
        <view class="nav-back" @click="goBack">
          <text class="nav-back-icon">‹</text>
        </view>
        <text class="nav-title">巡检任务</text>
        <view class="nav-filter" :style="{ right: navFilterRightPx + 'px' }" @click="openFilter">
          <text class="nav-filter-text">筛选</text>
          <view v-if="hasActiveFilters" class="nav-dot" />
        </view>
      </view>
    </view>

    <view
      class="tabs-sticky"
      :style="{
        top: statusBarH + navBarH + 'px',
        height: tabsStickyBlockPx + 'px',
      }"
    >
      <scroll-view class="tabs-scroll" scroll-x :show-scrollbar="false" enable-flex>
        <view class="tabs-inner">
          <view
            v-for="t in CATEGORY_TABS"
            :key="t.key"
            class="tab"
            :class="{ on: categoryKey === t.key }"
            @click="setCategory(t.key)"
          >
            {{ t.label }}
          </view>
        </view>
      </scroll-view>
      <view class="count-row">
        <text v-if="loading" class="count-text">查询中…</text>
        <text v-else class="count-text">共 {{ total }} 条，已加载 {{ list.length }} 条</text>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="list-scroll"
      :style="{
        marginTop: statusBarH + navBarH + tabsStickyBlockPx + 'px',
        height: listHeightPx + 'px',
      }"
      :enable-back-to-top="true"
      refresher-enabled
      :refresher-triggered="refresherTriggered"
      @refresherrefresh="onRefresherRefresh"
      lower-threshold="100"
      @scrolltolower="onScrollToLower"
    >
      <view class="scroll-pad">
        <view v-if="loading" class="loading">加载中…</view>
        <view v-else-if="list.length === 0" class="empty">暂无符合条件的巡检任务</view>
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
          <view v-if="loadingMore" class="load-more">加载中…</view>
          <view v-else-if="list.length > 0 && !hasMore" class="load-more muted">没有更多了</view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.wrap {
  min-height: 100vh;
  background: #0f172a;
}
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: #0f172a;
}
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 24rpx;
  box-sizing: border-box;
}
.nav-back {
  position: absolute;
  left: 8rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-back-icon {
  font-size: 48rpx;
  color: #e2e8f0;
  line-height: 1;
}
.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #f8fafc;
}
.nav-filter {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  padding: 8rpx 16rpx;
}
.nav-filter-text {
  font-size: 28rpx;
  color: #60a5fa;
  font-weight: 500;
}
.nav-dot {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #22c55e;
}

.tabs-sticky {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 190;
  background: #0f172a;
  box-sizing: border-box;
  padding: 16rpx 24rpx 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.count-row {
  margin-top: 10rpx;
  flex-shrink: 0;
}
.count-text {
  font-size: 24rpx;
  color: $pms-text-muted;
  line-height: 34rpx;
}

.tabs-scroll {
  width: 100%;
  white-space: nowrap;
  height: 72rpx;
}
.tabs-inner {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  height: 72rpx;
}
.tab {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  background: rgba(255, 255, 255, 0.06);
  color: $pms-text-muted;
  &.on {
    background: rgba(34, 197, 94, 0.2);
    color: $pms-accent;
  }
}

.list-scroll {
  width: 100%;
  box-sizing: border-box;
}
.scroll-pad {
  padding: 0 24rpx 32rpx;
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
.load-more {
  text-align: center;
  padding: 24rpx 16rpx 8rpx;
  font-size: 24rpx;
  color: $pms-text-muted;
  &.muted {
    color: $pms-text-dim;
  }
}
</style>
