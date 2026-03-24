<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/api/request'

type Row = {
  id: number
  title: string
  content: string
  publishTime: string
}

const loading = ref(true)
const row = ref<Row | null>(null)
const err = ref('')

let qId = 0
let qBuildingId = ''

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

async function load() {
  if (!qId) return
  loading.value = true
  err.value = ''
  try {
    const params: Record<string, string> = {}
    if (qBuildingId) params.buildingId = qBuildingId
    const res = (await get(`/api/mp/announcements/${qId}`, params)) as {
      success?: boolean
      announcement?: Row
      message?: string
    }
    if (res.success && res.announcement) {
      row.value = res.announcement
    } else {
      err.value = res.message || '加载失败'
    }
  } catch {
    err.value = '网络错误'
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  qId = parseInt(String(options.id || ''), 10)
  qBuildingId = String(options.buildingId || '').trim()
  if (!qId) {
    err.value = '无效公告'
    loading.value = false
    return
  }
  void load()
})
</script>

<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="err" class="state">{{ err }}</view>
    <view v-else-if="row" class="body">
      <text class="h1">{{ row.title }}</text>
      <text class="time">{{ formatTime(row.publishTime) }}</text>
      <text class="content">{{ row.content }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 32rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.state {
  text-align: center;
  padding: 120rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.body {
  @include pms-card;
  padding: 36rpx 32rpx;
}

.h1 {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $pms-text;
  line-height: 1.35;
  margin-bottom: 16rpx;
}

.time {
  display: block;
  font-size: 24rpx;
  color: $pms-text-dim;
  margin-bottom: 28rpx;
}

.content {
  display: block;
  font-size: 28rpx;
  color: $pms-text-muted;
  line-height: 1.65;
  white-space: pre-wrap;
}
</style>
