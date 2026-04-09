<template>
  <view class="container">
    <u-tabs :list="tabs" :current="current" @click="handleTabClick"></u-tabs>
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else class="list">
      <view v-for="item in records" :key="item.id" class="list-item" @tap="goToDetail(item.id)">
        <view class="header">
          <text class="title">{{ item.planName || item.code }}</text>
          <u-tag :text="item.status" :type="tagType(item.status)" size="mini"></u-tag>
        </view>
        <view class="content">
          <view class="desc">楼宇：{{ item.buildingName || '—' }}</view>
          <view class="desc">类型：{{ item.inspectionType }}</view>
          <view class="time">计划时间：{{ formatTime(item.scheduledDate) }}</view>
        </view>
      </view>
      <u-empty v-if="records.length === 0" mode="list" text="暂无记录" margin-top="100"></u-empty>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { openPage } from '../../utils/navigate.js'
import { formatDateTime } from '../../utils/datetime.js'

/** 与 pms-staff 巡检任务筛选一致 */
const STATUS_MAP = ['', '待执行', '巡检中', '已完成']
const tabs = ref([{ name: '全部' }, { name: '待执行' }, { name: '巡检中' }, { name: '已完成' }])
const current = ref(0)
const loading = ref(true)
const records = ref([])

async function loadList() {
  loading.value = true
  try {
    const params = {}
    const status = STATUS_MAP[current.value]
    if (status) params.status = status
    const res = await get('/api/mp/inspection-tasks', params)
    records.value = res.success && res.data && Array.isArray(res.data.list) ? res.data.list : []
  } catch (e) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' })
    records.value = []
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
  const readonly = current.value === 3
  openPage('/pages/inspection/detail?id=' + id + (readonly ? '&readonly=true' : ''))
}

function formatTime(v) {
  return formatDateTime(v, '')
}

function tagType(status) {
  if (status === '已完成') return 'success'
  if (status === '巡检中') return 'primary'
  return 'warning'
}
</script>

<style lang="scss" scoped>
.container {
  padding: 0;
  min-height: 100vh;
  background: #f5f6f7;
  .hint {
    text-align: center;
    padding: 40rpx;
    color: #909399;
  }
  .list {
    padding: 24rpx;
    .list-item {
      background-color: #fff;
      border-radius: 12rpx;
      padding: 24rpx;
      margin-bottom: 24rpx;
      box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16rpx;
        .title {
          font-size: 32rpx;
          font-weight: bold;
          color: #333;
        }
      }
      .content {
        .desc {
          font-size: 28rpx;
          color: #666;
          margin-bottom: 10rpx;
        }
        .time {
          font-size: 24rpx;
          color: #999;
          margin-top: 16rpx;
        }
      }
    }
  }
}
</style>
