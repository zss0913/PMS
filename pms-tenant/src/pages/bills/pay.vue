<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get, post } from '@/api/request'

const FILTER_KEY = 'pms_bill_list_filter_v1'

interface BillRow {
  id: number
  tenantId: number
  code: string
  feeType: string
  period: string
  accountReceivable: number
  amountPaid: number
  amountDue: number
  paymentStatus: string
  dueDate: string
  tenantName?: string
}

const loading = ref(true)
const list = ref<BillRow[]>([])
const eligible = ref<BillRow[]>([])
const selectedIds = ref<Set<number>>(new Set())
const step = ref<1 | 2>(1)
const paying = ref(false)
const hasFilter = ref(false)
const filterHint = ref('')
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

function isPayable(b: BillRow): boolean {
  return b.paymentStatus !== 'paid' && Number(b.amountDue) > 0
}

async function loadList() {
  loading.value = true
  try {
    const params = readFilterParams()
    hasFilter.value = Object.keys(params).length > 0
    filterHint.value = filterSummary()
    const res = (await get('/api/mp/bills', params)) as {
      success?: boolean
      list?: BillRow[]
      message?: string
    }
    if (!res.success) {
      throw new Error(res.message || '加载失败')
    }
    const raw = Array.isArray(res.list) ? res.list : []
    list.value = raw.map((b) => ({
      ...b,
      tenantId: Number(b.tenantId),
    }))
    eligible.value = list.value.filter(isPayable)
    selectedIds.value = new Set()
    step.value = 1
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '加载失败', icon: 'none' })
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

const selectedBills = computed(() =>
  eligible.value.filter((b) => selectedIds.value.has(b.id))
)

const totalDue = computed(() =>
  selectedBills.value.reduce((s, b) => s + Number(b.amountDue || 0), 0)
)

function toggleRow(b: BillRow) {
  if (!isPayable(b)) return
  const next = new Set(selectedIds.value)
  if (next.has(b.id)) {
    next.delete(b.id)
    selectedIds.value = next
    return
  }
  if (next.size > 0) {
    const first = eligible.value.find((x) => next.has(x.id))
    if (first && first.tenantId !== b.tenantId) {
      uni.showToast({ title: '合并缴费仅支持同一租客主体', icon: 'none' })
      return
    }
  }
  next.add(b.id)
  selectedIds.value = next
}

function selectAllSameTenant() {
  const pay = eligible.value
  if (pay.length === 0) {
    uni.showToast({ title: '暂无待缴账单', icon: 'none' })
    return
  }
  const tid = pay[0]!.tenantId
  const same = pay.filter((b) => b.tenantId === tid)
  selectedIds.value = new Set(same.map((b) => b.id))
  if (pay.some((b) => b.tenantId !== tid)) {
    uni.showToast({
      title: `已选同一租客下 ${same.length} 笔（列表含多主体时请分别缴费）`,
      icon: 'none',
    })
  }
}

function clearSelection() {
  selectedIds.value = new Set()
}

function goFilter() {
  uni.navigateTo({ url: '/pages/bills/filter' })
}

function goBack() {
  if (step.value === 2) {
    step.value = 1
    return
  }
  uni.navigateBack({
    fail: () => {
      uni.redirectTo({ url: '/pages/bills/bills' })
    },
  })
}

function goNext() {
  if (selectedIds.value.size === 0) {
    uni.showToast({ title: '请勾选待缴账单', icon: 'none' })
    return
  }
  step.value = 2
}

async function confirmPay() {
  if (selectedIds.value.size === 0 || paying.value) return
  const ids = [...selectedIds.value]
  const bills = selectedBills.value
  const tid = bills[0]?.tenantId
  if (!tid || bills.some((b) => b.tenantId !== tid)) {
    uni.showToast({ title: '所选账单须为同一租客主体', icon: 'none' })
    return
  }

  paying.value = true
  try {
    const okModal = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '模拟微信支付',
        content: `合计 ¥${totalDue.value.toFixed(2)}，确认模拟支付成功？`,
        confirmText: '确认支付',
        cancelText: '取消',
        success: (r) => resolve(Boolean(r.confirm)),
      })
    })
    if (!okModal) {
      paying.value = false
      return
    }

    const checkout = (await post('/api/mp/bills/batch-checkout', {
      billIds: ids,
      channel: 'wechat',
    })) as {
      success?: boolean
      message?: string
      data?: { payment?: { id: number } }
    }

    if (!checkout.success || !checkout.data?.payment?.id) {
      throw new Error(checkout.message || '发起支付失败')
    }

    const complete = (await post('/api/mp/bills/checkout-complete', {
      paymentId: checkout.data.payment.id,
      gatewayTradeNo: `MOCK-WX-TENANT-${checkout.data.payment.id}-${Date.now()}`,
    })) as { success?: boolean; message?: string }

    if (!complete.success) {
      throw new Error(complete.message || '确认支付失败')
    }

    uni.showToast({ title: '支付成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack({ fail: () => uni.redirectTo({ url: '/pages/bills/bills' }) })
    }, 500)
  } catch (e) {
    uni.showToast({ title: e instanceof Error ? e.message : '支付失败', icon: 'none' })
  } finally {
    paying.value = false
  }
}

const topInsetPx = () => statusBarHeight.value + navContentHeight
const pageContentTopPx = () => topInsetPx() + 14

