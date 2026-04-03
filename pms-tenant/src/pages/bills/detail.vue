<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { get } from '@/api/request'

interface BillDetail {
  id: number
  code: string
  ruleName: string
  feeType: string
  period: string
  tenantName?: string | null
  buildingName?: string | null
  room?: string | null
  accountReceivable: number
  amountPaid: number
  amountDue: number
  invoiceIssuedAmount: number
  receiptIssuedAmount: number
  overdue: boolean
  status: string
  paymentStatus: string
  dueDate: string
  payments?: Array<{
    id: number
    amount: number
    paidAt: string | null
    paymentMethod: string | null
  }>
  refunds?: Array<{
    id: number
    code: string
    amount: number
    reason: string | null
    refundAt: string
  }>
}

const loading = ref(true)
const bill = ref<BillDetail | null>(null)

function fmtMoney(v: number) {
  return `¥${Number(v || 0).toFixed(2)}`
}

function statusText(paymentStatus: string) {
  if (paymentStatus === 'paid') return '已结清'
  if (paymentStatus === 'partial') return '部分缴纳'
  return '未缴纳'
}

function openStatusText(status: string) {
  return status === 'open' ? '开启' : status === 'closed' ? '关闭' : status
}

onLoad(async (query) => {
  const id = Number(query?.id || 0)
  if (!id) {
    uni.showToast({ title: '账单ID无效', icon: 'none' })
    loading.value = false
    return
  }
  try {
    const res = await get<{ data?: BillDetail }>(`/api/mp/bills/${id}`)
    if (!res.success) {
      throw new Error(res.message || '获取账单失败')
    }
    const topData = (res as unknown as { data?: BillDetail }).data
    const wrappedData = res.data?.data
    bill.value = topData ?? wrappedData ?? null
  } catch (e) {
    const msg = e instanceof Error ? e.message : '加载失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="!bill" class="empty">账单不存在或无权限查看</view>
    <view v-else class="space">
      <view class="card">
        <view class="row">
          <text class="label">账单编号</text>
          <text class="value mono">{{ bill.code }}</text>
        </view>
        <view class="row">
          <text class="label">租客</text>
          <text class="value">{{ bill.tenantName || '—' }}</text>
        </view>
        <view class="row">
          <text class="label">楼宇</text>
          <text class="value">{{ bill.buildingName || '—' }}</text>
        </view>
        <view class="row">
          <text class="label">房源</text>
          <text class="value">{{ bill.room || '—' }}</text>
        </view>
        <view class="row">
          <text class="label">逾期状态</text>
          <text class="value" :class="bill.overdue ? 'unpaid' : 'normal'">
            {{ bill.overdue ? '逾期' : '未逾期' }}
          </text>
        </view>
        <view class="row">
          <text class="label">已开票</text>
          <text class="value">{{ fmtMoney(bill.invoiceIssuedAmount) }}</text>
        </view>
        <view class="row">
          <text class="label">规则名称</text>
          <text class="value">{{ bill.ruleName }}</text>
        </view>
        <view class="row">
          <text class="label">费用类型</text>
          <text class="value">{{ bill.feeType }}</text>
        </view>
        <view class="row">
          <text class="label">账期</text>
          <text class="value">{{ bill.period }}</text>
        </view>
        <view class="row">
          <text class="label">已开收据</text>
          <text class="value">{{ fmtMoney(bill.receiptIssuedAmount) }}</text>
        </view>
        <view class="row">
          <text class="label">应收</text>
          <text class="value">{{ fmtMoney(bill.accountReceivable) }}</text>
        </view>
        <view class="row">
          <text class="label">已缴</text>
          <text class="value">{{ fmtMoney(bill.amountPaid) }}</text>
        </view>
        <view class="row">
          <text class="label">待缴</text>
          <text class="value amount-due">{{ fmtMoney(bill.amountDue) }}</text>
        </view>
        <view class="row">
          <text class="label">状态</text>
          <text class="value" :class="bill.status === 'open' ? 'paid' : 'normal'">
            {{ openStatusText(bill.status) }}
          </text>
        </view>
        <view class="row">
          <text class="label">结清状态</text>
          <text class="value" :class="bill.paymentStatus === 'paid' ? 'paid' : bill.paymentStatus === 'partial' ? 'partial' : 'unpaid'">
            {{ statusText(bill.paymentStatus) }}
          </text>
        </view>
        <view class="row">
          <text class="label">应收日期</text>
          <text class="value">{{ new Date(bill.dueDate).toLocaleDateString('zh-CN') }}</text>
        </view>
      </view>

      <view class="card">
        <view class="section-title">缴费记录</view>
        <view v-if="!bill.payments || bill.payments.length === 0" class="empty-inline">暂无缴费记录</view>
        <view v-else>
          <view v-for="p in bill.payments" :key="p.id" class="sub-row">
            <text class="sub-left">¥{{ Number(p.amount || 0).toFixed(2) }}</text>
            <text class="sub-right">
              {{ p.paymentMethod || '未知方式' }} · {{ p.paidAt ? new Date(p.paidAt).toLocaleString('zh-CN') : '时间未知' }}
            </text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="section-title">退费记录</view>
        <view v-if="!bill.refunds || bill.refunds.length === 0" class="empty-inline">暂无退费记录</view>
        <view v-else>
          <view v-for="r in bill.refunds" :key="r.id" class="sub-row">
            <text class="sub-left">{{ r.code }} · ¥{{ Number(r.amount || 0).toFixed(2) }}</text>
            <text class="sub-right">
              {{ r.reason || '—' }} · {{ new Date(r.refundAt).toLocaleString('zh-CN') }}
            </text>
          </view>
        </view>
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

.loading,
.empty {
  text-align: center;
  padding: 100rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.card {
  @include pms-card;
  padding: 32rpx;
}

.space {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
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
  color: $pms-accent;
  font-size: 26rpx;
}

.amount-due {
  color: $pms-warning;
  font-weight: 700;
}

.paid {
  color: $pms-cta;
  font-weight: 600;
}

.unpaid {
  color: $pms-warning;
  font-weight: 600;
}

.partial {
  color: #f59e0b;
  font-weight: 600;
}

.normal {
  color: $pms-text;
  font-weight: 600;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 16rpx;
}

.empty-inline {
  color: $pms-text-muted;
  font-size: 26rpx;
}

.sub-row {
  padding: 14rpx 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.sub-left {
  display: block;
  color: $pms-text;
  font-size: 27rpx;
}

.sub-right {
  display: block;
  margin-top: 6rpx;
  color: $pms-text-muted;
  font-size: 24rpx;
}
</style>
