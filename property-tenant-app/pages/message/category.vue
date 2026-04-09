<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="err" class="state err">{{ err }}</view>
    <template v-else>
      <view v-if="filtered.length > 0" class="toolbar">
        <view
          class="mark-all"
          :class="{ disabled: marking || unreadInCategory === 0 }"
          @click="markAllRead"
        >
          一键已读
        </view>
      </view>
      <view v-if="filtered.length === 0" class="empty-wrap">
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
        <view v-for="item in filtered" :key="item.key" class="card" @click="onOpen(item)">
          <view class="row-top">
            <text class="badge">{{ kindLabel(item.kind) }}</text>
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

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { get, post } from '../../utils/request.js'
import { formatDateTime } from '../../utils/datetime.js'
import { useUserStore } from '../../stores/user.js'
import { notificationCategory, KIND_LABEL } from '../../utils/mp-notifications.js'

const userStore = useUserStore()
const loading = ref(true)
const refreshing = ref(false)
const rawList = ref([])
const err = ref('')
const category = ref('')
const marking = ref(false)

const titleMap = {
  complaint: '卫生吐槽',
  work_order: '报事报修',
  announcement: '公告',
  bill: '账单',
}

const filtered = computed(() => {
  const cat = category.value
  if (!cat) return []
  return rawList.value.filter((it) => notificationCategory(it.kind) === cat)
})

const unreadInCategory = computed(() => filtered.value.filter((it) => !it.read).length)

function kindLabel(kind) {
  return KIND_LABEL[kind] || kind
}

function fmtTime(iso) {
  return formatDateTime(iso, '')
}

async function load(options) {
  const initial = !options || options.initial !== false
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    loading.value = false
    refreshing.value = false
    return
  }
  if (!category.value) {
    loading.value = false
    refreshing.value = false
    return
  }
  if (initial) loading.value = true
  err.value = ''
  try {
    const res = await get('/api/mp/notifications')
    if (res.success && Array.isArray(res.list)) {
      rawList.value = res.list
    } else {
      err.value = res.message || '加载失败'
      rawList.value = []
    }
  } catch (e) {
    err.value = (e && e.message) || '网络错误'
    rawList.value = []
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onPullRefresh() {
  refreshing.value = true
  void load({ initial: false })
}

async function markAllRead() {
  if (!category.value || marking.value) return
  if (unreadInCategory.value === 0) {
    uni.showToast({ title: '暂无未读', icon: 'none' })
    return
  }
  marking.value = true
  try {
    const res = await post('/api/mp/notifications/read', { category: category.value })
    if (res.success) {
      uni.showToast({ title: '已全部标为已读', icon: 'success' })
      await load({ initial: false })
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '网络错误', icon: 'none' })
  } finally {
    marking.value = false
  }
}

async function onOpen(item) {
  try {
    await post('/api/mp/notifications/read', { keys: [item.key] })
  } catch {
    /* 仍允许进入详情 */
  }

  if (item.kind === 'announcement') {
    let url = `/pages/notice/detail?id=${item.entityId}`
    if (item.buildingId != null) {
      url += `&buildingId=${item.buildingId}`
    }
    uni.navigateTo({ url })
    return
  }
  if (item.kind === 'bill') {
    uni.navigateTo({ url: `/pages/bill/detail?id=${item.entityId}` })
    return
  }
  if (item.kind === 'work_order') {
    uni.navigateTo({ url: `/pages/repair/detail?id=${item.entityId}` })
    return
  }
  if (item.kind === 'complaint') {
    uni.navigateTo({ url: `/pages/feedback/detail?id=${item.entityId}` })
    return
  }
  if (item.kind === 'app_message') {
    if (item.relatedBillId != null && item.relatedBillId > 0) {
      uni.navigateTo({ url: `/pages/bill/detail?id=${item.relatedBillId}` })
      return
    }
    uni.navigateTo({ url: '/pages/bill/list' })
    return
  }
}

onLoad((q) => {
  const raw = q && q.category != null ? String(q.category) : ''
  const allowed = ['complaint', 'work_order', 'announcement', 'bill']
  if (allowed.includes(raw)) {
    category.value = raw
    uni.setNavigationBarTitle({ title: titleMap[raw] || '消息' })
  } else {
    err.value = '无效的分类'
    category.value = ''
    loading.value = false
  }
})

onShow(() => {
  if (category.value) {
    void load({ initial: true })
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 16rpx 24rpx 48rpx;
  box-sizing: border-box;
  background: #f5f6f7;
}

.state {
  text-align: center;
  padding: 120rpx 24rpx;
  font-size: 28rpx;
  color: #909399;
}

.state.err {
  color: #f56c6c;
}

.toolbar {
  margin-bottom: 16rpx;
}

.mark-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: #2979ff;
  background: rgba(41, 121, 255, 0.1);
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
  color: #909399;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 28rpx 22rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
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
  color: #2979ff;
  background: rgba(41, 121, 255, 0.1);
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}

.time {
  font-size: 22rpx;
  color: #c0c4cc;
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
  color: #303133;
  line-height: 1.4;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #f56c6c;
  margin-top: 10rpx;
  flex-shrink: 0;
}

.summary {
  display: block;
  font-size: 26rpx;
  color: #909399;
  line-height: 1.45;
}

.row-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #ebeef5;
}

.hint {
  font-size: 24rpx;
  color: #c0c4cc;
}

.arrow {
  font-size: 32rpx;
  color: #c0c4cc;
  margin-left: 4rpx;
  line-height: 1;
}
</style>
