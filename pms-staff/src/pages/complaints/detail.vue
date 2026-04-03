<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/api/request'

const loading = ref(true)
const err = ref('')
const d = ref<{
  location: string
  description: string
  status: string
  buildingName: string
  tenantName: string
  createdAt: string
  result: string | null
  handledAt: string | null
} | null>(null)

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少 ID'
    loading.value = false
    return
  }
  void load(id)
})

async function load(id: string) {
  loading.value = true
  err.value = ''
  try {
    const res = (await get(`/api/mp/complaints/${id}`)) as {
      success?: boolean
      data?: typeof d.value
      message?: string
    }
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
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="d" class="card">
      <view class="row">
        <text class="k">楼宇</text>
        <text class="v">{{ d.buildingName }}</text>
      </view>
      <view class="row">
        <text class="k">租客</text>
        <text class="v">{{ d.tenantName }}</text>
      </view>
      <view class="row">
        <text class="k">位置</text>
        <text class="v">{{ d.location }}</text>
      </view>
      <view class="row">
        <text class="k">状态</text>
        <text class="v">{{ d.status }}</text>
      </view>
      <view class="block">
        <text class="label">内容</text>
        <text class="body">{{ d.description }}</text>
      </view>
      <view v-if="d.result" class="block">
        <text class="label">处理结果</text>
        <text class="body">{{ d.result }}</text>
      </view>
      <text class="time">{{ d.createdAt }}</text>
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
  padding: 80rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}
.card {
  @include pms-card;
  padding: 36rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 14rpx 0;
  font-size: 28rpx;
  border-bottom: 1rpx solid $pms-border;
}
.k {
  color: $pms-text-muted;
}
.v {
  color: $pms-text;
  max-width: 65%;
  text-align: right;
}
.block {
  margin-top: 28rpx;
}
.label {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
}
.body {
  font-size: 28rpx;
  color: $pms-text;
  line-height: 1.6;
  white-space: pre-wrap;
}
.time {
  display: block;
  margin-top: 28rpx;
  font-size: 22rpx;
  color: $pms-text-dim;
}
</style>
