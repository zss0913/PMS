<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const FILTER_STORAGE = 'pms_inspection_list_filters_v1'

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: '待执行', label: '待执行' },
  { value: '巡检中', label: '巡检中' },
  { value: '已完成', label: '已完成' },
  { value: '已逾期', label: '已逾期' },
] as const

const dateFrom = ref('')
const dateTo = ref('')
const status = ref('')

function readStorage() {
  try {
    const raw = uni.getStorageSync(FILTER_STORAGE)
    if (!raw) return
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw
    dateFrom.value = p.dateFrom || ''
    dateTo.value = p.dateTo || ''
    status.value = p.status || ''
  } catch {
    /* ignore */
  }
}

onLoad(() => {
  readStorage()
})

function applyAndBack() {
  let df = dateFrom.value
  let dt = dateTo.value
  if (df && dt && df > dt) {
    const t = df
    df = dt
    dt = t
  }
  const payload = {
    dateFrom: df,
    dateTo: dt,
    status: status.value,
  }
  uni.setStorageSync(FILTER_STORAGE, JSON.stringify(payload))
  uni.navigateBack()
}

function resetAndBack() {
  dateFrom.value = ''
  dateTo.value = ''
  status.value = ''
  uni.setStorageSync(
    FILTER_STORAGE,
    JSON.stringify({ dateFrom: '', dateTo: '', status: '' })
  )
  uni.navigateBack()
}
</script>

<template>
  <view class="page">
    <view class="section">
      <text class="label">计划日期</text>
      <text class="hint">起止日期与列表「计划日」一致，留空表示不限制</text>
      <view class="range-row">
        <picker mode="date" :value="dateFrom" @change="(e: any) => (dateFrom = e.detail.value)">
          <view class="picker-cell">{{ dateFrom || '开始日期' }}</view>
        </picker>
        <text class="range-sep">至</text>
        <picker mode="date" :value="dateTo" @change="(e: any) => (dateTo = e.detail.value)">
          <view class="picker-cell">{{ dateTo || '结束日期' }}</view>
        </picker>
      </view>
    </view>

    <view class="section">
      <text class="label">状态</text>
      <view class="chips">
        <view
          v-for="s in STATUS_OPTIONS"
          :key="s.value || 'all'"
          class="chip"
          :class="{ on: status === s.value }"
          @tap="status = s.value"
        >
          {{ s.label }}
        </view>
      </view>
    </view>

    <view class="footer">
      <button class="btn-reset" @click="resetAndBack">重置</button>
      <button class="btn-ok" type="primary" @click="applyAndBack">确定</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 32rpx 24rpx 200rpx;
  box-sizing: border-box;
  background: #0f172a;
}
.section {
  margin-bottom: 48rpx;
}
.label {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-text;
  margin-bottom: 12rpx;
}
.hint {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-bottom: 20rpx;
  line-height: 1.5;
}
.range-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.picker-cell {
  flex: 1;
  min-height: 80rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(148, 163, 184, 0.25);
  color: $pms-text;
  font-size: 28rpx;
}
.range-sep {
  font-size: 24rpx;
  color: $pms-text-muted;
  flex-shrink: 0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.chip {
  padding: 14rpx 32rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  background: rgba(255, 255, 255, 0.06);
  color: $pms-text-muted;
  border: 1rpx solid rgba(148, 163, 184, 0.2);
}
.chip.on {
  background: rgba(59, 130, 246, 0.25);
  color: #93c5fd;
  border-color: rgba(96, 165, 250, 0.5);
}
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  display: flex;
  gap: 24rpx;
  background: linear-gradient(180deg, transparent, #0f172a 30%);
  box-sizing: border-box;
}
.btn-reset {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  background: rgba(255, 255, 255, 0.08) !important;
  color: $pms-text !important;
  border: 1rpx solid rgba(148, 163, 184, 0.35) !important;
}
.btn-ok {
  flex: 2;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  background: #2563eb !important;
}
</style>
