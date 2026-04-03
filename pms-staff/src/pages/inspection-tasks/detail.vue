<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/api/request'

interface CheckItem {
  name: string
  nfcTagId: number
  tagId: string
  location: string
}

const loading = ref(true)
const err = ref('')
const taskId = ref(0)
const detail = ref<{
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  buildingName: string | null
  canExecute: boolean
  checkItems: CheckItem[]
  progress: { total: number; done: number }
  doneTagIds: string[]
} | null>(null)

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少任务 ID'
    loading.value = false
    return
  }
  taskId.value = parseInt(id, 10)
  void load(id)
})

async function load(id: string) {
  loading.value = true
  err.value = ''
  try {
    const res = (await get(`/api/mp/inspection-tasks/${id}`)) as {
      success?: boolean
      data?: typeof detail.value
      message?: string
    }
    if (res.success && res.data) {
      detail.value = res.data
    } else {
      err.value = res.message || '加载失败'
    }
  } catch {
    err.value = '网络错误'
  } finally {
    loading.value = false
  }
}

function goExecute() {
  if (!taskId.value) return
  uni.navigateTo({ url: `/pages/inspection-tasks/execute?id=${taskId.value}` })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="detail" class="card">
      <text class="code">{{ detail.code }}</text>
      <text class="name">{{ detail.planName }}</text>
      <view class="row">
        <text class="k">类型</text>
        <text class="v">{{ detail.inspectionType }}</text>
      </view>
      <view class="row">
        <text class="k">楼宇</text>
        <text class="v">{{ detail.buildingName || '—' }}</text>
      </view>
      <view class="row">
        <text class="k">计划日期</text>
        <text class="v">{{ detail.scheduledDate?.slice(0, 10) }}</text>
      </view>
      <view class="row">
        <text class="k">状态</text>
        <text class="v status">{{ detail.status }}</text>
      </view>
      <view class="row">
        <text class="k">进度</text>
        <text class="v">{{ detail.progress.done }} / {{ detail.progress.total }}</text>
      </view>
      <view class="section-title">检查项与 NFC</view>
      <view v-for="(c, i) in detail.checkItems" :key="i" class="item-row">
        <text class="dot" :class="{ done: detail.doneTagIds?.includes(c.tagId) }" />
        <view class="item-body">
          <text class="item-name">{{ c.name }}</text>
          <text class="item-sub">NFC {{ c.tagId }} · {{ c.location || '—' }}</text>
        </view>
      </view>
      <button
        v-if="detail.canExecute && detail.status !== '已完成'"
        class="btn"
        type="primary"
        @click="goExecute"
      >
        执行巡检
      </button>
      <view v-else-if="!detail.canExecute" class="hint small">您不在该任务的巡检人员列表中</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.hint {
  text-align: center;
  color: $pms-text-muted;
  padding: 48rpx;
  &.small {
    font-size: 24rpx;
    padding: 24rpx 0 0;
  }
}
.card {
  @include pms-card;
  padding: 32rpx;
}
.code {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  font-family: monospace;
}
.name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $pms-text;
  margin: 16rpx 0 24rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  font-size: 26rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}
.k {
  color: $pms-text-muted;
}
.v {
  color: $pms-text;
}
.status {
  color: $pms-accent;
}
.section-title {
  margin-top: 32rpx;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-text;
}
.item-row {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}
.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-top: 10rpx;
  background: $pms-text-dim;
  &.done {
    background: $pms-accent;
  }
}
.item-body {
  flex: 1;
}
.item-name {
  display: block;
  font-size: 28rpx;
  color: $pms-text;
}
.item-sub {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-top: 8rpx;
}
.btn {
  margin-top: 40rpx;
  background: $pms-accent !important;
}
</style>
