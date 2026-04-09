<template>
  <view class="container">
    <view class="toolbar" style="display: none;">
      <u-button type="primary" text="我要吐槽" @click="goSubmit"></u-button>
    </view>
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="list-item" @click="goDetail(item.id)">
        <view class="header">
          <text class="title">{{ item.location || '卫生吐槽' }}</text>
          <u-tag :text="item.status" size="mini" type="primary"></u-tag>
        </view>
        <view class="content">
          <view class="desc">{{ item.description }}</view>
          <view class="time">{{ fmtTime(item.createdAt) }}</view>
        </view>
      </view>
      <u-empty v-if="!list.length" mode="list" text="暂无吐槽" margin-top="60"></u-empty>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { get } from '../../utils/request.js'
import { formatDateTime } from '../../utils/datetime.js'

const list = ref([])
const loading = ref(true)

function fmtTime(s) {
  return formatDateTime(s)
}

async function load() {
  loading.value = true
  try {
    const res = await get('/api/mp/complaints')
    if (res.success && res.data && Array.isArray(res.data.list)) {
      list.value = res.data.list
    } else {
      list.value = []
    }
  } catch {
    list.value = []
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

function goSubmit() {
  uni.navigateTo({ url: '/pages/feedback/submit' })
}

function goDetail(id) {
  uni.navigateTo({ url: '/pages/feedback/detail?id=' + id })
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
}
.toolbar {
  margin-bottom: 24rpx;
}
.hint {
  text-align: center;
  color: #909399;
  padding: 40rpx;
}
.list-item {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;
    .title {
      font-size: 32rpx;
      font-weight: bold;
      color: #333;
      flex: 1;
      margin-right: 16rpx;
    }
  }
  .content {
    .desc {
      font-size: 28rpx;
      color: #666;
      margin-bottom: 8rpx;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
    }
    .time {
      font-size: 24rpx;
      color: #999;
      margin-top: 16rpx;
    }
  }
}
</style>
