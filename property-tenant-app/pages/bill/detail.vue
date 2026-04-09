<template>
  <view class="container">
    <view v-if="loading" class="hint">加载中…</view>
    <template v-else-if="bill">
      <view class="price-card">
        <view class="title">待缴金额(元)</view>
        <view class="amount">¥ {{ fmtMoney(bill.amountDue) }}</view>
        <view class="status">
          状态：<text :class="bill.paymentStatus === 'paid' ? 'ok' : 'warn'">{{
            statusText(bill.paymentStatus)
          }}</text>
          <u-tag v-if="bill.overdue" text="逾期" type="error" size="mini" class="tag-overdue"></u-tag>
        </view>
      </view>

      <view class="info-card">
        <view class="title">账单详情</view>
        <u-cell-group :border="false">
          <u-cell title="账单编号" :value="bill.code" :border="false"></u-cell>
          <u-cell title="费用类型" :value="bill.feeType" :border="false"></u-cell>
          <u-cell title="账期" :value="bill.period" :border="false"></u-cell>
          <u-cell title="应收" :value="'¥' + fmtMoney(bill.accountReceivable)" :border="false"></u-cell>
          <u-cell title="已缴" :value="'¥' + fmtMoney(bill.amountPaid)" :border="false"></u-cell>
          <u-cell v-if="bill.buildingName" title="楼宇" :value="bill.buildingName" :border="false"></u-cell>
          <u-cell v-if="bill.tenantName" title="租客" :value="bill.tenantName" :border="false"></u-cell>
          <u-cell title="截止日" :value="fmtDate(bill.dueDate)" :border="false"></u-cell>
        </u-cell-group>
      </view>

      <view class="info-card" v-if="bill.payments && bill.payments.length">
        <view class="title">缴纳记录</view>
        <view v-for="p in bill.payments" :key="p.id" class="record-item">
          ¥{{ fmtMoney(p.amount) }} · {{ p.paymentMethod || '—' }} · {{ fmtTime(p.paidAt) }}
        </view>
      </view>

      <view class="info-card" v-if="bill.refunds && bill.refunds.length">
        <view class="title">退费记录</view>
        <view v-for="r in bill.refunds" :key="r.id" class="record-item">
          ¥{{ fmtMoney(r.amount) }} · {{ r.code || '—' }} · {{ r.reason || '—' }} ·
          {{ fmtTime(r.refundAt) }}
        </view>
      </view>

      <view v-if="showPayBar" class="pay-bar">
        <u-button
          type="success"
          :text="isWorkOrderFeeBill ? '前往工单支付' : '微信支付'"
          :loading="paying"
          @click="onWechatPay"
        ></u-button>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post } from '../../utils/request.js'
import { formatDateOnly, formatDateTime } from '../../utils/datetime.js'

const loading = ref(true)
const paying = ref(false)
const bill = ref(null)

const showPayBar = computed(() => {
  const b = bill.value
  if (!b) return false
  return b.paymentStatus !== 'paid' && Number(b.amountDue) > 0
})

const isWorkOrderFeeBill = computed(() => {
  const b = bill.value
  return !!b && b.billSource === 'work_order_fee' && Number(b.workOrderId) > 0
})

function fmtMoney(v) {
  return Number(v || 0).toFixed(2)
}

function statusText(ps) {
  if (ps === 'paid') return '已结清'
  if (ps === 'partial') return '部分缴纳'
  return '未缴纳'
}

function fmtTime(iso) {
  return formatDateTime(iso)
}

function fmtDate(iso) {
  return formatDateOnly(iso)
}

async function onWechatPay() {
  const b = bill.value
  if (!b || !b.id) return
  if (isWorkOrderFeeBill.value && b.workOrderId) {
    uni.navigateTo({ url: `/pages/repair/detail?id=${b.workOrderId}` })
    return
  }
  paying.value = true
  try {
    const prep = await post(`/api/mp/bills/${b.id}/checkout`, { channel: 'wechat' })
    if (!prep.success || !prep.data || !prep.data.payment) {
      throw new Error(prep.message || '下单失败')
    }
    const pid = prep.data.payment.id
    await post('/api/mp/bills/checkout-complete', { paymentId: pid })
    uni.showToast({ title: '支付已确认' })
    const res = await get(`/api/mp/bills/${b.id}`)
    if (res.success) {
      let nb = res.data
      if (nb && typeof nb === 'object' && nb.data && nb.data.id) nb = nb.data
      if (nb && nb.id) bill.value = nb
    }
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '支付失败', icon: 'none', duration: 3000 })
  } finally {
    paying.value = false
  }
}

onLoad(async (query) => {
  const id = Number(query && query.id)
  if (!id) {
    uni.showToast({ title: '账单ID无效', icon: 'none' })
    loading.value = false
    return
  }
  try {
    const res = await get(`/api/mp/bills/${id}`)
    if (!res.success) {
      throw new Error(res.message || '获取失败')
    }
    let b = res.data
    if (b && typeof b === 'object' && b.data && b.data.id) {
      b = b.data
    }
    bill.value = b && b.id ? b : null
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  padding-bottom: 160rpx;
}
.hint {
  text-align: center;
  padding: 80rpx;
  color: #909399;
}
.price-card {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 60rpx 0;
  text-align: center;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
  .title {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 20rpx;
  }
  .amount {
    font-size: 56rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
  }
  .status {
    font-size: 28rpx;
    color: #666;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12rpx;
    .ok {
      color: #19be6b;
    }
    .warn {
      color: #e43d33;
    }
    .tag-overdue {
      margin-left: 8rpx;
    }
  }
}

.info-card {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  .title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 20rpx;
    padding-bottom: 16rpx;
    border-bottom: 1rpx solid #f0f0f0;
  }
  .record-item {
    font-size: 28rpx;
    color: #606266;
    padding: 12rpx 0;
    border-bottom: 1rpx solid #f5f5f5;
  }
}
.pay-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
}
</style>
