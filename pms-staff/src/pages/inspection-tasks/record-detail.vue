<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, resolveMediaUrl } from '@/api/request'

type Parsed =
  | { kind: 'empty' }
  | { kind: 'raw'; text: string }
  | { kind: 'normal'; remark?: string; images: string[] }
  | {
      kind: 'abnormal'
      pointName?: string
      description: string
      severity?: string
      images: string[]
      remark?: string
      submitWorkOrder: boolean
    }

type RecordDto = {
  id: number
  taskCode: string
  planName: string | null
  buildingName: string | null
  inspectionType: string
  tagId: string
  location: string
  checkedAt: string
  checkedByName: string
  status: string
  parsed: Parsed
  severityLabel: string | null
  linkedWorkOrder?: { id: number; code: string } | null
}

const loading = ref(true)
const err = ref('')
const data = ref<RecordDto | null>(null)

function formatDt(s: string) {
  try {
    return new Date(s).toLocaleString('zh-CN')
  } catch {
    return s
  }
}

function statusText(s: string) {
  return s === 'abnormal' ? '异常' : s === 'normal' ? '正常' : s
}

function previewImages(urls: string[], index: number) {
  const resolved = urls.map((u) => resolveMediaUrl(u))
  if (resolved.length === 0) return
  const i = Math.min(Math.max(0, index), resolved.length - 1)
  uni.previewImage({ current: resolved[i], urls: resolved })
}

function goWorkOrder(id: number) {
  if (!id) return
  uni.navigateTo({ url: `/pages/work-orders/detail?id=${id}` })
}

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少记录 ID'
    loading.value = false
    return
  }
  void load(id)
})

async function load(id: string) {
  loading.value = true
  err.value = ''
  try {
    const res = (await get(`/api/mp/inspection-records/${id}`)) as {
      success?: boolean
      data?: RecordDto
      message?: string
    }
    if (res.success && res.data) {
      data.value = res.data
    } else {
      err.value = res.message || '加载失败'
      data.value = null
    }
  } catch {
    err.value = '网络错误'
    data.value = null
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="data" class="card">
      <text class="title">巡检记录详情</text>
      <view class="badge-row">
        <text
          class="badge"
          :class="data.status === 'abnormal' ? 'abn' : 'ok'"
        >
          {{ statusText(data.status) }}
        </text>
      </view>

      <view class="row">
        <text class="k">任务编号</text>
        <text class="v mono">{{ data.taskCode }}</text>
      </view>
      <view class="row">
        <text class="k">计划</text>
        <text class="v">{{ data.planName || '—' }}</text>
      </view>
      <view class="row">
        <text class="k">楼宇</text>
        <text class="v">{{ data.buildingName || '—' }}</text>
      </view>
      <view class="row">
        <text class="k">巡检类型</text>
        <text class="v">{{ data.inspectionType }}</text>
      </view>
      <view class="row">
        <text class="k">NFC</text>
        <text class="v mono">{{ data.tagId }}</text>
      </view>
      <view class="row">
        <text class="k">位置</text>
        <text class="v">{{ data.location }}</text>
      </view>
      <view class="row">
        <text class="k">检查时间</text>
        <text class="v">{{ formatDt(data.checkedAt) }}</text>
      </view>
      <view class="row">
        <text class="k">检查人</text>
        <text class="v">{{ data.checkedByName }}</text>
      </view>

      <view class="section">现场填报</view>

      <template v-if="data.parsed.kind === 'empty'">
        <text class="muted">暂无附加信息</text>
      </template>

      <template v-else-if="data.parsed.kind === 'raw'">
        <text class="pre">{{ data.parsed.text }}</text>
      </template>

      <template v-else-if="data.parsed.kind === 'normal'">
        <view v-if="data.parsed.remark" class="block">
          <text class="bk">情况说明</text>
          <text class="bv">{{ data.parsed.remark }}</text>
        </view>
        <view class="block">
          <text class="bk">现场照片</text>
          <view v-if="data.parsed.images.length" class="thumbs">
            <image
              v-for="(u, i) in data.parsed.images"
              :key="i"
              class="thumb"
              :src="resolveMediaUrl(u)"
              mode="aspectFill"
              @click="previewImages(data.parsed.images, i)"
            />
          </view>
          <text v-else class="muted">无</text>
        </view>
      </template>

      <template v-else-if="data.parsed.kind === 'abnormal'">
        <view v-if="data.parsed.pointName" class="block">
          <text class="bk">巡检点名称</text>
          <text class="bv">{{ data.parsed.pointName }}</text>
        </view>
        <view class="block">
          <text class="bk">异常说明</text>
          <text class="bv">{{ data.parsed.description || '—' }}</text>
        </view>
        <view v-if="data.severityLabel" class="block">
          <text class="bk">紧急程度</text>
          <text class="bv">{{ data.severityLabel }}</text>
        </view>
        <view class="block">
          <text class="bk">生成工单</text>
          <view v-if="data.linkedWorkOrder" class="wo-yes-row">
            <text class="bv">是</text>
            <text class="wo-link" @click="goWorkOrder(data.linkedWorkOrder.id)">{{
              data.linkedWorkOrder.code
            }}</text>
          </view>
          <text v-else-if="data.parsed.submitWorkOrder" class="bv">是</text>
          <text v-else class="bv">否</text>
        </view>
        <view v-if="data.parsed.remark" class="block">
          <text class="bk">补充说明</text>
          <text class="bv">{{ data.parsed.remark }}</text>
        </view>
        <view class="block">
          <text class="bk">现场照片</text>
          <view v-if="data.parsed.images.length" class="thumbs">
            <image
              v-for="(u, i) in data.parsed.images"
              :key="i"
              class="thumb"
              :src="resolveMediaUrl(u)"
              mode="aspectFill"
              @click="previewImages(data.parsed.images, i)"
            />
          </view>
          <text v-else class="muted">无</text>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.hint {
  text-align: center;
  color: $pms-text-muted;
  padding: 48rpx;
}
.card {
  @include pms-card;
  padding: 32rpx;
}
.title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $pms-text;
}
.badge-row {
  margin: 20rpx 0 28rpx;
}
.badge {
  display: inline-block;
  font-size: 24rpx;
  font-weight: 600;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  color: #fff;
  &.ok {
    background: #16a34a;
  }
  &.abn {
    background: #dc2626;
  }
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
  padding: 14rpx 0;
  font-size: 26rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}
.k {
  color: $pms-text-muted;
  flex-shrink: 0;
}
.v {
  color: $pms-text;
  text-align: right;
  word-break: break-all;
  &.mono {
    font-family: monospace;
    font-size: 22rpx;
  }
}
.section {
  margin-top: 28rpx;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-text;
}
.block {
  margin-bottom: 20rpx;
}
.bk {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 8rpx;
}
.bv {
  display: block;
  font-size: 26rpx;
  color: $pms-text;
  white-space: pre-wrap;
  word-break: break-word;
}
.muted {
  font-size: 24rpx;
  color: $pms-text-muted;
}
.pre {
  font-size: 22rpx;
  color: $pms-text-muted;
  white-space: pre-wrap;
  word-break: break-all;
}
.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.thumb {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.06);
}
.wo-yes-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12rpx;
}
.wo-link {
  font-size: 26rpx;
  font-family: monospace;
  color: $pms-accent;
  text-decoration: underline;
}
</style>
