<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { get, resolveMediaUrl } from '@/api/request'

interface LinkedDevice {
  id: number
  code: string
  name: string
  type: string
  location: string
  status: string
}

interface CheckItem {
  name: string
  nfcTagId: number
  tagId: string
  location: string
  linkedDevices?: LinkedDevice[]
  pointImages?: string[]
}

const loading = ref(true)
const err = ref('')
const taskId = ref(0)
/** 路由上的任务 id 字符串，供 onShow 再次请求（从执行页返回时 onLoad 不会重跑） */
const detailIdParam = ref('')
type TaskRecordRef = { id: number; tagId: string; status: string }

const detail = ref<{
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  buildingName: string | null
  canExecute: boolean
  checkItems: CheckItem[]
  progress: { total: number; done: number }
  doneTagIds: string[]
  taskRecords: TaskRecordRef[]
} | null>(null)

/** 查看某巡检点下的关联设备 */
const deviceSheet = ref<{ title: string; devices: LinkedDevice[] } | null>(null)

function isDeviceInspectionType(t: string) {
  const s = (t || '').trim()
  return s === '设备' || s.startsWith('设备')
}

function deviceCount(c: CheckItem) {
  return c.linkedDevices?.length ?? 0
}

function openDevices(c: CheckItem) {
  const n = deviceCount(c)
  if (n === 0) return
  deviceSheet.value = { title: c.name, devices: c.linkedDevices ?? [] }
}

function closeDevices() {
  deviceSheet.value = null
}

function pointThumbs(c: CheckItem) {
  const arr = c.pointImages ?? []
  return arr.slice(0, 2)
}

function normTag(s: string) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '')
}

/** 是否已有该 NFC 的巡检记录（与 PC 端 doneSet 规则一致） */
function isPointDone(c: CheckItem) {
  const ids = detail.value?.doneTagIds
  if (!c.tagId || !ids?.length) return false
  const n = normTag(c.tagId)
  return ids.some((id) => normTag(id) === n)
}

/** 该巡检点对应的打卡记录（用于跳转详情；status 为 normal / abnormal） */
function pointRecord(c: CheckItem) {
  const list = detail.value?.taskRecords
  if (!list?.length || !c.tagId) return null
  return list.find((r) => normTag(r.tagId) === normTag(c.tagId)) ?? null
}

function goRecordDetail(recordId: number) {
  uni.navigateTo({ url: `/pages/inspection-tasks/record-detail?id=${recordId}` })
}

function previewPointImages(c: CheckItem, startIndex: number) {
  const urls = (c.pointImages ?? []).map((u) => resolveMediaUrl(u))
  if (urls.length === 0) return
  const i = Math.min(Math.max(0, startIndex), urls.length - 1)
  uni.previewImage({
    current: urls[i],
    urls,
  })
}

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少任务 ID'
    loading.value = false
    return
  }
  detailIdParam.value = id
  const n = parseInt(id, 10)
  taskId.value = Number.isNaN(n) ? 0 : n
})

/** 每次页面显示都拉最新详情（含从「执行巡检」navigateBack 返回） */
onShow(() => {
  if (!detailIdParam.value) return
  void load(detailIdParam.value)
})

async function load(id: string) {
  const firstPaint = detail.value == null
  if (firstPaint) {
    loading.value = true
  }
  err.value = ''
  try {
    const res = (await get(`/api/mp/inspection-tasks/${id}`)) as {
      success?: boolean
      data?: typeof detail.value
      message?: string
    }
    if (res.success && res.data) {
      detail.value = {
        ...res.data,
        taskRecords: Array.isArray((res.data as { taskRecords?: TaskRecordRef[] }).taskRecords)
          ? (res.data as { taskRecords: TaskRecordRef[] }).taskRecords
          : [],
        checkItems: (res.data.checkItems || []).map((c) => ({
          ...c,
          linkedDevices: Array.isArray(c.linkedDevices) ? c.linkedDevices : [],
          pointImages: Array.isArray(c.pointImages) ? c.pointImages : [],
        })),
      }
    } else {
      err.value = res.message || '加载失败'
      if (firstPaint) detail.value = null
    }
  } catch {
    err.value = '网络错误'
    if (firstPaint) detail.value = null
  } finally {
    if (firstPaint) loading.value = false
  }
}

