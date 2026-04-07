<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, put } from '@/api/request'
import { resolveMediaUrl, uploadWorkOrderImage, isMediaVideoUrl } from '@/api/work-order-upload'

type Assignee = { id: number; name: string }

const STEP_LABELS = ['待处理', '处理中', '处理完成'] as const

type ActivityLogItem = {
  id: number
  action: string
  summary: string
  operatorType: string
  operatorName: string | null
  createdAt: string
}

type TenantRoom = { floorName: string; roomNumber: string; roomName: string }

const loading = ref(true)
const err = ref('')
const busy = ref(false)
const complaintId = ref('')

const d = ref<{
  location: string
  description: string
  status: string
  buildingName: string
  tenantName: string
  tenantRooms?: TenantRoom[]
  createdAt: string
  handledAt: string | null
  images: string[]
  result: string | null
  resultImages: string[]
  assignedTo: number | null
  assignedToName: string | null
  handledByName: string | null
  assignees?: Assignee[]
  currentUserId?: number
  activityLogs?: ActivityLogItem[]
} | null>(null)

const showAccept = ref(false)
const assigneeIndex = ref(0)

const showFinish = ref(false)
const finishResult = ref('')
const finishImages = ref<string[]>([])

const previewVisible = ref(false)
const previewUrls = ref<string[]>([])
const previewCurrent = ref(0)
const previewKey = ref(0)

const assigneeNames = computed(() => (d.value?.assignees ?? []).map((a) => a.name))

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

const canAccept = computed(() => d.value?.status === '待处理')
const canFinish = computed(() => {
  const x = d.value
  if (!x || x.status !== '处理中') return false
  if (x.assignedTo == null || x.currentUserId == null) return false
  return x.assignedTo === x.currentUserId
})

const MAX_FINISH = 12

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少 ID'
    loading.value = false
    return
  }
  complaintId.value = id
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
      d.value = {
        ...res.data,
        images: res.data.images ?? [],
        resultImages: res.data.resultImages ?? [],
        tenantRooms: res.data.tenantRooms ?? [],
        activityLogs: res.data.activityLogs ?? [],
      }
    } else {
      err.value = res.message || '加载失败'
    }
  } catch {
    err.value = '网络错误'
  } finally {
    loading.value = false
  }
}

function openAccept() {
  const list = d.value?.assignees ?? []
  if (!list.length) {
    uni.showToast({ title: '无可用处理人', icon: 'none' })
    return
  }
  assigneeIndex.value = 0
  showAccept.value = true
}

