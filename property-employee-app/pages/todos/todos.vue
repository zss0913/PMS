<template>
  <view class="page">
    <u-tabs :list="tabList" :current="current" @click="onTabClick"></u-tabs>

    <view v-if="loading" class="loading">加载中…</view>
    <view v-else class="list-region">
      <template v-if="activeKind === 'orders'">
        <view v-if="workOrders.length === 0" class="empty">暂无待处理工单</view>
        <view
          v-for="item in workOrders"
          v-else
          :key="'wo-' + item.id"
          class="card"
          @tap="goWorkOrderDetail(item.id)"
        >
          <view class="title">{{ item.title }}</view>
          <view class="meta">{{ item.code }} · {{ item.status }}</view>
        </view>
      </template>
      <template v-else-if="activeKind === 'inspection'">
        <view v-if="inspectionTasks.length === 0" class="empty">暂无巡检任务</view>
        <view
          v-for="item in inspectionTasks"
          v-else
          :key="'it-' + item.id"
          class="card"
          @tap="goInspectionDetail(item.id)"
        >
          <view class="title">{{ item.code || item.title }}</view>
          <view class="meta">{{ item.status }}</view>
        </view>
      </template>
      <template v-else>
        <view v-if="complaints.length === 0" class="empty">暂无待办卫生吐槽</view>
        <view
          v-for="item in complaints"
          v-else
          :key="'cp-' + item.id"
          class="card"
          @tap="goComplaintDetail(item.id)"
        >
          <view class="title-row">
            <text class="code">{{ item.code }}</text>
            <text class="st">{{ item.status }}</text>
          </view>
          <view class="body-text">{{ item.title }}</view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { openPage } from '../../utils/navigate.js'

const workOrders = ref([])
const inspectionTasks = ref([])
const complaints = ref([])
const loading = ref(true)
const current = ref(0)

const tabList = ref([{ name: '工单' }, { name: '巡检' }, { name: '卫生吐槽' }])

const activeKind = computed(() => {
  if (current.value === 0) return 'orders'
  if (current.value === 1) return 'inspection'
  return 'complaints'
})

async function loadTodos(silent) {
  if (!silent) loading.value = true
  try {
    const res = await get('/api/mp/my-todos')
    if (res.success && res.data) {
      workOrders.value = res.data.workOrders || []
      inspectionTasks.value = res.data.inspectionTasks || []
      complaints.value = res.data.complaints || []
      if (workOrders.value.length === 0) {
        if (complaints.value.length > 0) current.value = 2
        else if (inspectionTasks.value.length > 0) current.value = 1
      }
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onLoad((q) => {
  if (q.tab === 'inspection') current.value = 1
  if (q.tab === 'complaints') current.value = 2
})

onShow(() => {
  const hasData =
    workOrders.value.length > 0 || inspectionTasks.value.length > 0 || complaints.value.length > 0
  void loadTodos(hasData)
})

function onTabClick(e) {
  current.value = e.index
}

function goWorkOrderDetail(id) {
  openPage('/pages/workorder/detail?id=' + id)
}

function goInspectionDetail(id) {
  openPage('/pages/inspection/detail?id=' + id)
}

function goComplaintDetail(id) {
  openPage('/pages/complaints/detail?id=' + id)
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f6f7;
  padding-bottom: 24rpx;
}

.loading {
  text-align: center;
  padding: 80rpx;
  color: #909399;
}

.list-region {
  padding: 24rpx;
}

.empty {
  text-align: center;
  padding: 80rpx 40rpx;
  color: #909399;
  font-size: 28rpx;
}

.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
  &:active {
    opacity: 0.92;
  }
}

.title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.meta {
  font-size: 24rpx;
  color: #909399;
}

.title-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.code {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.st {
  font-size: 24rpx;
  color: #2979ff;
}

.body-text {
  font-size: 28rpx;
  color: #666;
  line-height: 1.45;
}
</style>
