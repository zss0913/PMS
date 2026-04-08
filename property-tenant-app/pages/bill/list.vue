<template>
  <view class="container">
    <u-tabs :list="tabs" :current="tabIndex" @click="onTabClick"></u-tabs>
    <view class="search-bar" style="display: none;">
      <u-search
        v-model="keyword"
        placeholder="搜索编号 / 费用类型 / 账期"
        :show-action="false"
        @change="() => {}"
      ></u-search>
    </view>
    <view v-if="batchMode" class="batch-bar" style="display: none;">
      <text class="batch-info">已选 {{ selectedIds.length }} 笔</text>
      <u-button size="small" type="primary" plain :loading="batchPaying" @click="onBatchPay">合并支付</u-button>
      <u-button size="small" @click="exitBatch">取消</u-button>
    </view>
    <view v-else class="batch-entry" style="display: none;">
      <u-button size="small" plain type="primary" @click="enterBatch">批量选择</u-button>
    </view>

    <view v-if="loading" class="hint">加载中…</view>
    <view v-else class="list">
      <view
        v-for="item in displayed"
        :key="item.id"
        class="list-item"
        @click="onRowClick(item)"
      >
        <view v-if="batchMode" class="check-wrap" @click.stop="toggleSelect(item)">
          <view class="check" :class="{ on: selectedIds.includes(item.id) }"></view>
        </view>
        <view class="card-main">
          <view class="header">
            <text class="title">{{ item.code }}</text>
            <u-tag
              v-if="tagText(item)"
              :text="tagText(item)"
              :type="tagType(item)"
              size="mini"
            ></u-tag>
            <u-tag
              v-else
              :text="item.paymentStatus === 'paid' ? '已缴' : '待缴'"
              :type="item.paymentStatus === 'paid' ? 'success' : 'warning'"
              size="mini"
            ></u-tag>
          </view>
          <view class="content">
            <view class="desc">{{ item.feeType }}</view>
            <view class="desc">账期：{{ item.period }}</view>
            <view class="desc">待缴：<text class="price">¥{{ item.amountDue }}</text></view>
          </view>
        </view>
      </view>
      <u-empty v-if="!displayed.length" mode="list" text="暂无账单" margin-top="60"></u-empty>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { get, post } from '../../utils/request.js'

const allBills = ref([])
const loading = ref(true)
const tabIndex = ref(0)
const keyword = ref('')
const batchMode = ref(false)
const selectedIds = ref([])
const batchPaying = ref(false)

const tabs = ref([{ name: '全部' }, { name: '逾期' }, { name: '待缴' }, { name: '已结清' }])

function todayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function isOverdue(row) {
  if (row.paymentStatus === 'paid') return false
  const due = row.dueDate
  if (!due) return false
  return String(due).slice(0, 10) < todayStr()
}

function isPending(row) {
  return row.paymentStatus !== 'paid' && Number(row.amountDue) > 0
}

const filteredByTab = computed(() => {
  const list = allBills.value
  const t = tabIndex.value
  if (t === 0) return list
  if (t === 1) return list.filter((b) => isOverdue(b))
  if (t === 2) return list.filter((b) => isPending(b) && !isOverdue(b))
  if (t === 3) return list.filter((b) => b.paymentStatus === 'paid')
  return list
})

const displayed = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  let rows = filteredByTab.value
  if (k) {
    rows = rows.filter((b) => {
      const s = `${b.code || ''} ${b.feeType || ''} ${b.period || ''}`.toLowerCase()
      return s.includes(k)
    })
  }
  return rows
})

function tagText(row) {
  if (row.paymentStatus === 'paid') return ''
  if (isOverdue(row)) return '逾期'
  return ''
}

function tagType(row) {
  return 'error'
}

function onTabClick(e) {
  tabIndex.value = e.index
  selectedIds.value = []
}

function toggleSelect(item) {
  const id = item.id
  const i = selectedIds.value.indexOf(id)
  if (i >= 0) selectedIds.value = selectedIds.value.filter((x) => x !== id)
  else selectedIds.value = [...selectedIds.value, id]
}

function enterBatch() {
  batchMode.value = true
  selectedIds.value = []
}

function exitBatch() {
  batchMode.value = false
  selectedIds.value = []
}

async function onBatchPay() {
  if (selectedIds.value.length < 2) {
    uni.showToast({ title: '请至少选择 2 笔', icon: 'none' })
    return
  }
  batchPaying.value = true
  try {
    const prep = await post('/api/mp/bills/batch-checkout', {
      billIds: selectedIds.value,
      channel: 'wechat',
    })
    if (!prep.success || !prep.data || !prep.data.payment) {
      throw new Error(prep.message || '下单失败')
    }
    const pid = prep.data.payment.id
    await post('/api/mp/bills/checkout-complete', { paymentId: pid })
    uni.showToast({ title: '合并支付已确认' })
    batchMode.value = false
    selectedIds.value = []
    const res = await get('/api/mp/bills')
    if (res.success) {
      const top = res.list
      const wrapped = res.data && res.data.list
      allBills.value = Array.isArray(top) ? top : Array.isArray(wrapped) ? wrapped : []
    }
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '支付失败', icon: 'none', duration: 3000 })
  } finally {
    batchPaying.value = false
  }
}

function onRowClick(item) {
  if (batchMode.value) {
    toggleSelect(item)
    return
  }
  uni.navigateTo({ url: '/pages/bill/detail?id=' + item.id })
}

onMounted(async () => {
  try {
    const res = await get('/api/mp/bills')
    if (res.success) {
      const top = res.list
      const wrapped = res.data && res.data.list
      allBills.value = Array.isArray(top) ? top : Array.isArray(wrapped) ? wrapped : []
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.container {
  padding: 0;
  .hint {
    text-align: center;
    padding: 60rpx;
    color: #909399;
  }
  .search-bar {
    padding: 16rpx 24rpx 0;
    background: #fff;
  }
  .batch-entry {
    padding: 12rpx 24rpx;
    display: flex;
    justify-content: flex-end;
  }
  .batch-bar {
    display: flex;
    align-items: center;
    gap: 16rpx;
    padding: 16rpx 24rpx;
    background: #f5f7fa;
    .batch-info {
      flex: 1;
      font-size: 26rpx;
      color: #606266;
    }
  }
  .check {
    width: 40rpx;
    height: 40rpx;
    border-radius: 8rpx;
    border: 2rpx solid #ccc;
    margin-top: 6rpx;
  }
  .check.on {
    border-color: #2979ff;
    background: #2979ff;
  }
  .list {
    padding: 16rpx 24rpx 24rpx;
    .list-item {
      display: flex;
      align-items: stretch;
      background-color: #fff;
      border-radius: 12rpx;
      padding: 24rpx;
      margin-bottom: 24rpx;
      box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
      .check-wrap {
        padding-right: 16rpx;
        display: flex;
        align-items: flex-start;
      }
      .card-main {
        flex: 1;
        min-width: 0;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16rpx;
        flex-wrap: wrap;
        gap: 8rpx;
        .title {
          font-size: 28rpx;
          font-weight: bold;
          color: #333;
          font-family: monospace;
          flex: 1;
          min-width: 0;
        }
      }
      .content {
        .desc {
          font-size: 28rpx;
          color: #666;
          margin-bottom: 8rpx;
          .price {
            color: #e43d33;
            font-weight: bold;
          }
        }
      }
    }
  }
}
</style>
