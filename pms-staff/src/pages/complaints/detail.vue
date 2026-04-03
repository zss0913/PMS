<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, put } from '@/api/request'
import { resolveMediaUrl, uploadWorkOrderImage } from '@/api/work-order-upload'

type Assignee = { id: number; name: string }

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
} | null>(null)

const showAccept = ref(false)
const assigneeIndex = ref(0)

const showFinish = ref(false)
const finishResult = ref('')
const finishImages = ref<string[]>([])

const assigneeNames = computed(() => (d.value?.assignees ?? []).map((a) => a.name))

const canAccept = computed(() => d.value?.status === '待处理')
const canFinish = computed(() => {
  const x = d.value
  if (!x || x.status !== '处理中') return false
  if (x.assignedTo == null || x.currentUserId == null) return false
  return x.assignedTo === x.currentUserId
})

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

async function pickFinishImages() {
  try {
    const r = await new Promise<{ tempFilePaths: string[] }>((resolve, reject) => {
      uni.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => resolve(res),
        fail: reject,
      })
    })
    const paths = r.tempFilePaths || []
    if (!paths.length) return
    uni.showLoading({ title: '上传中' })
    for (const p of paths) {
      const url = await uploadWorkOrderImage(p)
      finishImages.value = [...finishImages.value, url]
    }
  } catch {
    uni.showToast({ title: '选择或上传失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
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

function previewGroup(urls: string[] | undefined, current: string) {
  const list = (urls || []).filter(Boolean)
  if (!list.length) return
  uni.previewImage({
    urls: list.map((x) => resolveMediaUrl(x)),
    current: resolveMediaUrl(current),
  })
}

function fmtTime(s: string) {
  try {
    return s.slice(0, 19).replace('T', ' ')
  } catch {
    return s
  }
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
        <view class="row">
          <text class="k">楼宇</text>
          <text class="v">{{ d.buildingName }}</text>
        </view>
        <view class="row">
          <text class="k">租客</text>
          <text class="v">{{ d.tenantName }}</text>
        </view>
        <view class="row">
          <text class="k">位置</text>
          <text class="v">{{ d.location }}</text>
        </view>
        <view class="row">
          <text class="k">状态</text>
          <text class="v status">{{ d.status }}</text>
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
          <view class="pics">
            <image
              v-for="(u, i) in d.images"
              :key="i"
              :src="resolveMediaUrl(u)"
              mode="widthFix"
              class="pic"
              @click="previewGroup(d.images, u)"
            />
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
          <view class="pics">
            <image
              v-for="(u, i) in d.resultImages"
              :key="i"
              :src="resolveMediaUrl(u)"
              mode="widthFix"
              class="pic"
              @click="previewGroup(d.resultImages, u)"
            />
          </view>
        </view>
        <text class="time">提交时间 {{ fmtTime(d.createdAt) }}</text>
      </view>

      <view v-if="canAccept || canFinish" class="actions">
        <button
          v-if="canAccept"
          class="btn primary"
          type="primary"
          :disabled="busy"
          @click="openAccept"
        >
          受理为处理中
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
        <button class="upload-btn" size="mini" @click="pickFinishImages">上传处理附图（选填）</button>
        <view v-if="finishImages.length" class="finish-pics">
          <view v-for="(u, i) in finishImages" :key="i" class="finish-pic-wrap">
            <image :src="resolveMediaUrl(u)" mode="aspectFill" class="finish-pic" />
            <text class="rm" @click="removeFinishImage(i)">删</text>
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
.v.status {
  color: #22c55e;
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
.pics {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.pic {
  width: 100%;
  border-radius: 12rpx;
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
.upload-btn {
  margin-bottom: 16rpx;
}
.finish-pics {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.finish-pic-wrap {
  position: relative;
  width: 160rpx;
  height: 160rpx;
}
.finish-pic {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
}
.rm {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  font-size: 20rpx;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
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
</style>