async function submitAccept() {
  const id = complaintId.value
  const list = d.value?.assignees ?? []
  const pick = list[assigneeIndex.value]
  if (!id || !pick) {
    uni.showToast({ title: '请选择处理人', icon: 'none' })
    return
  }
  busy.value = true
  try {
    const res = await put(`/api/mp/complaints/${id}`, {
      status: '处理中',
      assignedTo: pick.id,
    })
    if (res.success) {
      showAccept.value = false
      await load(id)
      uni.showToast({ title: '已受理', icon: 'success' })
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    busy.value = false
  }
}

function openFinish() {
  finishResult.value = ''
  finishImages.value = []
  showFinish.value = true
}

function openFallbackFinishPicker(remain: number) {
  uni.showActionSheet({
    itemList: ['选择图片', '选择视频'],
    success: (sheet) => {
      if (sheet.tapIndex === 0) {
        uni.chooseImage({
          count: Math.min(remain, 9),
          sizeType: ['compressed'],
          success: async (r) => {
            const paths = r.tempFilePaths || []
            uni.showLoading({ title: '上传中' })
            try {
              for (const p of paths) {
                const url = await uploadWorkOrderImage(p)
                finishImages.value = [...finishImages.value, url]
              }
            } catch {
              uni.showToast({ title: '上传失败', icon: 'none' })
            } finally {
              uni.hideLoading()
            }
          },
        })
      } else {
        uni.chooseVideo({
          compressed: true,
          maxDuration: 120,
          success: async (r) => {
            const p = r.tempFilePath
            if (!p) return
            uni.showLoading({ title: '上传中' })
            try {
              const url = await uploadWorkOrderImage(p)
              finishImages.value = [...finishImages.value, url]
            } catch {
              uni.showToast({ title: '视频上传失败', icon: 'none' })
            } finally {
              uni.hideLoading()
            }
          },
        })
      }
    },
  })
}

async function pickFinishMedia() {
  const remain = MAX_FINISH - finishImages.value.length
  if (remain <= 0) {
    uni.showToast({ title: `最多${MAX_FINISH}个文件`, icon: 'none' })
    return
  }
  const uniExt = uni as unknown as {
    chooseMedia?: (opt: {
      count: number
      mediaType: ('image' | 'video')[]
      sourceType: ('album' | 'camera')[]
      maxDuration: number
      success: (r: { tempFiles?: { tempFilePath: string }[] }) => void
      fail?: () => void
    }) => void
  }
  if (typeof uniExt.chooseMedia === 'function') {
    uniExt.chooseMedia({
      count: remain,
      mediaType: ['image', 'video'],
      sourceType: ['album', 'camera'],
      maxDuration: 120,
      success: async (res) => {
        const files = res.tempFiles || []
        uni.showLoading({ title: '上传中' })
        try {
          for (const f of files) {
            const url = await uploadWorkOrderImage(f.tempFilePath)
            finishImages.value = [...finishImages.value, url]
          }
        } catch {
          uni.showToast({ title: '上传失败', icon: 'none' })
        } finally {
          uni.hideLoading()
        }
      },
      fail: () => openFallbackFinishPicker(remain),
    })
    return
  }
  openFallbackFinishPicker(remain)
}

function removeFinishImage(i: number) {
  finishImages.value = finishImages.value.filter((_, idx) => idx !== i)
}

async function submitFinish() {
  const id = complaintId.value
  const text = finishResult.value.trim()
  if (!id || !text) {
    uni.showToast({ title: '请填写处理结果', icon: 'none' })
    return
  }
  busy.value = true
  try {
    const res = await put(`/api/mp/complaints/${id}`, {
      status: '已处理',
      result: text,
      resultImages: finishImages.value.length ? finishImages.value : undefined,
    })
    if (res.success) {
      showFinish.value = false
      await load(id)
      uni.showToast({ title: '已办结', icon: 'success' })
    } else {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    busy.value = false
  }
}

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
        uni.createVideoContext(`staff-preview-v-${i}`).pause()
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
      uni.createVideoContext(`staff-preview-v-${prev}`).pause()
    } catch {
      /* noop */
    }
  }
}

function fmtTime(s: string) {
  try {
    return s.slice(0, 19).replace('T', ' ')
  } catch {
    return s
  }
}

function formatLogTime(iso: string) {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 19)
}

