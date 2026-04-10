<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'

const FILTER_KEY = 'pms_bill_list_filter_v1'

interface BillItem {
  id: number
  code: string
  feeType: string
  period: string
  accountReceivable: number
  amountPaid: number
  amountDue: number
  paymentStatus: string
  dueDate: string
  building?: { name: string }
  room?: { roomNumber: string }
}

const list = ref<BillItem[]>([])
const loading = ref(true)
const hasFilter = ref(false)
const statusBarHeight = ref(20)
const navContentHeight = 48

function readFilterParams(): Record<string, string> {
  try {
    const raw = uni.getStorageSync(FILTER_KEY)
    if (!raw) return {}
    const f = JSON.parse(String(raw)) as {
      dueDateFrom?: string
      dueDateTo?: string
      feeType?: string
      payState?: string
    }
    const params: Record<string, string> = {}
    if (f.dueDateFrom?.trim()) params.dueDateFrom = f.dueDateFrom.trim()
    if (f.dueDateTo?.trim()) params.dueDateTo = f.dueDateTo.trim()
    if (f.feeType?.trim()) params.feeType = f.feeType.trim()
    if (f.payState && f.payState !== 'all') params.payState = f.payState
    return params
  } catch {
    return {}
  }
}

function filterSummary(): string {
  try {
    const raw = uni.getStorageSync(FILTER_KEY)
    if (!raw) return ''
    const f = JSON.parse(String(raw)) as {
      dueDateFrom?: string
      dueDateTo?: string
      feeType?: string
      payState?: string
    }
    const parts: string[] = []
    if (f.dueDateFrom || f.dueDateTo) {
      parts.push(`应收 ${f.dueDateFrom || '…'} ~ ${f.dueDateTo || '…'}`)
    }
    if (f.feeType) parts.push(f.feeType)
    if (f.payState === 'paid') parts.push('已缴')
    if (f.payState === 'unpaid') parts.push('待缴')
    return parts.length ? parts.join(' · ') : ''
  } catch {
    return ''
  }
}

const filterHint = ref('')

async function loadList() {
  loading.value = true
  try {
    const params = readFilterParams()
    hasFilter.value = Object.keys(params).length > 0
    filterHint.value = filterSummary()
    const res = (await get('/api/mp/bills', params)) as {
      success?: boolean
      list?: BillItem[]
      data?: { list?: BillItem[] }
    }
    if (res.success) {
      const topLevelList = res.list
      const wrappedList = res.data?.list
      list.value = Array.isArray(topLevelList)
        ? topLevelList
        : Array.isArray(wrappedList)
          ? wrappedList
          : []
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  try {
    const sys = uni.getSystemInfoSync()
    statusBarHeight.value = sys.statusBarHeight ?? 20
  } catch {
    statusBarHeight.value = 20
  }
})

onShow(() => {
  void loadList()
})

function openDetail(id: number) {
  uni.navigateTo({ url: `/pages/bills/detail?id=${id}` })
}

function goFilter() {
  uni.navigateTo({ url: '/pages/bills/filter' })
}

function goPay() {
  uni.navigateTo({ url: '/pages/bills/pay' })
}

function clearFilter() {
  uni.removeStorageSync(FILTER_KEY)
  hasFilter.value = false
  filterHint.value = ''
  void loadList()
}

function goBack() {
  try {
    const pages = getCurrentPages()
    if (!pages || pages.length <= 1) {
      uni.switchTab({ url: '/pages/index/index' })
      return
    }
  } catch {
    uni.switchTab({ url: '/pages/index/index' })
    return
  }
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' })
    },
  })
}

const topInsetPx = () => statusBarHeight.value + navContentHeight
const pageContentTopPx = () => topInsetPx() + 14
</script>