function fmtDue(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('zh-CN')
  } catch {
    return iso
  }
}
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
        <text class="nav-title">{{ step === 1 ? '合并缴费' : '确认支付' }}</text>
        <view class="nav-side nav-right">
          <view
            v-if="step === 1"
            class="nav-action-hit"
            hover-class="nav-action-hit--active"
            @click.stop="goFilter"
          >
            <text class="nav-action">筛选</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page" :style="{ paddingTop: pageContentTopPx() + 'px' }">
      <template v-if="step === 1">
        <view v-if="!loading" class="summary-bar">
          <text class="summary-main">待缴账单 {{ eligible.length }} 笔</text>
          <text v-if="hasFilter" class="summary-sub">{{ filterHint }}</text>
        </view>

        <view v-if="loading" class="loading">加载中…</view>
        <view v-else-if="eligible.length === 0" class="empty">暂无待缴账单</view>
        <view v-else class="toolbar">
          <button type="default" class="btn-secondary" @click="selectAllSameTenant">全选（同租客）</button>
          <button type="default" class="btn-secondary" @click="clearSelection">清空</button>
        </view>

        <view v-if="!loading && eligible.length > 0" class="list">
          <view
            v-for="item in eligible"
            :key="item.id"
            class="card"
            :class="{ checked: selectedIds.has(item.id) }"
            @click="toggleRow(item)"
          >
            <view class="check-row">
              <view class="checkbox" :class="{ on: selectedIds.has(item.id) }" />
              <text class="code mono">{{ item.code }}</text>
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
              <text class="label">应收日期</text>
              <text class="value">{{ fmtDue(item.dueDate) }}</text>
            </view>
            <view class="row">
              <text class="label">待缴</text>
              <text class="value amount-due">¥{{ Number(item.amountDue).toFixed(2) }}</text>
            </view>
          </view>
        </view>

        <view v-if="!loading && eligible.length > 0" class="footer-actions">
          <button
            type="primary"
            class="btn-primary"
            :disabled="selectedIds.size === 0"
            @click="goNext"
          >
            下一步（已选 {{ selectedIds.size }} 笔）
          </button>
        </view>
      </template>

      <template v-else>
        <view class="confirm-card">
          <text class="confirm-title">应付合计（不可修改）</text>
          <text class="confirm-amount">¥{{ totalDue.toFixed(2) }}</text>
          <text class="confirm-hint">将一次性结清所选账单，支付渠道：微信（模拟）</text>
        </view>
        <view class="confirm-list">
          <view v-for="b in selectedBills" :key="b.id" class="mini-row">
            <text class="mini-code">{{ b.code }}</text>
            <text class="mini-due">¥{{ Number(b.amountDue).toFixed(2) }}</text>
          </view>
        </view>
        <view class="footer-actions">
          <button type="default" class="btn-secondary wide" :disabled="paying" @click="step = 1">
            上一步
          </button>
          <button type="primary" class="btn-primary wide" :loading="paying" @click="confirmPay">
            确认支付（模拟微信）
          </button>
        </view>
      </template>
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
  padding: 0 24rpx calc(32rpx + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  min-height: 100vh;
}

.summary-bar {
  @include pms-card;
  padding: 24rpx 28rpx;
  margin-bottom: 24rpx;
}

.summary-main {
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
}

.summary-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: $pms-text-dim;
}

.toolbar {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.btn-secondary {
  flex: 1;
  font-size: 26rpx;
  background: rgba(51, 65, 85, 0.6);
  color: $pms-text;
  border: 1rpx solid $pms-border;
}

.btn-primary {
  width: 100%;
  background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
}

.btn-primary[disabled] {
  opacity: 0.45;
}

.footer-actions {
  margin-top: 32rpx;
  padding-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.wide {
  width: 100%;
}

.loading,
.empty {
  text-align: center;
  padding: 80rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.list .card {
  @include pms-card;
  padding: 28rpx;
  margin-bottom: 20rpx;
  border: 2rpx solid transparent;
}

.list .card.checked {
  border-color: rgba(56, 189, 248, 0.45);
}

.check-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.checkbox {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid $pms-text-muted;
  flex-shrink: 0;
}

.checkbox.on {
  background: $pms-accent;
  border-color: $pms-accent;
}

.code {
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-accent;
}

.mono {
  font-family: 'Space Grotesk', ui-monospace, monospace;
}

.row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
  font-size: 26rpx;
}

.row:last-child {
  margin-bottom: 0;
}

.label {
  color: $pms-text-muted;
}

.value {
  color: $pms-text;
  text-align: right;
  max-width: 65%;
}

.amount-due {
  font-weight: 700;
  color: $pms-warning;
}

.confirm-card {
  @include pms-card;
  padding: 40rpx 32rpx;
  text-align: center;
  margin-bottom: 24rpx;
}

.confirm-title {
  display: block;
  font-size: 28rpx;
  color: $pms-text-muted;
  margin-bottom: 16rpx;
}

.confirm-amount {
  display: block;
  font-size: 56rpx;
  font-weight: 800;
  color: $pms-warning;
  margin-bottom: 16rpx;
}

.confirm-hint {
  display: block;
  font-size: 24rpx;
  color: $pms-text-dim;
  line-height: 1.5;
}

.confirm-list {
  @include pms-card;
  padding: 24rpx 28rpx;
}

.mini-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.15);
  font-size: 26rpx;
}

.mini-row:last-child {
  border-bottom: none;
}

.mini-code {
  color: $pms-accent;
  font-family: ui-monospace, monospace;
  font-size: 24rpx;
}

.mini-due {
  color: $pms-text;
  font-weight: 600;
}
</style>
