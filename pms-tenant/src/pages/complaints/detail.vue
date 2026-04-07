<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/api/request'
import { resolveMediaUrl, isMediaVideoUrl } from '@/api/work-order-upload'

/** 与业务状态对应：末步对外展示「处理完成」（库内为「已处理」） */
const STEP_LABELS = ['待处理', '处理中', '处理完成'] as const

type ActivityLogItem = {
  id: number
  action: string
  summary: string
  operatorType: string
  operatorName: string | null
  createdAt: string
}

const loading = ref(true)
const err = ref('')
const d = ref<{
  status: string
  buildingName: string
  tenantName: string
  location: string
  description: string
  images: string[]
  result: string | null
  resultImages: string[]
  createdAt: string
  handledAt: string | null
  activityLogs?: ActivityLogItem[]
} | null>(null)

function getComplaintFlowActiveIndex(status: string): number {
  const s = (status || '').trim()
  if (s === '待处理') return 0
  if (s === '处理中') return 1
  if (s === '已处理') return 2
  return 0
}

const flowState = computed(() =>
  d.value ? { activeIndex: getComplaintFlowActiveIndex(d.value.status) } : { activeIndex: 0 }
)

function formatLogTime(iso: string) {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 19)
}

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少 ID'
    loading.value = false
    return
  }
  void load(id)
})

async function load(id: string) {
  loading.value = true
  err.value = ''
  try {
    const res = (await get(`/api/mp/complaints/${id}`)) as {
      success?: boolean
      data?: typeof d.value
      message?: string
    }
    if (res.success && res.data) {
      d.value = res.data
    } else {
      err.value = res.message || '加载失败'
    }
  } catch {
    err.value = '网络错误'
  } finally {
    loading.value = false
  }
}

/** 全屏预览（图片+视频混排，支持左右滑动；替代仅支持图片的 uni.previewImage） */
const previewVisible = ref(false)
const previewUrls = ref<string[]>([])
const previewCurrent = ref(0)
/** 每次打开递增，强制 swiper 重置到指定 current（避免仅换 index 不生效） */
const previewKey = ref(0)

async function openMediaPreview(urls: string[] | undefined, index: number) {
  const list = (urls || []).filter(Boolean)
  if (!list.length) return
  previewUrls.value = list
  previewCurrent.value = Math.min(Math.max(0, index), list.length - 1)
  previewKey.value += 1
  previewVisible.value = true
  await nextTick()
}

function closeMediaPreview() {
  previewVisible.value = false
  previewUrls.value.forEach((u, i) => {
    if (isMediaVideoUrl(u)) {
      try {
        uni.createVideoContext(`complaint-preview-v-${i}`).pause()
      } catch {
        /* noop */
      }
    }
  })
}

