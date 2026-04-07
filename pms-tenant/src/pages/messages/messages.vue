<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'
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
const unreadCounts = ref({
  complaint: 0,
  work_order: 0,
  announcement: 0,
  bill: 0,
})
const err = ref('')

const categories: { key: MessageCategory; label: string; desc: string; badgeClass: string }[] = [
  { key: 'complaint', label: '卫生吐槽', desc: '吐槽处理进度', badgeClass: 'badge-complaint' },
  { key: 'work_order', label: '报事报修', desc: '工单动态', badgeClass: 'badge-wo' },
  { key: 'announcement', label: '公告', desc: '物业公告', badgeClass: 'badge-ann' },
  { key: 'bill', label: '账单', desc: '账单与催缴提醒', badgeClass: 'badge-bill' },
]

async function load(options?: { initial?: boolean }) {
  const initial = options?.initial !== false
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    loading.value = false
    refreshing.value = false
    return
  }
  if (initial) {
    loading.value = true
  }
  err.value = ''
  try {
    await userStore.fetchUser()
    const res = (await get('/api/mp/notifications')) as {
      success?: boolean
      list?: FeedItem[]
      unreadCounts?: typeof unreadCounts.value
      message?: string
    }
    if (res.success && Array.isArray(res.list)) {
      list.value = res.list
      if (res.unreadCounts && typeof res.unreadCounts === 'object') {
        unreadCounts.value = {
          complaint: Number(res.unreadCounts.complaint) || 0,
          work_order: Number(res.unreadCounts.work_order) || 0,
          announcement: Number(res.unreadCounts.announcement) || 0,
          bill: Number(res.unreadCounts.bill) || 0,
        }
      }
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

function goCategory(cat: MessageCategory) {
  uni.navigateTo({ url: `/pages/messages/category?category=${encodeURIComponent(cat)}` })
}

onShow(() => {
  void load({ initial: true })
})
</script>

<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="err" class="state err">{{ err }}</view>
    <scroll-view
      v-else
      scroll-y
      class="scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onPullRefresh"
    >
      <text class="hint">按类型查看消息，未读条数在分类入口展示</text>
      <view class="grid">
        <view
          v-for="c in categories"
          :key="c.key"
          class="cat-card"
          :class="c.badgeClass"
          @click="goCategory(c.key)"
        >
          <view class="cat-top">
            <text class="cat-label">{{ c.label }}</text>
            <view v-if="unreadCounts[c.key] > 0" class="unread-pill">
              <text class="unread-num">{{ unreadCounts[c.key] > 99 ? '99+' : unreadCounts[c.key] }}</text>
            </view>
          </view>
          <text class="cat-desc">{{ c.desc }}</text>
          <view class="cat-foot">
            <text class="cat-action">进入列表</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 48rpx;
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

.scroll {
  max-height: calc(100vh - 48rpx);
}

.hint {
  display: block;
  font-size: 24rpx;
  color: $pms-text-dim;
  margin-bottom: 24rpx;
  line-height: 1.45;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.cat-card {
  width: calc(50% - 10rpx);
  box-sizing: border-box;
  @include pms-card;
  padding: 24rpx 22rpx 20rpx;
  min-height: 200rpx;
  display: flex;
  flex-direction: column;
}

.cat-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.cat-label {
  font-size: 30rpx;
  font-weight: 700;
  color: $pms-text;
  flex: 1;
  line-height: 1.35;
}

.unread-pill {
  flex-shrink: 0;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: rgba(248, 113, 113, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
}

.unread-num {
  font-size: 22rpx;
  font-weight: 700;
  color: #fff;
}

.cat-desc {
  font-size: 24rpx;
  color: $pms-text-muted;
  line-height: 1.4;
  flex: 1;
}

.cat-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid $pms-border;
}

.cat-action {
  font-size: 24rpx;
  color: $pms-text-dim;
}

.arrow {
  font-size: 28rpx;
  color: $pms-text-dim;
  margin-left: 4rpx;
}

.badge-complaint .cat-label {
  color: #7dd3fc;
}
.badge-wo .cat-label {
  color: #38bdf8;
}
.badge-ann .cat-label {
  color: #34d399;
}
.badge-bill .cat-label {
  color: #93c5fd;
}
</style>