function onAssigneePickerChange(e: { detail: { value: string | number } }) {
  assigneeIndex.value = Number(e.detail.value) || 0
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="d" class="wrap">
      <view class="card">
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
        <template v-if="(d.tenantRooms?.length ?? 0) === 1">
          <view class="row">
            <text class="k">楼层</text>
            <text class="v">{{ d.tenantRooms![0].floorName }}</text>
          </view>
          <view class="row">
            <text class="k">房间号</text>
            <text class="v">{{ d.tenantRooms![0].roomNumber }}</text>
          </view>
        </template>
        <view v-else-if="(d.tenantRooms?.length ?? 0) > 1" class="block-rooms">
          <text class="label">楼层与房间</text>
          <view v-for="(tr, ri) in d.tenantRooms" :key="ri" class="room-line">
            {{ tr.floorName }} · {{ tr.roomNumber }}
            <text v-if="tr.roomName && tr.roomName !== tr.roomNumber" class="room-sub">
              （{{ tr.roomName }}）
            </text>
          </view>
        </view>
        <template v-else>
          <view class="row">
            <text class="k">楼层</text>
            <text class="v dim">未关联</text>
          </view>
          <view class="row">
            <text class="k">房间号</text>
            <text class="v dim">未关联</text>
          </view>
        </template>
        <view class="row">
          <text class="k">位置</text>
          <text class="v">{{ d.location }}</text>
        </view>
        <view v-if="d.assignedToName" class="row">
          <text class="k">处理人</text>
          <text class="v">{{ d.assignedToName }}</text>
        </view>
        <view class="block">
          <text class="label">内容</text>
          <text class="body">{{ d.description }}</text>
        </view>
        <view v-if="d.images?.length" class="block">
          <text class="label">附图</text>
          <view class="pic-grid">
            <view
              v-for="(u, i) in d.images"
              :key="'img-' + i"
              class="pic-touch"
              @tap="openMediaPreview(d.images, i)"
            >
              <video
                v-if="isMediaVideoUrl(u)"
                :id="'att-v-' + i"
                :src="resolveMediaUrl(u)"
                class="pic thumb"
                muted
                :show-center-play-btn="true"
                :controls="false"
              />
              <image
                v-else
                :src="resolveMediaUrl(u)"
                mode="aspectFill"
                class="pic thumb"
              />
              <text v-if="isMediaVideoUrl(u)" class="vid-badge">视频</text>
            </view>
          </view>
        </view>
        <view v-if="d.result" class="block">
          <text class="label">处理结果</text>
          <text class="body">{{ d.result }}</text>
          <text v-if="d.handledAt" class="sub">处理时间 {{ fmtTime(d.handledAt) }}</text>
          <text v-if="d.handledByName" class="sub">处理人 {{ d.handledByName }}</text>
        </view>
        <view v-if="d.resultImages?.length" class="block">
          <text class="label">处理附图</text>
          <view class="pic-grid">
            <view
              v-for="(u, i) in d.resultImages"
              :key="'res-' + i"
              class="pic-touch"
              @tap="openMediaPreview(d.resultImages, i)"
            >
              <video
                v-if="isMediaVideoUrl(u)"
                :id="'res-v-' + i"
                :src="resolveMediaUrl(u)"
                class="pic thumb"
                muted
                :show-center-play-btn="true"
                :controls="false"
              />
              <image
                v-else
                :src="resolveMediaUrl(u)"
                mode="aspectFill"
                class="pic thumb"
              />
              <text v-if="isMediaVideoUrl(u)" class="vid-badge">视频</text>
            </view>
          </view>
        </view>
        <text class="time">提交时间 {{ fmtTime(d.createdAt) }}</text>

        <view v-if="d.activityLogs?.length" class="block logs">
          <text class="label">操作记录</text>
          <view v-for="log in d.activityLogs" :key="log.id" class="log-item">
            <view class="log-meta">
              <text class="log-time">{{ formatLogTime(log.createdAt) }}</text>
              <text class="log-action">{{ log.action }}</text>
            </view>
            <text v-if="log.operatorName" class="log-op">操作人：{{ log.operatorName }}</text>
            <text class="log-summary">{{ log.summary }}</text>
          </view>
        </view>
      </view>

      <view v-if="canAccept || canFinish" class="actions">
        <button
          v-if="canAccept"
          class="btn primary"
          type="primary"
          :disabled="busy"
          @click="openAccept"
        >
          受理并指派
        </button>
        <button v-if="canFinish" class="btn ok" type="default" :disabled="busy" @click="openFinish">
          办结（已处理）
        </button>
      </view>
    </view>

    <view v-if="showAccept" class="mask" @click.self="showAccept = false">
      <view class="sheet" @click.stop>
        <text class="sheet-title">指派处理人</text>
        <picker
          v-if="assigneeNames.length"
          mode="selector"
          :range="assigneeNames"
          :value="assigneeIndex"
          @change="onAssigneePickerChange"
        >
          <view class="picker-line">{{ assigneeNames[assigneeIndex] || '请选择' }}</view>
        </picker>
        <view class="sheet-btns">
          <button class="mini" size="mini" @click="showAccept = false">取消</button>
          <button class="mini primary" type="primary" size="mini" :disabled="busy" @click="submitAccept">
            确定
          </button>
        </view>
      </view>
    </view>

    <view v-if="showFinish" class="mask" @click.self="showFinish = false">
      <view class="sheet tall" @click.stop>
        <text class="sheet-title">办结说明</text>
        <textarea
          v-model="finishResult"
          class="ta"
          placeholder="请填写处理结果（必填）"
          maxlength="2000"
        />
        <text class="hint-upload">处理现场图/视频（选填，最多 {{ MAX_FINISH }} 个）</text>
        <view class="add-grid">
          <view v-for="(u, i) in finishImages" :key="'f-' + i" class="add-cell">
            <video
              v-if="isMediaVideoUrl(u)"
              :src="resolveMediaUrl(u)"
              class="add-thumb"
              muted
            />
            <image v-else :src="resolveMediaUrl(u)" mode="aspectFill" class="add-thumb" />
            <text class="rm" @click="removeFinishImage(i)">×</text>
          </view>
          <view v-if="finishImages.length < MAX_FINISH" class="add-cell add-placeholder" @click="pickFinishMedia">
            <text class="plus">+</text>
            <text class="add-txt">添加</text>
          </view>
        </view>
        <view class="sheet-btns">
          <button class="mini" size="mini" @click="showFinish = false">取消</button>
          <button class="mini primary" type="primary" size="mini" :disabled="busy" @click="submitFinish">
            提交办结
          </button>
        </view>
      </view>
    </view>

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
              :id="'staff-preview-v-' + i"
              :src="resolveMediaUrl(u)"
              class="media-preview__video"
              controls
              :show-center-play-btn="true"
              object-fit="contain"
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
  font-size: 28rpx;
}
.wrap {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.card {
  @include pms-card;
  padding: 36rpx;
}
.flow-block {
  padding-bottom: 24rpx;
  margin-bottom: 16rpx;
  border-bottom: 1rpx solid $pms-border;
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
  border-bottom: 1rpx solid $pms-border;
}
.k {
  color: $pms-text-muted;
}
.v {
  color: $pms-text;
  max-width: 65%;
  text-align: right;
}
.v.dim {
  color: $pms-text-dim;
}
.block-rooms {
  margin-top: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid $pms-border;
}
.room-line {
  font-size: 28rpx;
  color: $pms-text;
  margin-top: 8rpx;
}
.room-sub {
  color: $pms-text-muted;
  font-size: 24rpx;
}
.block {
  margin-top: 28rpx;
}
.label {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
}
.body {
  font-size: 28rpx;
  color: $pms-text;
  line-height: 1.6;
  white-space: pre-wrap;
}
.sub {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  margin-top: 8rpx;
}
.time {
  display: block;
  margin-top: 28rpx;
  font-size: 22rpx;
  color: $pms-text-dim;
}
.pic-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.pic-touch {
  position: relative;
  width: 200rpx;
  height: 200rpx;
}
.thumb {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
}
.vid-badge {
  position: absolute;
  bottom: 8rpx;
  left: 8rpx;
  font-size: 20rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
}
.logs {
  margin-top: 32rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);
}
.log-item {
  padding: 20rpx;
  border-radius: 12rpx;
  background: rgba(15, 23, 42, 0.55);
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  margin-bottom: 16rpx;
}
.log-meta {
  display: flex;
  flex-wrap: wrap;
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
  font-size: 26rpx;
  color: $pms-text;
  line-height: 1.5;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.btn {
  border-radius: 12rpx;
}
.btn.ok {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1rpx solid rgba(34, 197, 94, 0.4);
}
.mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-height: 70vh;
  background: #1e293b;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx;
  box-sizing: border-box;
}
.sheet.tall {
  max-height: 85vh;
  overflow-y: auto;
}
.sheet-title {
  display: block;
  font-size: 30rpx;
  color: $pms-text;
  margin-bottom: 24rpx;
  font-weight: 600;
}
.picker-line {
  padding: 24rpx;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  color: $pms-text;
  font-size: 28rpx;
}
.ta {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  color: $pms-text;
  font-size: 28rpx;
  margin-bottom: 16rpx;
}
.hint-upload {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
}
.add-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.add-cell {
  position: relative;
  width: 160rpx;
  height: 160rpx;
}
.add-thumb {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
}
.add-placeholder {
  border: 2rpx dashed rgba(148, 163, 184, 0.45);
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}
.plus {
  font-size: 56rpx;
  color: $pms-text-muted;
  line-height: 1;
}
.add-txt {
  font-size: 22rpx;
  color: $pms-text-muted;
}
.rm {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 40rpx;
  height: 40rpx;
  line-height: 36rpx;
  text-align: center;
  font-size: 28rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
}
.sheet-btns {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 24rpx;
}
.mini {
  margin: 0;
}

.media-preview {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 200;
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
</style>