function onPreviewSwiperChange(e: { detail?: { current?: number } }) {
  const cur = e.detail?.current ?? 0
  const prev = previewCurrent.value
  previewCurrent.value = cur
  if (prev !== cur && previewUrls.value[prev] && isMediaVideoUrl(previewUrls.value[prev])) {
    try {
      uni.createVideoContext(`complaint-preview-v-${prev}`).pause()
    } catch {
      /* noop */
    }
  }
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="d" class="card">
      <!-- 进度：当前及之前高亮，之后灰色（与工单详情一致） -->
      <view class="flow-block">
        <text class="flow-title">进度</text>
        <scroll-view scroll-x class="flow-scroll" :show-scrollbar="false" :enable-flex="true">
          <view class="flow-row">
            <template v-for="(label, i) in STEP_LABELS" :key="label">
              <view class="flow-seg">
                <view class="flow-node-col">
                  <view
                    class="flow-node"
                    :class="{ 'flow-node--on': i <= flowState.activeIndex }"
                  >
                    <text class="flow-node-num">{{ i + 1 }}</text>
                  </view>
                  <text
                    class="flow-label"
                    :class="{ 'flow-label--on': i <= flowState.activeIndex }"
                  >
                    {{ label }}
                  </text>
                </view>
                <view
                  v-if="i < STEP_LABELS.length - 1"
                  class="flow-line"
                  :class="{ 'flow-line--on': i < flowState.activeIndex }"
                />
              </view>
            </template>
          </view>
        </scroll-view>
      </view>

      <view class="row">
        <text class="k">楼宇</text>
        <text class="v">{{ d.buildingName }}</text>
      </view>
      <view class="row">
        <text class="k">租客</text>
        <text class="v">{{ d.tenantName }}</text>
      </view>
      <view class="row">
        <text class="k">提交时间</text>
        <text class="v">{{ d.createdAt?.replace('T', ' ').slice(0, 19) }}</text>
      </view>
      <view class="block">
        <text class="label">说明</text>
        <text class="body">{{ d.description }}</text>
      </view>
      <view v-if="d.images?.length" class="block">
        <text class="label">附图</text>
        <view class="pics">
          <template v-for="(u, i) in d.images" :key="i">
            <view class="pic-touch" @tap="openMediaPreview(d.images, i)">
              <video
                v-if="isMediaVideoUrl(u)"
                :id="'list-attach-v-' + i"
                :src="resolveMediaUrl(u)"
                class="pic pic-video pic-video--list"
                muted
                :show-center-play-btn="true"
                :controls="false"
              />
              <image
                v-else
                :src="resolveMediaUrl(u)"
                mode="widthFix"
                class="pic"
              />
            </view>
          </template>
        </view>
      </view>
      <view v-if="d.result" class="block">
        <text class="label">处理结果</text>
        <text class="body">{{ d.result }}</text>
        <text v-if="d.handledAt" class="sub">处理时间 {{ d.handledAt?.replace('T', ' ').slice(0, 19) }}</text>
      </view>
      <view v-if="d.resultImages?.length" class="block">
        <text class="label">处理附图</text>
        <view class="pics">
          <template v-for="(u, i) in d.resultImages" :key="'r' + i">
            <view class="pic-touch" @tap="openMediaPreview(d.resultImages, i)">
              <video
                v-if="isMediaVideoUrl(u)"
                :id="'list-result-v-' + i"
                :src="resolveMediaUrl(u)"
                class="pic pic-video pic-video--list"
                muted
                :show-center-play-btn="true"
                :controls="false"
              />
              <image
                v-else
                :src="resolveMediaUrl(u)"
                mode="widthFix"
                class="pic"
              />
            </view>
          </template>
        </view>
      </view>

      <!-- 操作日志：时间正序，置底 -->
      <view class="block block--logs">
        <text class="label">操作日志</text>
        <view v-if="d.activityLogs?.length" class="log-list">
          <view v-for="log in d.activityLogs" :key="log.id" class="log-item">
            <view class="log-meta">
              <text class="log-time">{{ formatLogTime(log.createdAt) }}</text>
              <text class="log-action">{{ log.action }}</text>
            </view>
            <text v-if="log.operatorName" class="log-op">操作人：{{ log.operatorName }}</text>
            <text class="log-summary">{{ log.summary }}</text>
          </view>
        </view>
        <text v-else class="log-empty">暂无操作记录</text>
      </view>
    </view>

    <!-- 全屏媒体预览：swiper 左右滑，含图片与视频 -->
    <view
      v-if="previewVisible"
      class="media-preview"
      @tap.self="closeMediaPreview"
    >
      <view class="media-preview__bar">
        <text class="media-preview__count">{{ previewCurrent + 1 }} / {{ previewUrls.length }}</text>
        <view class="media-preview__close" @tap.stop="closeMediaPreview">
          <text class="media-preview__close-x">×</text>
        </view>
      </view>
      <swiper
        :key="previewKey"
        class="media-preview__swiper"
        :current="previewCurrent"
        @change="onPreviewSwiperChange"
      >
        <swiper-item
          v-for="(u, i) in previewUrls"
          :key="'pv-' + i"
          class="media-preview__item"
        >
          <view class="media-preview__inner" @tap.stop>
            <video
              v-if="isMediaVideoUrl(u)"
              :id="'complaint-preview-v-' + i"
              :src="resolveMediaUrl(u)"
              class="media-preview__video"
              controls
              :show-center-play-btn="true"
              object-fit="contain"
              playsinline
            />
            <image
              v-else
              :src="resolveMediaUrl(u)"
              mode="aspectFit"
              class="media-preview__img"
            />
          </view>
        </swiper-item>
      </swiper>
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
  padding: 80rpx;
  color: $pms-text-muted;
}
.card {
  @include pms-card;
  padding: 32rpx;
}
.flow-block {
  padding-bottom: 24rpx;
  margin-bottom: 8rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}
