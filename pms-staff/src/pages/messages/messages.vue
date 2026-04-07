<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, post } from '@/api/request'

type MessageKind = 'announcement' | 'work_order' | 'inspection_task' | 'complaint'
type TabKey = 'work_order' | 'inspection_task' | 'complaint'

interface MyMessageItem {
  kind: MessageKind
  id: number
  title: string
  summary: string
  time: string
  read?: boolean
  link?: { type: 'work_order' | 'inspection_task' | 'complaint'; id: number }
  content?: string
}

const loading = ref(true)
const refreshing = ref(false)
const markingAll = ref(false)
const announcements = ref<MyMessageItem[]>([])
const business = ref<MyMessageItem[]>([])
const unreadCounts = ref({ work_order: 0, inspection_task: 0, complaint: 0 })
const activeTab = ref<TabKey>('work_order')

const tabs: { key: TabKey; label: string }[] = [
  { key: 'work_order', label: '工单' },
  { key: 'inspection_task', label: '巡检' },
  { key: 'complaint', label: '卫生吐槽' },
]

const kindLabel: Record<MessageKind, string> = {
  announcement: '公告',
  work_order: '报事报修',
  inspection_task: '巡检',
  complaint: '卫生吐槽',
}

const filteredList = computed(() => business.value.filter((it) => it.kind === activeTab.value))

