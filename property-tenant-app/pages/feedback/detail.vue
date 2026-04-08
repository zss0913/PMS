<template>
  <view class="container">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="d" class="info-card">
      <view class="section-title">处理进度</view>
      <view class="timeline">
        <view class="tl-row">
          <text class="dot on">1</text>
          <view class="tl-body">
            <text class="tl-title">已提交</text>
            <text class="tl-time">{{ fmtTime(d.createdAt) }}</text>
          </view>
        </view>
        <view class="tl-line"></view>
        <view class="tl-row">
          <text class="dot" :class="{ on: isDone }">2</text>
          <view class="tl-body">
            <text class="tl-title">{{ isDone ? '已处理' : '处理中' }}</text>
            <text class="tl-time" v-if="d.handledAt">{{ fmtTime(d.handledAt) }}</text>
            <text class="tl-time muted" v-else>等待物业处理</text>
          </view>
        </view>
      </view>

      <u-cell-group :border="false">
        <u-cell title="状态" :value="d.status" :border="false"></u-cell>
        <u-cell title="楼宇" :value="d.buildingName || '—'" :border="false"></u-cell>
        <u-cell title="租客" :value="d.tenantName || '—'" :border="false"></u-cell>
        <u-cell title="位置" :value="d.location || '—'" :border="false"></u-cell>
        <u-cell title="提交时间" :value="fmtTime(d.createdAt)" :border="false"></u-cell>
      </u-cell-group>
      <view class="desc-box">
        <view class="label">内容</view>
        <view class="text">{{ d.description }}</view>
      </view>
      <view v-if="d.images && d.images.length" class="imgs">
        <image
          v-for="(u, i) in d.images"
          :key="i"
          :src="resolveMediaUrl(u)"
          mode="aspectFill"
          class="img"
          @click="preview(d.images, i)"
        />
      </view>
      <view v-if="d.result" class="desc-box">
        <view class="label">处理结果</view>
        <view class="text ok">{{ d.result }}</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { resolveMediaUrl } from '../../utils/work-order-upload.js'
import { formatDateTime } from '../../utils/datetime.js'

const loading = ref(true)
const err = ref('')
const d = ref(null)

const isDone = computed(() => {
  const x = d.value
  if (!x) return false
  return !!(x.handledAt || x.result)
})

function fmtTime(s) {
  return formatDateTime(s)
}

function preview(urls, i) {
  const u = urls.map((x) => resolveMediaUrl(x))
  uni.previewImage({ urls: u, current: u[i] })
}

onLoad((q) => {
  const id = q && q.id
  if (!id) {
    err.value = '缺少 ID'
    loading.value = false
    return
  }
  void (async () => {
    loading.value = true
    try {
      const res = await get(`/api/mp/complaints/${id}`)
      if (res.success && res.data) {
        d.value = res.data
      } else {
        err.value = res.message || '加载失败'
      }
    } catch {
      err.value = '网络错误'
    } finally {
      loading.value = false
    }
  })()
})
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
}
.hint {
  text-align: center;
  padding: 80rpx;
  color: #909399;
}
.info-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 24rpx;
  color: #333;
}
.timeline {
  margin-bottom: 32rpx;
  padding: 0 8rpx;
}
.tl-row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}
.dot {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #e4e7ed;
  color: #909399;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dot.on {
  background: #2979ff;
  color: #fff;
}
.tl-line {
  width: 2rpx;
  height: 24rpx;
  background: #dcdfe6;
  margin-left: 21rpx;
  margin-top: -4rpx;
  margin-bottom: -4rpx;
}
.tl-body {
  flex: 1;
  padding-bottom: 8rpx;
}
.tl-title {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
  display: block;
}
.tl-time {
  font-size: 24rpx;
  color: #909399;
  margin-top: 6rpx;
  display: block;
}
.tl-time.muted {
  color: #c0c4cc;
}
.desc-box {
  padding: 20rpx 0;
  .label {
    font-size: 26rpx;
    color: #909399;
    margin-bottom: 8rpx;
  }
  .text {
    font-size: 28rpx;
    color: #333;
    line-height: 1.5;
    &.ok {
      color: #19be6b;
    }
  }
}
.imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
  .img {
    width: 200rpx;
    height: 200rpx;
    border-radius: 8rpx;
  }
}
</style>