.flow-title {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 16rpx;
}
.flow-scroll {
  width: 100%;
}
.flow-row {
  display: inline-flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 8rpx 4rpx 4rpx;
}
.flow-seg {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}
.flow-node-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 140rpx;
  flex-shrink: 0;
}
.flow-node {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(148, 163, 184, 0.35);
  background: rgba(30, 41, 59, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}
.flow-node--on {
  border-color: rgba(56, 189, 248, 0.85);
  background: rgba(56, 189, 248, 0.25);
}
.flow-node-num {
  font-size: 24rpx;
  font-weight: 700;
  color: $pms-text-dim;
}
.flow-node--on .flow-node-num {
  color: $pms-accent;
}
.flow-label {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $pms-text-dim;
  text-align: center;
  line-height: 1.25;
  max-width: 140rpx;
}
.flow-label--on {
  color: $pms-accent;
  font-weight: 600;
}
.flow-line {
  width: 48rpx;
  height: 4rpx;
  border-radius: 4rpx;
  background: rgba(148, 163, 184, 0.25);
  margin-top: 28rpx;
  flex-shrink: 0;
}
.flow-line--on {
  background: rgba(56, 189, 248, 0.65);
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 14rpx 0;
  font-size: 28rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}
.k {
  color: $pms-text-muted;
}
.v {
  color: $pms-text;
  max-width: 65%;
  text-align: right;
}
.block {
  margin-top: 24rpx;
}
.block--logs {
  margin-top: 32rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);
}
.label {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 8rpx;
}
.body {
  font-size: 28rpx;
  color: $pms-text;
  line-height: 1.55;
}
.sub {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  margin-top: 8rpx;
}
.pics {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.pic {
  width: 100%;
  border-radius: 12rpx;
}
.pic-touch {
  width: 100%;
}
.pic-video {
  max-height: 480rpx;
  background: #000;
}
.pic-video--list {
  width: 100%;
  display: block;
}

/* 全屏预览层 */
.media-preview {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.94);
  display: flex;
  flex-direction: column;
}
.media-preview__bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  padding-top: calc(12px + env(safe-area-inset-top));
}
.media-preview__count {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.85);
}
.media-preview__close {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}
.media-preview__close-x {
  font-size: 48rpx;
  color: #fff;
  line-height: 1;
  margin-top: -4rpx;
}
.media-preview__swiper {
  flex: 1;
  width: 100%;
  min-height: 0;
}
.media-preview__item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.media-preview__inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
  box-sizing: border-box;
}
.media-preview__img {
  width: 100%;
  max-height: 100%;
}
.media-preview__video {
  width: 100%;
  max-height: 85vh;
}
.log-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.log-item {
  padding: 20rpx;
  border-radius: 12rpx;
  background: rgba(15, 23, 42, 0.55);
  border: 1rpx solid rgba(255, 255, 255, 0.06);
}
.log-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.log-time {
  font-size: 22rpx;
  color: $pms-text-dim;
}
.log-action {
  font-size: 24rpx;
  font-weight: 600;
  color: $pms-accent;
}
.log-op {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-bottom: 8rpx;
}
.log-summary {
  display: block;
  font-size: 26rpx;
  color: $pms-text;
  line-height: 1.5;
  word-break: break-all;
}
.log-empty {
  font-size: 26rpx;
  color: $pms-text-dim;
  padding: 16rpx 0;
}
</style>
