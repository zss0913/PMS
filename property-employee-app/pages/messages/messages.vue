<template>
  <view class="page">
    <!-- 筛选：全部后接物业公告，再为业务类型 -->
    <view class="filter-wrap">
      <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
        <view class="filter-inner">
          <view
            v-for="f in filterItems"
            :key="f.key"
            class="filter-chip"
            :class="{ active: filterKey === f.key }"
            @tap="filterKey = f.key"
          >
            <text class="filter-label">{{ f.label }}</text>
            <view v-if="f.badge > 0" class="filter-badge">
              <text class="filter-badge-txt">{{ f.badge > 99 ? '99+' : f.badge }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="loading" class="loading">加载中…</view>
    <scroll-view
      v-else
      scroll-y
      class="list-scroll"
      :style="{ height: scrollHeightPx + 'px' }"
      :enable-flex="true"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onPullRefresh"
    >
      <view v-if="filteredList.length === 0" class="empty-wrap">
        <u-empty mode="message" :text="emptyText" margin-top="24"></u-empty>
      </view>

      <view v-else class="feed">
        <view v-for="block in groupedFeed" :key="block.label" class="time-block">
          <text class="time-block-label">{{ block.label }}</text>
          <view
            v-for="(item, idx) in block.items"
            :key="item.kind + '-' + item.id + '-' + idx"
            class="msg-card"
            @tap="onTapBusiness(item)"
          >
            <view class="msg-accent" :class="'accent-' + item.kind"></view>
            <view class="msg-body">
              <view class="msg-top">
                <text class="msg-kind">{{ kindShort[item.kind] }}</text>
                <text class="msg-time">{{ formatListTime(item.time) }}</text>
              </view>
              <view class="msg-title-row">
                <text class="msg-title">{{ item.title }}</text>
                <view v-if="!item.read" class="unread-dot" />
              </view>
              <text v-if="item.summary" class="msg-summary">{{ item.summary }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="list-pad" />
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, post } from '../../utils/request.js'
import { formatDateTime } from '../../utils/datetime.js'
import { openPage } from '../../utils/navigate.js'
import { getSystemInfoCompat } from '../../utils/system-info.js'

const kindShort = {
  announcement: '公告',
  work_order: '工单',
  inspection_task: '巡检',
  complaint: '吐槽',
}

const loading = ref(true)
const refreshing = ref(false)
const announcements = ref([])
const business = ref([])
/** 全部：公告 + 业务通知，按时间倒序（与接口 list 一致） */
const timelineAll = ref([])
const unreadCounts = ref({ work_order: 0, inspection_task: 0, complaint: 0 })
/** all | announcement | work_order | inspection_task | complaint */
const filterKey = ref('all')

/** 微信小程序 scroll-y 必须固定高度，避免 flex+height:0 导致触摸/滚动异常 */
const scrollHeightPx = ref(480)

const filteredList = computed(() => {
  if (filterKey.value === 'all') return [...timelineAll.value]
  if (filterKey.value === 'announcement') return [...announcements.value]
  return business.value.filter((it) => it.kind === filterKey.value)
})

const filterItems = computed(() => {
  const u = unreadCounts.value
  const businessUnread = u.work_order + u.inspection_task + u.complaint
  return [
    { key: 'all', label: '全部', badge: businessUnread },
    { key: 'announcement', label: '物业公告', badge: 0 },
    { key: 'work_order', label: '工单', badge: u.work_order },
    { key: 'inspection_task', label: '巡检', badge: u.inspection_task },
    { key: 'complaint', label: '卫生吐槽', badge: u.complaint },
  ]
})

function dayStart(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function timeBucketLabel(iso) {
  const t = new Date(iso).getTime()
  const today0 = dayStart(Date.now())
  const day = 86400000
  const diff = Math.floor((today0 - dayStart(t)) / day)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return '更早'
}

const groupedFeed = computed(() => {
  const list = filteredList.value
  const order = ['今天', '昨天', '更早']
  const buckets = { 今天: [], 昨天: [], 更早: [] }
  for (const item of list) {
    const lb = timeBucketLabel(item.time)
    buckets[lb].push(item)
  }
  return order.filter((k) => buckets[k].length).map((label) => ({ label, items: buckets[label] }))
})

const emptyText = computed(() => {
  if (filterKey.value === 'announcement') return '暂无公告'
  if (filterKey.value === 'all') return '暂无消息'
  if (!business.value.length) return '暂无业务消息'
  return '该分类下暂无消息'
})

async function load(options) {
  const initial = options?.initial !== false
  if (initial) loading.value = true
  try {
    const res = await get('/api/mp/my-messages')
    if (res.success) {
      if (Array.isArray(res.announcements)) {
        announcements.value = res.announcements
      }
      if (Array.isArray(res.business)) {
        business.value = res.business
      } else if (Array.isArray(res.list)) {
        business.value = res.list.filter(
          (it) => it.kind === 'work_order' || it.kind === 'inspection_task' || it.kind === 'complaint'
        )
      }
      if (Array.isArray(res.list)) {
        timelineAll.value = res.list
      } else {
        const merged = [...announcements.value, ...business.value]
        merged.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        timelineAll.value = merged
      }
      if (res.unreadCounts && typeof res.unreadCounts === 'object') {
        unreadCounts.value = {
          work_order: Number(res.unreadCounts.work_order) || 0,
          inspection_task: Number(res.unreadCounts.inspection_task) || 0,
          complaint: Number(res.unreadCounts.complaint) || 0,
        }
      }
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onPullRefresh() {
  refreshing.value = true
  void load({ initial: false })
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatListTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (dayStart(d.getTime()) === dayStart(now.getTime())) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }
  if (Math.floor((dayStart(now.getTime()) - dayStart(d.getTime())) / 86400000) === 1) {
    return `昨天 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }
  return formatDateTime(iso, '')
}

async function markNotificationRead(item) {
  if (item.kind === 'announcement' || item.read) return
  try {
    await post('/api/mp/my-messages/read', { notificationId: item.id })
    item.read = true
    const k = item.kind
    if (k === 'work_order' || k === 'inspection_task' || k === 'complaint') {
      if (unreadCounts.value[k] > 0) unreadCounts.value[k]--
    }
  } catch {
    /* 仍允许进入详情 */
  }
}

async function onTapBusiness(item) {
  await markNotificationRead(item)
  if (item.kind === 'announcement') {
    openPage('/pages/notice/detail?id=' + item.id)
    return
  }
  const lk = item.link
  if (!lk) return
  if (lk.type === 'work_order') {
    openPage('/pages/workorder/detail?id=' + lk.id)
    return
  }
  if (lk.type === 'inspection_task') {
    openPage('/pages/inspection/detail?id=' + lk.id)
    return
  }
  if (lk.type === 'complaint') {
    openPage('/pages/complaints/detail?id=' + lk.id)
  }
}

function updateScrollHeight() {
  try {
    const sys = getSystemInfoCompat()
    const winH = sys.windowHeight || sys.screenHeight || 667
    // 预留头部（筛选、loading）；用比例避免挡 tabBar
    scrollHeightPx.value = Math.max(280, Math.floor(winH * 0.58))
  } catch (_) {}
}

onMounted(() => {
  updateScrollHeight()
})

onShow(() => {
  updateScrollHeight()
  void load({ initial: true })
})
</script>

<style lang="scss" scoped>
.page {
  height: 100vh;
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f0f2f5;
  padding: 0 24rpx 24rpx;
}

.filter-wrap {
  padding-top: 24rpx;
  padding-bottom: 28rpx;
  margin-bottom: 12rpx;
}

.filter-scroll {
  width: 100%;
  white-space: nowrap;
}

.filter-inner {
  display: inline-flex;
  flex-direction: row;
  gap: 16rpx;
  padding: 8rpx 0 8rpx;
}

.filter-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 1rpx solid #e4e7ed;
  flex-shrink: 0;
}

.filter-chip.active {
  background: rgba(41, 121, 255, 0.12);
  border-color: rgba(41, 121, 255, 0.45);
}

.filter-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #606266;
}

.filter-chip.active .filter-label {
  color: #2979ff;
}

.filter-badge {
  margin-left: 10rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: #f56c6c;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-badge-txt {
  font-size: 18rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.list-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.loading {
  text-align: center;
  padding: 80rpx 40rpx;
  color: #909399;
  font-size: 28rpx;
}

.empty-wrap {
  padding: 40rpx 0 80rpx;
}

.feed {
  padding-bottom: 8rpx;
}

.time-block {
  margin-bottom: 8rpx;
}

.time-block-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #909399;
  padding: 16rpx 8rpx 12rpx;
  letter-spacing: 1rpx;
}

.msg-card {
  display: flex;
  flex-direction: row;
  margin-bottom: 16rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

.msg-accent {
  width: 8rpx;
  flex-shrink: 0;
}

.accent-work_order {
  background: linear-gradient(180deg, #409eff 0%, #2979ff 100%);
}

.accent-inspection_task {
  background: linear-gradient(180deg, #e6a23c 0%, #cf9236 100%);
}

.accent-complaint {
  background: linear-gradient(180deg, #909399 0%, #606266 100%);
}

.accent-announcement {
  background: linear-gradient(180deg, #67c23a 0%, #529b2e 100%);
}

.msg-body {
  flex: 1;
  padding: 24rpx 24rpx 24rpx 20rpx;
  min-width: 0;
}

.msg-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.msg-kind {
  font-size: 22rpx;
  font-weight: 600;
  color: #909399;
}

.msg-time {
  font-size: 22rpx;
  color: #c0c4cc;
}

.msg-title-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.msg-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #303133;
  line-height: 1.45;
}

.unread-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #f56c6c;
  margin-top: 12rpx;
  flex-shrink: 0;
}

.msg-summary {
  font-size: 24rpx;
  color: #909399;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.list-pad {
  height: 32rpx;
}
</style>
