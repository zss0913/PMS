<template>
  <view class="container">
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

    <view class="fab" @click="goSubmit">
      <u-icon name="plus" color="#ffffff" size="22"></u-icon>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
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

onShow(() => {
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
  min-height: 100vh;
  background: #f5f6f7;
  padding-bottom: calc(32rpx + 140rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  position: relative;
}

.hint {
  text-align: center;
  color: #909399;
  padding: 80rpx 40rpx;
  font-size: 28rpx;
}

.list {
  padding: 24rpx;
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

.fab {
  position: fixed;
  right: 32rpx;
  bottom: calc(32rpx + env(safe-area-inset-bottom));
  z-index: 100;
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f7b864, #f3a73f);
  box-shadow: 0 10rpx 28rpx rgba(243, 167, 63, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  &:active {
    opacity: 0.9;
    transform: scale(0.96);
  }
}
</style>