<template>
  <view class="shell">
    <view class="nav-wrap" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-bar" :style="{ minHeight: navContentHeight + 'px' }">
        <view class="nav-side nav-left">
          <view class="nav-back-hit" hover-class="nav-back-hit--active" @click.stop="goBack">
            <text class="nav-back">‹</text>
          </view>
        </view>
        <text class="nav-title">我的账单</text>
        <view class="nav-side nav-right">
          <view class="nav-action-hit" hover-class="nav-action-hit--active" @click.stop="goFilter">
            <text class="nav-action">筛选</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page" :style="{ paddingTop: pageContentTopPx() + 'px' }">
      <view v-if="!loading" class="summary-bar">
        <text class="summary-main">共 {{ list.length }} 条账单</text>
        <text v-if="hasFilter" class="summary-sub">{{ filterHint }}</text>
        <text v-if="hasFilter" class="summary-clear" @click="clearFilter">清除筛选</text>
      </view>

      <view v-if="loading" class="loading">加载中…</view>
      <view v-else-if="list.length === 0" class="empty">
        {{ hasFilter ? '暂无符合条件的账单' : '暂无账单' }}
      </view>
      <view v-else class="list">
        <view v-for="item in list" :key="item.id" class="card" @click="openDetail(item.id)">
          <view class="row">
            <text class="label">账单编号</text>
            <text class="value mono">{{ item.code }}</text>
          </view>
          <view class="row">
            <text class="label">费用类型</text>
            <text class="value">{{ item.feeType }}</text>
          </view>
          <view class="row">
            <text class="label">账期</text>
            <text class="value">{{ item.period }}</text>
          </view>
          <view class="row">
            <text class="label">应收</text>
            <text class="value amount">¥{{ item.accountReceivable }}</text>
          </view>
          <view class="row">
            <text class="label">待缴</text>
            <text class="value amount-due">¥{{ item.amountDue }}</text>
          </view>
          <view class="row">
            <text class="label">状态</text>
            <text class="value" :class="item.paymentStatus === 'paid' ? 'paid' : 'unpaid'">
              {{ item.paymentStatus === 'paid' ? '已缴' : '待缴' }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <view class="fab-pay" hover-class="fab-pay--active" @click.stop="goPay">
      <text class="fab-pay-text">缴费</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.shell {
  min-height: 100vh;
  background: $pms-bg-deep;
}

.nav-wrap {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(180deg, $pms-bg 0%, rgba(15, 23, 42, 0.97) 100%);
  border-bottom: 1rpx solid $pms-border;
  box-shadow: 0 12rpx 40rpx rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
}

.nav-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 12rpx 8rpx;
  box-sizing: border-box;
}

.nav-side {
  min-width: 140rpx;
  flex-shrink: 0;
}

.nav-left {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.nav-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.nav-back-hit {
  min-width: 88rpx;
  min-height: 88rpx;
  margin-left: -8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  @include pms-tap;
}

.nav-back-hit--active {
  opacity: 0.75;
  background: rgba(148, 163, 184, 0.12);
}

.nav-back {
  font-size: 52rpx;
  font-weight: 300;
  color: $pms-text;
  line-height: 1;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: $pms-text;
}

.nav-action-hit {
  min-height: 72rpx;
  padding: 0 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  @include pms-tap;
}

.nav-action-hit--active {
  background: rgba(56, 189, 248, 0.12);
}

.nav-action {
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-accent;
}

.page {
  padding: 0 24rpx calc(200rpx + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  min-height: 100vh;
}

.fab-pay {
  position: fixed;
  right: 32rpx;
  bottom: calc(48rpx + env(safe-area-inset-bottom, 0px));
  z-index: 90;
  width: 112rpx;
  height: 112rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #0ea5e9 0%, #2563eb 55%, #1d4ed8 100%);
  box-shadow:
    0 12rpx 32rpx rgba(37, 99, 235, 0.45),
    0 0 0 1rpx rgba(255, 255, 255, 0.12) inset;
  @include pms-tap;
}

.fab-pay--active {
  opacity: 0.88;
  transform: scale(0.96);
}

.fab-pay-text {
  font-size: 28rpx;
  font-weight: 700;
  color: #fff;
}

.summary-bar {
  @include pms-card;
  padding: 24rpx 28rpx;
  margin-bottom: 24rpx;
}

.summary-main {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
  margin-bottom: 8rpx;
}

.summary-sub {
  display: block;
  font-size: 24rpx;
  color: $pms-text-dim;
  line-height: 1.45;
  margin-bottom: 12rpx;
}

.summary-clear {
  font-size: 26rpx;
  color: $pms-accent;
  @include pms-tap;
}

.loading,
.empty {
  text-align: center;
  padding: 80rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.list {
  .card {
    @include pms-card;
    @include pms-tap;
    padding: 32rpx;
    margin-bottom: 24rpx;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18rpx;
    font-size: 28rpx;
    &:last-child {
      margin-bottom: 0;
    }
  }
  .label {
    color: $pms-text-muted;
  }
  .value {
    color: $pms-text;
    text-align: right;
    max-width: 60%;
  }
  .mono {
    font-family: 'Space Grotesk', ui-monospace, monospace;
    font-size: 26rpx;
    color: $pms-accent;
  }
  .amount {
    font-weight: 600;
    color: $pms-text;
  }
  .amount-due {
    font-weight: 700;
    color: $pms-warning;
  }
  .paid {
    color: $pms-cta;
    font-weight: 600;
  }
  .unpaid {
    color: $pms-warning;
    font-weight: 600;
  }
}
</style>
