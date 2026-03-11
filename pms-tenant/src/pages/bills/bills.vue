<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { get } from '@/api/request'

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

onMounted(async () => {
  try {
    const res = await get<{ list: BillItem[] }>('/api/mp/bills')
    if (res.success && res.data) {
      list.value = res.data.list
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else-if="list.length === 0" class="empty">暂无账单</view>
    <view v-else class="list">
      <view v-for="item in list" :key="item.id" class="card">
        <view class="row">
          <text class="label">账单编号</text>
          <text class="value">{{ item.code }}</text>
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
          <text class="value amount">¥{{ item.amountDue }}</text>
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
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
}
.loading, .empty {
  text-align: center;
  padding: 80rpx;
  color: #999;
}
.list {
  .card {
    background: #fff;
    border-radius: 16rpx;
    padding: 32rpx;
    margin-bottom: 24rpx;
  }
  .row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
    font-size: 28rpx;
  }
  .label {
    color: #666;
  }
  .amount {
    font-weight: bold;
    color: #f56c6c;
  }
  .paid { color: #67c23a; }
  .unpaid { color: #e6a23c; }
}
</style>
