<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { get } from '@/api/request'

const BILL_FILTER_STORAGE_KEY = 'pms_bill_list_filter_v1'

type PayState = 'all' | 'paid' | 'unpaid'

const loading = ref(true)
const dueDateFrom = ref('')
const dueDateTo = ref('')
const feeTypes = ref<string[]>([])
const feeIndex = ref(0)
const payLabels = ['全部', '待缴', '已缴']
const payIndex = ref(0)

const feeRange = computed(() => ['全部', ...feeTypes.value])

function parseSaved(): {
  dueDateFrom?: string
  dueDateTo?: string
  feeType?: string
  payState?: PayState
} {
  try {
    const raw = uni.getStorageSync(BILL_FILTER_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(String(raw)) as {
      dueDateFrom?: string
      dueDateTo?: string
      feeType?: string
      payState?: PayState
    }
  } catch {
    return {}
  }
}

function applySaved() {
  const s = parseSaved()
  dueDateFrom.value = s.dueDateFrom?.trim() ?? ''
  dueDateTo.value = s.dueDateTo?.trim() ?? ''
  if (s.feeType) {
    const i = feeTypes.value.indexOf(s.feeType)
    feeIndex.value = i >= 0 ? i + 1 : 0
  } else {
    feeIndex.value = 0
  }
  if (s.payState === 'paid') payIndex.value = 2
  else if (s.payState === 'unpaid') payIndex.value = 1
  else payIndex.value = 0
}

onMounted(async () => {
  try {
    const res = (await get('/api/mp/bills/filter-options')) as {
      success?: boolean
      feeTypes?: string[]
    }
    if (res.success && Array.isArray(res.feeTypes)) {
      feeTypes.value = res.feeTypes
    }
  } catch {
    feeTypes.value = []
  } finally {
    loading.value = false
    applySaved()
  }
})

function onFeeChange(e: { detail: { value: string | number } }) {
  feeIndex.value = Number(e.detail.value)
}

function onPayChange(e: { detail: { value: string | number } }) {
  payIndex.value = Number(e.detail.value)
}

function onFromChange(e: { detail: { value: string } }) {
  dueDateFrom.value = e.detail.value
}

function onToChange(e: { detail: { value: string } }) {
  dueDateTo.value = e.detail.value
}

function cmpYmd(a: string, b: string): number {
  return a.localeCompare(b)
}

function submit() {
  const from = dueDateFrom.value.trim()
  const to = dueDateTo.value.trim()
  if (from && to && cmpYmd(from, to) > 0) {
    uni.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
    return
  }
  const feeType = feeIndex.value === 0 ? '' : feeTypes.value[feeIndex.value - 1] ?? ''
  const payState: PayState =
    payIndex.value === 0 ? 'all' : payIndex.value === 1 ? 'unpaid' : 'paid'
  uni.setStorageSync(
    BILL_FILTER_STORAGE_KEY,
    JSON.stringify({
      dueDateFrom: from,
      dueDateTo: to,
      feeType,
      payState,
    })
  )
  uni.navigateBack()
}

function reset() {
  dueDateFrom.value = ''
  dueDateTo.value = ''
  feeIndex.value = 0
  payIndex.value = 0
  uni.removeStorageSync(BILL_FILTER_STORAGE_KEY)
  uni.navigateBack()
}

function goBack() {
  uni.navigateBack({
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' })
    },
  })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else class="form">
      <text class="section-title">应收日期</text>
      <text class="hint">按账单「应收日期」字段筛选</text>
      <view class="row">
        <text class="label">开始日期</text>
        <picker mode="date" :value="dueDateFrom" @change="onFromChange">
          <view class="picker-value">{{ dueDateFrom || '请选择' }}</view>
        </picker>
      </view>
      <view class="row">
        <text class="label">结束日期</text>
        <picker mode="date" :value="dueDateTo" @change="onToChange">
          <view class="picker-value">{{ dueDateTo || '请选择' }}</view>
        </picker>
      </view>

      <text class="section-title mt">费用类型</text>
      <picker :range="feeRange" :value="feeIndex" @change="onFeeChange">
        <view class="row picker-row">
          <text class="label">类型</text>
          <text class="picker-value">{{ feeRange[feeIndex] ?? '全部' }}</text>
        </view>
      </picker>

      <text class="section-title mt">状态</text>
      <picker :range="payLabels" :value="payIndex" @change="onPayChange">
        <view class="row picker-row">
          <text class="label">缴费状态</text>
          <text class="picker-value">{{ payLabels[payIndex] }}</text>
        </view>
      </picker>

      <button class="btn primary" type="primary" @click="submit">确定</button>
      <button class="btn ghost" @click="reset">重置并返回</button>
      <button class="btn ghost" @click="goBack">取消</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 32rpx 48rpx;
  box-sizing: border-box;
  background: $pms-bg-deep;
}

.state {
  text-align: center;
  padding: 80rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.form {
  @include pms-card;
  padding: 32rpx 28rpx 40rpx;
}

.section-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-text;
  margin-bottom: 8rpx;
}

.section-title.mt {
  margin-top: 28rpx;
}

.hint {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  margin-bottom: 16rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid $pms-border;
  font-size: 28rpx;
}

.picker-row {
  width: 100%;
  box-sizing: border-box;
}

.label {
  color: $pms-text-muted;
  flex-shrink: 0;
}

.picker-value {
  color: $pms-accent;
  text-align: right;
  flex: 1;
  padding-left: 24rpx;
}

.btn {
  margin-top: 28rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  font-size: 30rpx;
  border: none;
}

.btn.primary {
  background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
  color: #fff !important;
}

.btn.ghost {
  background: transparent !important;
  color: $pms-text-muted !important;
  border: 1rpx solid $pms-border !important;
}
</style>