function goExecute() {
  if (!taskId.value) return
  uni.navigateTo({ url: `/pages/inspection-tasks/execute?id=${taskId.value}` })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="detail" class="card">
      <text class="code">{{ detail.code }}</text>
      <text class="name">{{ detail.planName }}</text>
      <view class="row">
        <text class="k">类型</text>
        <text class="v">{{ detail.inspectionType }}</text>
      </view>
      <view class="row">
        <text class="k">楼宇</text>
        <text class="v">{{ detail.buildingName || '—' }}</text>
      </view>
      <view class="row">
        <text class="k">计划日期</text>
        <text class="v">{{ detail.scheduledDate?.slice(0, 10) }}</text>
      </view>
      <view class="row">
        <text class="k">状态</text>
        <text class="v status">{{ detail.status }}</text>
      </view>
      <view class="row">
        <text class="k">进度</text>
        <text class="v">{{ detail.progress.done }} / {{ detail.progress.total }}</text>
      </view>
      <view class="section-title">
        {{ isDeviceInspectionType(detail.inspectionType) ? '巡检点与关联设备' : '检查项与 NFC' }}
      </view>
      <view v-for="(c, i) in detail.checkItems" :key="i" class="item-row">
        <text class="dot" :class="{ done: isPointDone(c) }" />
        <view class="item-main">
          <view class="item-body">
            <text class="item-name">{{ c.name }}</text>
            <text class="item-sub">NFC {{ c.tagId }} · {{ c.location || '—' }}</text>
            <view
              v-if="isDeviceInspectionType(detail.inspectionType)"
              class="dev-line"
              @click="openDevices(c)"
            >
              <text v-if="deviceCount(c) > 0" class="dev-link">关联设备 {{ deviceCount(c) }} 台 · 点击查看</text>
              <text v-else class="dev-none">本点未绑定设备</text>
            </view>
          </view>
          <view class="item-aside">
            <button
              v-if="pointRecord(c)"
              class="pt-record-btn"
              :class="pointRecord(c)!.status === 'abnormal' ? 'abn' : 'ok'"
              @click="goRecordDetail(pointRecord(c)!.id)"
            >
              {{ pointRecord(c)!.status === 'abnormal' ? '异常' : '正常' }}
            </button>
            <text v-else-if="isPointDone(c)" class="pt-status done">已巡检</text>
            <text v-else class="pt-status pending">待巡检</text>
            <view v-if="pointThumbs(c).length > 0" class="item-thumbs">
              <image
                v-for="(u, ti) in pointThumbs(c)"
                :key="ti"
                class="thumb"
                :src="resolveMediaUrl(u)"
                mode="aspectFill"
                @click.stop="previewPointImages(c, ti)"
              />
            </view>
          </view>
        </view>
      </view>
      <button
        v-if="detail.canExecute && detail.status !== '已完成'"
        class="btn"
        type="primary"
        @click="goExecute"
      >
        执行巡检
      </button>
      <view v-else-if="!detail.canExecute" class="hint small">您不在该任务的巡检人员列表中</view>
    </view>

    <view v-if="deviceSheet" class="mask" @click="closeDevices">
      <view class="sheet" @click.stop>
        <view class="sheet-head">
          <text class="sheet-title">关联设备</text>
          <text class="sheet-sub">{{ deviceSheet.title }}</text>
        </view>
        <scroll-view scroll-y class="sheet-scroll">
          <view v-for="d in deviceSheet.devices" :key="d.id" class="dev-card">
            <text class="dev-name">{{ d.name }}</text>
            <text class="dev-code">{{ d.code }}</text>
            <text class="dev-meta">{{ d.type }}{{ d.location ? ' · ' + d.location : '' }}</text>
          </view>
        </scroll-view>
        <button class="sheet-close" @click="closeDevices">关闭</button>
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
.hint {
  text-align: center;
  color: $pms-text-muted;
  padding: 48rpx;
  &.small {
    font-size: 24rpx;
    padding: 24rpx 0 0;
  }
}
.card {
  @include pms-card;
  padding: 32rpx;
}
.code {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  font-family: monospace;
}
.name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $pms-text;
  margin: 16rpx 0 24rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  font-size: 26rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}
.k {
  color: $pms-text-muted;
}
.v {
  color: $pms-text;
}
.status {
  color: $pms-accent;
}
.section-title {
  margin-top: 32rpx;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-text;
}
.item-row {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
  align-items: flex-start;
}
.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
}
.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-top: 10rpx;
  background: $pms-text-dim;
  &.done {
    background: $pms-accent;
  }
}
.item-body {
  flex: 1;
  min-width: 0;
}
.item-aside {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
}
.pt-record-btn {
  font-size: 22rpx;
  font-weight: 600;
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  color: #fff;
  border: none;
  margin: 0;
  line-height: 1.3;
  &::after {
    border: none;
  }
  &.ok {
    background: #16a34a;
  }
  &.abn {
    background: #dc2626;
  }
}
.pt-status {
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  &.pending {
    color: $pms-text-muted;
    background: rgba(255, 255, 255, 0.08);
  }
  &.done {
    color: #34d399;
    background: rgba(52, 211, 153, 0.15);
  }
}
.item-thumbs {
  flex-shrink: 0;
  display: flex;
  gap: 8rpx;
}
.thumb {
  width: 112rpx;
  height: 112rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.06);
}
.item-name {
  display: block;
  font-size: 28rpx;
  color: $pms-text;
}
.item-sub {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-top: 8rpx;
}
.dev-line {
  margin-top: 12rpx;
}
.dev-link {
  font-size: 24rpx;
  color: $pms-accent;
}
.dev-none {
  font-size: 24rpx;
  color: $pms-text-muted;
}
.btn {
  margin-top: 40rpx;
  background: $pms-accent !important;
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
}
.sheet {
  width: 100%;
  max-height: 70vh;
  background: #1e293b;
  border-radius: 24rpx 24rpx 0 0;
  padding: 28rpx;
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.sheet-head {
  margin-bottom: 20rpx;
}
.sheet-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
}
.sheet-sub {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-top: 8rpx;
}
.sheet-scroll {
  max-height: 46vh;
}
.dev-card {
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}
.dev-name {
  display: block;
  font-size: 28rpx;
  color: $pms-text;
  font-weight: 500;
}
.dev-code {
  display: block;
  font-size: 22rpx;
  font-family: monospace;
  color: $pms-text-muted;
  margin-top: 6rpx;
}
.dev-meta {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-top: 4rpx;
}
.sheet-close {
  margin-top: 24rpx;
  background: $pms-accent !important;
  color: #fff;
  font-size: 28rpx;
}
</style>
