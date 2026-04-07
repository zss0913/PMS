<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { get, post } from '@/api/request'
import { useUserStore } from '@/store/user'
import type { MessageCategory, NotifKind } from './types'

type FeedItem = {
  key: string
  kind: NotifKind
  title: string
  summary: string
  createdAt: string
  tenantId: number | null
  entityId: number
  buildingId?: number | null
  relatedBillId?: number | null
  read?: boolean
}

const userStore = useUserStore()
const loading = ref(true)
const refreshing = ref(false)
const list = ref<FeedItem[]>([])
const err = ref('')
const category = ref<MessageCategory | ''>('')
const marking = ref(false)

const titleMap: Record<MessageCategory, string> = {
  complaint: '卫生吐槽',
  work_order: '报事报修',
  announcement: '公告',
  bill: '账单',
}

function notificationCategory(kind: NotifKind): MessageCategory {
  if (kind === 'app_message') return 'bill'
  return kind
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

const kindLabel: Record<NotifKind, string> = {
  announcement: '公告',
  bill: '账单',
  work_order: '报事报修',
  complaint: '卫生吐槽',
  app_message: '催缴',
}

async function load(options?: { initial?: boolean }) {
  const initial = options?.initial !== false
  if (!userStore.token || !category.value) {
    loading.value = false
    refreshing.value = false
    return
  }
  if (initial) loading.value = true
  err.value = ''
  try {
    const res = (await get('/api/mp/notifications')) as {
      success?: boolean
      list?: FeedItem[]
      message?: string
    }
    if (res.success && Array.isArray(res.list)) {
      const cat = category.value
      list.value = res.list.filter((it) => notificationCategory(it.kind) === cat)
    } else {
      err.value = res.message || '加载失败'
      list.value = []
    }
  } catch {
    err.value = '网络错误'
    list.value = []
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onPullRefresh() {
  refreshing.value = true
  void load({ initial: false })
}

const unreadInCategory = () => list.value.filter((it) => !it.read).length

async function markAllRead() {
  if (!category.value || marking.value) return
  if (unreadInCategory() === 0) {
    uni.showToast({ title: '暂无未读', icon: 'none' })
    return
  }
  marking.value = true
  try {
    const res = (await post('/api/mp/notifications/read', { category: category.value })) as {
      success?: boolean
      message?: string
    }
    if (res.success) {
      uni.showToast({ title: '已全部标为已读', icon: 'success' })
      await load({ initial: false })
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    marking.value = false
  }
}

async function onOpen(item: FeedItem) {
  try {
    await post('/api/mp/notifications/read', { keys: [item.key] })
  } catch {
    /* 仍允许进入详情 */
  }

  if (item.kind === 'announcement') {
    let url = `/pages/announcements/detail?id=${item.entityId}`
    if (item.buildingId != null) {
      url += `&buildingId=${item.buildingId}`
    }
    uni.navigateTo({ url })
    return
  }
  if (item.kind === 'bill') {
    uni.navigateTo({ url: `/pages/bills/detail?id=${item.entityId}` })
    return
  }
  if (item.kind === 'work_order') {
    uni.navigateTo({ url: `/pages/work-orders/detail?id=${item.entityId}` })
    return
  }
  if (item.kind === 'complaint') {
    uni.navigateTo({ url: `/pages/complaints/detail?id=${item.entityId}` })
    return
  }
  if (item.relatedBillId != null && item.relatedBillId > 0) {
    uni.navigateTo({ url: `/pages/bills/detail?id=${item.relatedBillId}` })
    return
  }
  uni.navigateTo({ url: '/pages/bills/bills' })
}

onLoad((q) => {
  const raw = q?.category != null ? String(q.category) : ''
  const allowed: MessageCategory[] = ['complaint', 'work_order', 'announcement', 'bill']
  if (allowed.includes(raw as MessageCategory)) {
    category.value = raw as MessageCategory
    uni.setNavigationBarTitle({ title: titleMap[category.value] })
  } else {
    err.value = '无效的分类'
    category.value = ''
  }
})

onShow(() => {
  if (category.value) {
    void load({ initial: true })
  }
})
</script>

<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="err" class="state err">{{ err }}</view>
    <template v-else>
      <view v-if="list.length > 0" class="toolbar">
        <view
          class="mark-all"
          :class="{ disabled: marking || unreadInCategory() === 0 }"
          @click="markAllRead"
        >
          一键已读
        </view>
      </view>
      <view v-if="list.length === 0" class="empty-wrap">
        <text class="empty-title">暂无此类消息</text>
      </view>
      <scroll-view
        v-else
        scroll-y
        class="scroll"
        refresher-enabled
        :refresher-triggered="refreshing"
        @refresherrefresh="onPullRefresh"
      >
        <view v-for="item in list" :key="item.key" class="card" @click="onOpen(item)">
          <view class="row-top">
            <text class="badge">{{ kindLabel[item.kind] }}</text>
            <text class="time">{{ fmtTime(item.createdAt) }}</text>
          </view>
          <view class="title-row">
            <text class="title">{{ item.title }}</text>
            <view v-if="!item.read" class="dot" />
          </view>
          <text class="summary">{{ item.summary }}</text>
          <view class="row-foot">
            <text class="hint">查看详情</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </scroll-view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 16rpx 32rpx 48rpx;
  box-sizing: border-box;
  background: $pms-bg-deep;
}

.state {
  text-align: center;
  padding: 120rpx 24rpx;
  font-size: 28rpx;
  color: $pms-text-muted;
}

.state.err {
  color: #f87171;
}

.toolbar {
  margin-bottom: 16rpx;
}

.mark-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: $pms-accent;
  background: $pms-accent-soft;
  border-radius: 12rpx;
  padding: 16rpx 28rpx;
  line-height: 1.2;
}

.mark-all.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.scroll {
  max-height: calc(100vh - 120rpx);
}

.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 24rpx;
}

.empty-title {
  font-size: 28rpx;
  color: $pms-text-muted;
}

.card {
  @include pms-card;
  padding: 28rpx 28rpx 22rpx;
  margin-bottom: 20rpx;
}

.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.badge {
  font-size: 22rpx;
  font-weight: 600;
  color: $pms-accent;
  background: $pms-accent-soft;
  padding: 4rpx 14rpx;
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
  margin-bottom: 8rpx;
}

.title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
  line-height: 1.4;
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
  display: block;
  font-size: 26rpx;
  color: $pms-text-muted;
  line-height: 1.45;
}

.row-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid $pms-border;
}

.hint {
  font-size: 24rpx;
  color: $pms-text-dim;
}

.arrow {
  font-size: 32rpx;
  color: $pms-text-dim;
  margin-left: 4rpx;
  line-height: 1;
}
</style>
