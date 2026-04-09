<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="detail" class="card">
      <view class="row">
        <text class="label">编号</text>
        <text class="val">{{ detail.id }}</text>
      </view>
      <view class="row">
        <text class="label">状态</text>
        <text class="val">{{ detail.status }}</text>
      </view>
      <view class="row">
        <text class="label">楼宇</text>
        <text class="val">{{ detail.buildingName || '—' }}</text>
      </view>
      <view class="row block">
        <text class="label">内容</text>
        <text class="val">{{ detail.description || '—' }}</text>
      </view>
      <view class="row">
        <text class="label">租客</text>
        <text class="val">{{ detail.tenantName }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'

const loading = ref(true)
const err = ref('')
const detail = ref(null)

onLoad((q) => {
  const id = q.id
  if (!id) {
    err.value = '缺少 ID'
    loading.value = false
    return
  }
  void load(id)
})

async function load(id) {
  loading.value = true
  err.value = ''
  try {
    const res = await get('/api/mp/complaints/' + id)
    if (res.success && res.data) {
      const d = res.data
      detail.value = {
        id: d.id,
        status: d.status,
        description: d.description,
        buildingName: d.buildingName,
        tenantName: d.tenantName || '—',
      }
    } else {
      err.value = res.message || '加载失败'
    }
  } catch (e) {
    err.value = e?.message || '网络错误'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f6f7;
  padding: 24rpx;
  box-sizing: border-box;
}

.hint {
  text-align: center;
  padding: 60rpx;
  color: #909399;
}

.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  &.block {
    flex-direction: column;
  }
}

.row:last-child {
  border-bottom: none;
}

.label {
  font-size: 26rpx;
  color: #909399;
  flex-shrink: 0;
}

.val {
  font-size: 28rpx;
  color: #333;
  text-align: right;
  flex: 1;
  word-break: break-all;
}

.row.block .val {
  text-align: left;
}
</style>
