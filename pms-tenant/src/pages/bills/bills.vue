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

function openDetail(id: number) {
  uni.navigateTo({ url: `/pages/bills/detail?id=${id}` })
}

onMounted(async () => {
  try {
    const res = await get<{ list?: BillItem[] }>('/api/mp/bills')
    if (res.success) {
      const topLevelList = (res as unknown as { list?: BillItem[] }).list
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
})
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="list.length === 0" class="empty">暂无账单</view>
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
