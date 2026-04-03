<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/api/request'

const loading = ref(true)
const err = ref('')
const detail = ref<{
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  startedAt: string | null
  completedAt: string | null
} | null>(null)

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少任务 ID'
    loading.value = false
    return
  }
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
        <text class="k">计划日期</text>
        <text class="v">{{ detail.scheduledDate }}</text>
      </view>
      <view class="row">
        <text class="k">状态</text>
        <text class="v status">{{ detail.status }}</text>
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
.code {
  display: block;
  font-size: 26rpx;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
}
.name {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: $pms-text;
  margin-bottom: 32rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-top: 1rpx solid $pms-border;
  font-size: 28rpx;
}
.k {
  color: $pms-text-muted;
}
.v {
  color: $pms-text;
  max-width: 60%;
  text-align: right;
}
.status {
  color: $pms-accent;
}
</style>
