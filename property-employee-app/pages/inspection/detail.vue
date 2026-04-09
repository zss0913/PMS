<template>
  <view class="container">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="detail" class="task-wrap">
      <view class="task-info">
        <view class="title">{{ detail.planName }}</view>
        <view class="desc">计划时间：{{ formatTime(detail.scheduledDate) }}</view>
        <view class="desc">巡检路线：{{ detail.route || detail.checkItems.map((item) => item.name).join(' -> ') || '—' }}</view>
        <view class="desc">状态：{{ detail.status }}</view>
        <view class="desc">进度：{{ detail.progress.done }} / {{ detail.progress.total }}</view>
        <view class="action" v-if="detail.canExecute && !readonly && detail.status !== '已完成'">
          <u-button type="primary" text="开始巡检 / NFC感应" @click="goExecute"></u-button>
        </view>
      </view>

      <view class="checkpoints">
        <view class="section-title">检查项目</view>
        <view v-for="(item, index) in detail.checkItems" :key="index" class="point-item">
          <view class="point-header">
            <view class="left">
              <text class="point-name">{{ item.name }} ({{ item.location || '—' }})</text>
              <text class="point-tag">NFC：{{ item.tagId || '—' }}</text>
            </view>
            <u-tag :text="detail.doneTagIds.includes(item.tagId) ? '已感应' : '未感应'" :type="detail.doneTagIds.includes(item.tagId) ? 'success' : 'info'" size="mini"></u-tag>
          </view>
          <view class="point-body" v-if="!readonly && detail.canExecute && detail.status !== '已完成'">
            <u-button type="primary" plain size="small" text="去巡检" @click="goExecute"></u-button>
            <u-button type="error" plain size="small" text="异常上报" @click="reportAbnormal(item)"></u-button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { openPage } from '../../utils/navigate.js'
import { formatDateTime } from '../../utils/datetime.js'

const loading = ref(true)
const err = ref('')
const taskId = ref(0)
const readonly = ref(false)
const detail = ref(null)

onLoad((q) => {
  const id = q.id
  readonly.value = String(q.readonly || '') === 'true'
  if (!id) {
    err.value = '缺少任务 ID'
    loading.value = false
    return
  }
  taskId.value = parseInt(id, 10)
  void load(id)
})

async function load(id) {
  loading.value = true
  err.value = ''
  try {
    const res = await get(`/api/mp/inspection-tasks/${id}`)
    if (res.success && res.data) {
      detail.value = res.data
    } else {
      err.value = res.message || '加载失败'
    }
  } catch (e) {
    err.value = e?.message || '网络错误'
  } finally {
    loading.value = false
  }
}

function goExecute() {
  if (!taskId.value) return
  openPage(`/pages/inspection/execute?id=${taskId.value}`)
}

function reportAbnormal(item) {
  openPage(
    '/pages/inspection/report?id=' +
      taskId.value +
      '&tagId=' +
      encodeURIComponent(item.tagId || '') +
      '&name=' +
      encodeURIComponent(item.name || '')
  )
}

function formatTime(v) {
  return formatDateTime(v, '')
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  .hint {
    text-align: center;
    padding: 60rpx 24rpx;
    color: #909399;
  }
  .task-info {
    background-color: #fff;
    padding: 30rpx;
    border-radius: 12rpx;
    margin-bottom: 24rpx;
    .title {
      font-size: 34rpx;
      font-weight: bold;
      margin-bottom: 16rpx;
    }
    .desc {
      font-size: 28rpx;
      color: #666;
      margin-bottom: 10rpx;
      line-height: 1.6;
    }
    .action {
      margin-top: 30rpx;
    }
  }

  .section-title {
    font-size: 32rpx;
    font-weight: bold;
    margin: 30rpx 0 20rpx 10rpx;
  }

  .point-item {
    background-color: #fff;
    padding: 24rpx;
    border-radius: 12rpx;
    margin-bottom: 20rpx;
    .point-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20rpx;
      .left {
        flex: 1;
      }
      .point-name {
        font-size: 30rpx;
        font-weight: 500;
        display: block;
      }
      .point-tag {
        display: block;
        margin-top: 8rpx;
        font-size: 24rpx;
        color: #909399;
      }
    }
    .point-body {
      margin-top: 24rpx;
      padding-top: 20rpx;
      border-top: 1rpx dashed #eee;
      display: flex;
      justify-content: flex-end;
      gap: 16rpx;
    }
  }
}
</style>
