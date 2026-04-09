<template>
  <view class="container">
    <u-tabs :list="tabs" :current="current" @click="handleTabClick"></u-tabs>

    <view class="filter-bar">
      <u-checkbox-group v-model="filterSelf" placement="row" @change="loadList">
        <u-checkbox name="self" label="只看我提交的" shape="square"></u-checkbox>
      </u-checkbox-group>
    </view>

    <view class="search-bar">
      <input
        v-model="titleDraft"
        class="search-input"
        type="text"
        confirm-type="search"
        placeholder="标题关键词模糊搜索"
        @confirm="applyTitleSearch"
      />
      <button class="search-btn" @click="applyTitleSearch">搜索</button>
      <button v-if="appliedTitleQ || titleDraft" class="search-clear" @click="clearTitleSearch">清除</button>
    </view>

    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="workOrders.length === 0" class="hint">{{ emptyHint }}</view>
    <scroll-view v-else scroll-x class="table-scroll" :show-scrollbar="false">
      <view class="table">
        <view class="table-head">
          <text class="cell title">标题</text>
          <text class="cell type">类型</text>
          <text class="cell status">状态</text>
          <text class="cell time">时间</text>
        </view>
        <view v-for="item in workOrders" :key="item.id" class="table-row" @tap="goToDetail(item.id)">
          <text class="cell title ellipsis">{{ item.title }}</text>
          <text class="cell type">{{ item.type }}</text>
          <text class="cell status">{{ item.status }}</text>
          <text class="cell time">{{ formatTime(item.createdAt) }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { openPage } from '../../utils/navigate.js'
import { formatDateTime } from '../../utils/datetime.js'

const STATUS_VALUES = ['', '待派单', '待响应', '处理中', '待员工确认费用', '待租客确认费用', '待评价', '评价完成', '已取消']
const tabs = ref(STATUS_VALUES.map((name) => ({ name: name || '全部' })))
const current = ref(0)
const filterSelf = ref([])
const loading = ref(true)
const workOrders = ref([])
const titleDraft = ref('')
const appliedTitleQ = ref('')

function buildParams() {
  const params = {}
  const status = STATUS_VALUES[current.value]
  if (status) params.status = status
  if (filterSelf.value.includes('self')) params.mine = '1'
  const q = appliedTitleQ.value.trim()
  if (q) params.titleQ = q
  return params
}

async function loadList() {
  loading.value = true
  try {
    const res = await get('/api/mp/work-orders', buildParams())
    workOrders.value = res.success && Array.isArray(res.list) ? res.list : []
  } catch (e) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' })
    workOrders.value = []
  } finally {
    loading.value = false
  }
}

onShow(() => {
  void loadList()
})

const handleTabClick = (item) => {
  current.value = item.index
  void loadList()
}

const goToDetail = (id) => {
  openPage('/pages/workorder/detail?id=' + id)
}

function applyTitleSearch() {
  appliedTitleQ.value = titleDraft.value.trim()
  void loadList()
}

function clearTitleSearch() {
  titleDraft.value = ''
  appliedTitleQ.value = ''
  void loadList()
}

function formatTime(v) {
  return formatDateTime(v, '')
}

const emptyHint = computed(() => {
  const parts = []
  const st = STATUS_VALUES[current.value]
  if (st) parts.push('「' + st + '」')
  if (appliedTitleQ.value) parts.push('标题含「' + appliedTitleQ.value + '」')
  if (parts.length === 0) return '暂无数据'
  return '当前筛选下暂无工单（' + parts.join('，') + '）'
})
</script>

<style lang="scss" scoped>
.container {
  padding: 0;
  min-height: 100vh;
  background: #f5f6f7;
}

.hint {
  text-align: center;
  padding: 40rpx;
  color: #909399;
  font-size: 28rpx;
}

.filter-bar {
  padding: 20rpx 24rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
}

.search-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  background: #f5f6f7;
  border: 1rpx solid #ebeef5;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

.search-btn {
  flex-shrink: 0;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 28rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  background: #2979ff;
  color: #fff;
  border: none;
}

.search-btn::after {
  border: none;
}

.search-clear {
  flex-shrink: 0;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 20rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  background: transparent;
  color: #909399;
  border: 1rpx solid #ebeef5;
}

.search-clear::after {
  border: none;
}

.table-scroll {
  width: 100%;
  padding: 24rpx;
  box-sizing: border-box;
}

.table {
  min-width: 620rpx;
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1rpx solid #ebeef5;
}

.table-head,
.table-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.table-head {
  background: #f5f6f7;
  font-size: 24rpx;
  font-weight: 600;
  color: #909399;
}

.table-row {
  border-top: 1rpx solid #ebeef5;
  font-size: 24rpx;
  color: #333;
  &:active {
    opacity: 0.85;
  }
}

.cell {
  padding: 20rpx 16rpx;
  box-sizing: border-box;
  flex-shrink: 0;
}

.cell.title {
  width: 260rpx;
}
.cell.type {
  width: 140rpx;
}
.cell.status {
  width: 160rpx;
  color: #2979ff;
}
.cell.time {
  flex: 1;
  min-width: 220rpx;
  color: #909399;
  font-size: 22rpx;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
</style>
