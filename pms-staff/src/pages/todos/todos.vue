<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'

interface TodoItem {
  id: number
  code: string
  title: string
  type: string
  status: string
}

type TabKey = 'orders' | 'inspection' | 'complaints'

const workOrders = ref<TodoItem[]>([])
const inspectionTasks = ref<TodoItem[]>([])
const complaints = ref<TodoItem[]>([])
const loading = ref(true)
const activeTab = ref<TabKey>('orders')

/** 从详情页返回时需重新拉取，否则办结后仍显示旧状态 */
async function loadTodos(silent: boolean) {
  if (!silent) {
    loading.value = true
  }
  try {
    const res = await get<{
      workOrders: TodoItem[]
      inspectionTasks: TodoItem[]
      complaints: TodoItem[]
    }>('/api/mp/my-todos')
    if (res.success && res.data) {
      workOrders.value = res.data.workOrders || []
      inspectionTasks.value = res.data.inspectionTasks || []
      complaints.value = res.data.complaints || []
      if (workOrders.value.length === 0) {
        if (complaints.value.length > 0) activeTab.value = 'complaints'
        else if (inspectionTasks.value.length > 0) activeTab.value = 'inspection'
      }
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onShow(() => {
  const hasData =
    workOrders.value.length > 0 ||
    inspectionTasks.value.length > 0 ||
    complaints.value.length > 0
  void loadTodos(hasData)
})

function setTab(key: TabKey) {
  activeTab.value = key
}

function goWorkOrderDetail(id: number) {
  uni.navigateTo({ url: `/pages/work-orders/detail?id=${id}` })
}

function goComplaintDetail(id: number) {
  uni.navigateTo({ url: `/pages/complaints/detail?id=${id}` })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else class="shell">
      <scroll-view scroll-x class="tabs-scroll" :show-scrollbar="false">
        <view class="tabs-row">
          <view
            class="tab"
            :class="{ active: activeTab === 'orders' }"
            @click="setTab('orders')"
          >
            <text class="tab-label">工单</text>
            <text v-if="workOrders.length > 0" class="badge">{{ workOrders.length }}</text>
          </view>
          <view
            class="tab"
            :class="{ active: activeTab === 'inspection' }"
            @click="setTab('inspection')"
          >
            <text class="tab-label">巡检</text>
            <text v-if="inspectionTasks.length > 0" class="badge">{{ inspectionTasks.length }}</text>
          </view>
          <view
            class="tab"
            :class="{ active: activeTab === 'complaints' }"
            @click="setTab('complaints')"
          >
            <text class="tab-label">卫生吐槽</text>
            <text v-if="complaints.length > 0" class="badge">{{ complaints.length }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="list-region">
        <template v-if="activeTab === 'orders'">
          <view v-if="workOrders.length === 0" class="empty">暂无待处理工单</view>
          <view
            v-for="item in workOrders"
            v-else
            :key="'wo-' + item.id"
            class="card tappable"
            @click="goWorkOrderDetail(item.id)"
          >
            <view class="title">{{ item.title }}</view>
            <view class="meta">{{ item.code }} · {{ item.status }}</view>
          </view>
        </template>
        <template v-else-if="activeTab === 'inspection'">
          <view v-if="inspectionTasks.length === 0" class="empty">暂无巡检任务</view>
          <view v-for="item in inspectionTasks" v-else :key="'it-' + item.id" class="card">
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
            class="card tappable"
            @click="goComplaintDetail(item.id)"
          >
            <view class="title-row">
              <text class="code">{{ item.code }}</text>
              <text class="st">{{ item.status }}</text>
            </view>
            <view class="title body-text">{{ item.title }}</view>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  background: $pms-bg;
  display: flex;
  flex-direction: column;
}

.loading {
  text-align: center;
  padding: 100rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tabs-scroll {
  flex-shrink: 0;
  width: 100%;
  white-space: nowrap;
  border-bottom: 1rpx solid $pms-border;
  background: $pms-bg;
}

.tabs-row {
  display: inline-flex;
  flex-direction: row;
  gap: 12rpx;
  padding: 20rpx 24rpx 16rpx;
}

.tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 20rpx 28rpx;
  border-radius: 16rpx;
  background: $pms-surface;
  border: 1rpx solid $pms-border;
  @include pms-tap;
}

.tab.active {
  background: $pms-accent-soft;
  border-color: rgba(34, 197, 94, 0.45);
  box-shadow: 0 0 0 2rpx rgba(34, 197, 94, 0.2);
}

.tab-label {
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-text-muted;
}

.tab.active .tab-label {
  color: $pms-text;
}

.badge {
  min-width: 36rpx;
  padding: 0 10rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  font-size: 22rpx;
  font-weight: 700;
  color: $pms-bg-deep;
  background: $pms-accent;
  border-radius: 999rpx;
}

.list-region {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 24rpx;
  box-sizing: border-box;
}

.empty {
  text-align: center;
  padding: 80rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.card {
  @include pms-card;
  padding: 32rpx;
  margin-bottom: 24rpx;
}

.card.tappable {
  @include pms-tap;
}

.title {
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
  margin-bottom: 12rpx;
}

.body-text {
  font-weight: 400;
  line-height: 1.45;
}

.meta {
  font-size: 24rpx;
  color: $pms-text-muted;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.code {
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-text;
}

.st {
  font-size: 24rpx;
  color: $pms-accent;
}
</style>
