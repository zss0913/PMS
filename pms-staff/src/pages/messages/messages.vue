<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'

type MessageKind = 'announcement' | 'work_order' | 'inspection_task' | 'complaint'

interface MyMessageItem {
  kind: MessageKind
  id: number
  title: string
  summary: string
  time: string
  link?: { type: 'work_order' | 'inspection_task' | 'complaint'; id: number }
  content?: string
}

const list = ref<MyMessageItem[]>([])
const loading = ref(true)

const kindLabel: Record<MessageKind, string> = {
  announcement: '公告',
  work_order: '报事报修',
  inspection_task: '巡检',
  complaint: '卫生吐槽',
}

onMounted(async () => {
  try {
    const res = (await get('/api/mp/my-messages')) as {
      success?: boolean
      list?: MyMessageItem[]
    }
    if (res.success && Array.isArray(res.list)) {
      list.value = res.list
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

function onTapItem(item: MyMessageItem) {
  if (item.kind === 'announcement') {
    return
  }
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

function handleCardTap(item: MyMessageItem) {
  if (item.kind === 'announcement') return
  onTapItem(item)
}
</script>

<template>
  <view class="page">
    <view class="intro">物业公告、报事报修、巡检任务与卫生吐槽等业务通知</view>
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">暂无消息</view>
    <view v-else class="list">
      <view
        v-for="(item, idx) in list"
        :key="item.kind + '-' + item.id + '-' + idx"
        class="card"
        :class="{ tappable: item.kind !== 'announcement' }"
        @click="handleCardTap(item)"
      >
        <view class="row-top">
          <text class="badge">{{ kindLabel[item.kind] }}</text>
          <text class="time">{{ formatTime(item.time) }}</text>
        </view>
        <view class="title">{{ item.title }}</view>
        <view class="summary">{{ item.summary }}</view>
        <view v-if="item.kind === 'announcement' && item.content" class="content">{{ item.content }}</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.intro {
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 24rpx;
  line-height: 1.5;
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
    padding: 28rpx;
    margin-bottom: 24rpx;
  }
  .card.tappable {
    @include pms-tap;
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
  .title {
    font-size: 32rpx;
    font-weight: 600;
    color: $pms-text;
    margin-bottom: 12rpx;
    font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  }
  .summary {
    font-size: 26rpx;
    color: $pms-text-muted;
    line-height: 1.55;
  }
  .content {
    font-size: 26rpx;
    color: $pms-text-muted;
    line-height: 1.65;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid $pms-border;
    white-space: pre-wrap;
  }
}
</style>
