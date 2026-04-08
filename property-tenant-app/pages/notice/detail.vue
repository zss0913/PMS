<template>
  <view class="container">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="row" class="article-box">
      <view class="title">{{ row.title }}</view>
      <view class="meta">
        <text class="time">{{ formatTime(row.publishTime) }}</text>
      </view>
      <rich-text v-if="row.content" :nodes="htmlContent" class="rich"></rich-text>
      <view v-else class="content text-only">暂无正文</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { formatDateTime } from '../../utils/datetime.js'

const loading = ref(true)
const err = ref('')
const row = ref(null)
let qId = 0
let qBuildingId = ''

function sanitizeRichHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\shref="javascript:[^"]*"/gi, '')
    .replace(/\ssrc="javascript:[^"]*"/gi, '')
}

function formatTime(iso) {
  return formatDateTime(iso, '')
}

const htmlContent = computed(() => sanitizeRichHtml((row.value && row.value.content) || ''))

async function load() {
  if (!qId) return
  loading.value = true
  err.value = ''
  try {
    const params = {}
    if (qBuildingId) params.buildingId = qBuildingId
    const res = await get(`/api/mp/announcements/${qId}`, params)
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

<style lang="scss" scoped>
.container {
  padding: 24rpx;
}
.hint {
  text-align: center;
  padding: 80rpx 24rpx;
  color: #909399;
}
.article-box {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 40rpx 30rpx;
  .title {
    font-size: 40rpx;
    font-weight: bold;
    color: #333;
    line-height: 1.4;
    margin-bottom: 24rpx;
    text-align: center;
  }
  .meta {
    display: flex;
    justify-content: center;
    font-size: 24rpx;
    color: #999;
    margin-bottom: 40rpx;
    padding-bottom: 30rpx;
    border-bottom: 1rpx solid #eee;
  }
  .content.text-only {
    font-size: 30rpx;
    color: #444;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  .rich {
    font-size: 30rpx;
    line-height: 1.7;
    color: #444;
  }
}
</style>