async function load(options?: { initial?: boolean }) {
  const initial = options?.initial !== false
  if (initial) loading.value = true
  try {
    const res = (await get('/api/mp/my-messages')) as {
      success?: boolean
      announcements?: MyMessageItem[]
      business?: MyMessageItem[]
      unreadCounts?: typeof unreadCounts.value
      list?: MyMessageItem[]
    }
    if (res.success) {
      if (Array.isArray(res.announcements)) {
        announcements.value = res.announcements
      }
      if (Array.isArray(res.business)) {
        business.value = res.business
      } else if (Array.isArray(res.list)) {
        business.value = res.list.filter(
          (it): it is MyMessageItem =>
            it.kind === 'work_order' || it.kind === 'inspection_task' || it.kind === 'complaint'
        )
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

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

async function markNotificationRead(item: MyMessageItem) {
  if (item.kind === 'announcement' || item.read) return
  try {
    await post('/api/mp/my-messages/read', { notificationId: item.id })
    item.read = true
    const k = item.kind as TabKey
    if (k === 'work_order' || k === 'inspection_task' || k === 'complaint') {
      if (unreadCounts.value[k] > 0) unreadCounts.value[k]--
    }
  } catch {
    /* 仍允许进入详情 */
  }
}

async function onTapBusiness(item: MyMessageItem) {
  await markNotificationRead(item)
  const lk = item.link
  if (!lk) return
  if (lk.type === 'work_order') {
    uni.navigateTo({ url: `/pages/work-orders/detail?id=${lk.id}` })
    return
  }
  if (lk.type === 'inspection_task') {
    uni.navigateTo({ url: `/pages/inspection-tasks/detail?id=${lk.id}` })
    return
  }
  if (lk.type === 'complaint') {
    uni.navigateTo({ url: `/pages/complaints/detail?id=${lk.id}` })
  }
}

function goAnnouncements() {
  uni.navigateTo({ url: '/pages/announcements/announcements' })
}

const totalUnread = computed(
  () => unreadCounts.value.work_order + unreadCounts.value.inspection_task + unreadCounts.value.complaint
)

async function markAllRead() {
  if (markingAll.value || totalUnread.value === 0) {
    if (totalUnread.value === 0) {
      uni.showToast({ title: '暂无未读', icon: 'none' })
    }
    return
  }
  markingAll.value = true
  try {
    const res = (await post('/api/mp/my-messages/read', { markAll: true })) as { success?: boolean; message?: string }
    if (res.success) {
      uni.showToast({ title: '已全部标为已读', icon: 'success' })
      await load({ initial: false })
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    markingAll.value = false
  }
}

onShow(() => {
  void load({ initial: true })
})
</script>

<template>
  <view class="page">
    <view class="intro-row">
      <text class="intro">工单、巡检与卫生吐槽按类查看；进入详情后自动标为已读</text>
      <text
        class="mark-all"
        :class="{ disabled: markingAll || totalUnread === 0 }"
        @click="markAllRead"
      >
        全部已读
      </text>
    </view>

    <view v-if="announcements.length > 0" class="ann-section">
      <view class="ann-head">
        <text class="ann-title">物业公告</text>
        <text class="ann-more" @click="goAnnouncements">查看全部 ›</text>
      </view>
      <scroll-view scroll-x class="ann-scroll" show-scrollbar="false">
        <view class="ann-row">
          <view
            v-for="a in announcements.slice(0, 8)"
            :key="'ann-' + a.id"
            class="ann-chip"
            @click="goAnnouncements"
          >
            <text class="ann-chip-text">{{ a.title }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="tabs">
      <view
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        <text class="tab-text">{{ t.label }}</text>
        <view v-if="unreadCounts[t.key] > 0" class="tab-badge">
          <text class="tab-badge-num">{{ unreadCounts[t.key] > 99 ? '99+' : unreadCounts[t.key] }}</text>
        </view>
      </view>
    </view>

    <view v-if="loading" class="loading">加载中…</view>
    <scroll-view
      v-else
      scroll-y
      class="list-scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onPullRefresh"
    >
      <view v-if="filteredList.length === 0" class="empty">该分类暂无消息</view>
      <view v-else class="list">
        <view
          v-for="(item, idx) in filteredList"
          :key="item.kind + '-' + item.id + '-' + idx"
          class="card"
          @click="onTapBusiness(item)"
        >
          <view class="row-top">
            <text class="badge">{{ kindLabel[item.kind] }}</text>
            <text class="time">{{ formatTime(item.time) }}</text>
          </view>
          <view class="title-row">
            <text class="title">{{ item.title }}</text>
            <view v-if="!item.read" class="dot" />
          </view>
          <view class="summary">{{ item.summary }}</view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.intro-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.intro {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: $pms-text-muted;
  line-height: 1.5;
}

.mark-all {
  flex-shrink: 0;
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-accent;
  padding: 4rpx 0 4rpx 12rpx;
}

.mark-all.disabled {
  opacity: 0.4;
}

.ann-section {
  margin-bottom: 24rpx;
}

.ann-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.ann-title {
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-text;
}

.ann-more {
  font-size: 22rpx;
  color: $pms-text-dim;
}

.ann-scroll {
  width: 100%;
  white-space: nowrap;
}

.ann-row {
  display: inline-flex;
  gap: 16rpx;
  padding-bottom: 4rpx;
}

.ann-chip {
  @include pms-card;
  padding: 16rpx 22rpx;
  max-width: 420rpx;
}

.ann-chip-text {
  font-size: 24rpx;
  color: $pms-text-muted;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.tabs {
  display: flex;
  flex-direction: row;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.tab {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 12rpx;
  border-radius: 16rpx;
  background: $pms-surface;
  border: 1rpx solid $pms-border;
}

.tab.active {
  border-color: rgba(34, 197, 94, 0.45);
  background: $pms-accent-soft;
}

.tab-text {
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-text-muted;
}

.tab.active .tab-text {
  color: $pms-accent;
}

.tab-badge {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: rgba(248, 113, 113, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-badge-num {
  font-size: 18rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.list-scroll {
  flex: 1;
  max-height: calc(100vh - 320rpx);
}

.loading,
.empty {
  text-align: center;
  padding: 80rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.list {
  padding-bottom: 32rpx;
}

.card {
  @include pms-card;
  @include pms-tap;
  padding: 28rpx;
  margin-bottom: 24rpx;
}

.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.badge {
  font-size: 22rpx;
  font-weight: 600;
  color: $pms-accent;
  background: $pms-accent-soft;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}

.time {
  font-size: 22rpx;
  color: $pms-text-dim;
}

.title-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: $pms-text;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #f87171;
  margin-top: 10rpx;
  flex-shrink: 0;
}

.summary {
  font-size: 26rpx;
  color: $pms-text-muted;
  line-height: 1.55;
}
</style>
