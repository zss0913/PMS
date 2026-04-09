<template>
  <view class="container">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else class="list">
      <view v-for="item in notices" :key="item.id" class="list-item" @click="goToDetail(item)">
        <view class="title">{{ item.title }}</view>
        <view class="desc">{{ stripHtml(item.content) }}</view>
        <view class="time">{{ formatTime(item.publishTime) }}</view>
      </view>
      <u-empty v-if="!notices.length" mode="list" text="暂无公告" margin-top="100"></u-empty>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { get } from '../../utils/request.js'
import { formatDateTime } from '../../utils/datetime.js'

const notices = ref([])
const loading = ref(true)

function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function formatTime(v) {
  return formatDateTime(v, '')
}

async function load() {
  loading.value = true
  try {
    const res = await get('/api/mp/announcements')
    notices.value = res.success && Array.isArray(res.list) ? res.list : []
  } catch {
    notices.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

function goToDetail(item) {
  uni.navigateTo({ url: '/pages/notice/detail?id=' + item.id })
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  .hint {
    text-align: center;
    padding: 40rpx;
    color: #909399;
  }
  .list-item {
    background-color: #fff;
    border-radius: 12rpx;
    padding: 30rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
    .title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      margin-bottom: 16rpx;
    }
    .desc {
      font-size: 28rpx;
      color: #666;
      margin-bottom: 20rpx;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }
    .time {
      font-size: 24rpx;
      color: #999;
      text-align: right;
    }
  }
}
</style>
