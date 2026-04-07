<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/api/request'

type Row = {
  id: number
  title: string
  content: string
  publishTime: string
  publisherName?: string | null
  companyName?: string | null
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

function sanitizeRichHtml(html: string) {
  if (!html) return ''
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\shref="javascript:[^"]*"/gi, '')
    .replace(/\ssrc="javascript:[^"]*"/gi, '')
}

const richContent = computed(() => sanitizeRichHtml(row.value?.content || ''))

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
      <view class="meta">
        <view v-if="row.companyName" class="meta-row">
          <text class="meta-label">物业公司</text>
          <text class="meta-value">{{ row.companyName }}</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">发布人</text>
          <text class="meta-value">{{ row.publisherName || '—' }}</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">发布时间</text>
          <text class="meta-value">{{ formatTime(row.publishTime) }}</text>
        </view>
      </view>
      <rich-text class="content-rich announcement-rich" :nodes="richContent" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 32rpx;
  min-height: 100vh;
  box-sizing: border-box;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
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
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
  overflow-x: hidden;
}

.h1 {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $pms-text;
  line-height: 1.35;
  margin-bottom: 20rpx;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.meta {
  margin-bottom: 28rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid $pms-border;
}

.meta-row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 14rpx;
  font-size: 26rpx;
  line-height: 1.45;
  max-width: 100%;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  flex-shrink: 0;
  width: 140rpx;
  color: $pms-text-dim;
}

.meta-value {
  flex: 1;
  min-width: 0;
  color: $pms-text-muted;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.content-rich {
  display: block;
  font-size: 28rpx;
  color: $pms-text-muted;
  line-height: 1.65;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  :deep(img) {
    max-width: 100% !important;
    width: auto !important;
    height: auto !important;
    display: block;
    vertical-align: top;
  }
  :deep(video) {
    max-width: 100% !important;
    height: auto !important;
  }
  :deep(table) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  :deep(p),
  :deep(div) {
    max-width: 100%;
  }
}
</style>

<!-- 富文本由组件注入 DOM，部分端子节点不挂 scoped data 属性，需单独写一层保证图片不撑破屏宽 -->
<style lang="scss">
.announcement-rich img,
uni-rich-text.announcement-rich img {
  max-width: 100% !important;
  width: auto !important;
  height: auto !important;
  display: block;
  box-sizing: border-box;
  vertical-align: top;
}
</style>
