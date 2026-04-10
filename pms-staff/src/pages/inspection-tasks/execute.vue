<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, resolveMediaUrl } from '@/api/request'
import { uploadWorkOrderImage } from '@/api/work-order-upload'
import { ALLOW_MANUAL_NFC_INPUT } from '@/config/inspection'

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
}

const loading = ref(true)
const err = ref('')
const taskId = ref(0)
const submitting = ref(false)
const detail = ref<{
  code: string
  planName: string
  inspectionType: string
  status: string
  canExecute: boolean
  checkItems: CheckItem[]
  doneTagIds: string[]
  requirePhoto?: boolean
} | null>(null)

function isDeviceInspectionType(t: string) {
  const s = (t || '').trim()
  return s === '设备' || s.startsWith('设备')
}

const deviceSheet = ref<{ title: string; devices: LinkedDevice[] } | null>(null)

function deviceCount(c: CheckItem) {
  return c.linkedDevices?.length ?? 0
}

function openDevicesForItem(c: CheckItem) {
  const n = deviceCount(c)
  if (n === 0) return
  deviceSheet.value = { title: c.name, devices: c.linkedDevices ?? [] }
}

function closeDeviceSheet() {
  deviceSheet.value = null
}

const pickedItem = ref<CheckItem | null>(null)
const scannedInput = ref('')
const remark = ref('')
const imageUrls = ref<string[]>([])

const resultStatus = ref<'normal' | 'abnormal'>('normal')
const abnormalDescription = ref('')
const submitWorkOrder = ref(false)
const workOrderSeverity = ref<'low' | 'medium' | 'high'>('medium')

/** 与 checkbox value 一致；用 checkbox-group @change 同步，避免小程序点选框不触发外层 @tap 导致仍为 false */
const SUBMIT_WO_CHECKBOX_VALUE = 'gen_wo'

function onSubmitWorkOrderGroupChange(e: { detail?: { value?: string[] } }) {
  const arr = e.detail?.value
  submitWorkOrder.value = Array.isArray(arr) && arr.includes(SUBMIT_WO_CHECKBOX_VALUE)
}

type NfcPhase = 'idle' | 'scanning' | 'success' | 'error'
const nfcPhase = ref<NfcPhase>('idle')
const nfcErrorText = ref('')

const maxImages = 12
const requirePhoto = computed(() => detail.value?.requirePhoto !== false)

const pendingItems = computed(() => {
  const d = detail.value
  if (!d) return []
  const done = new Set((d.doneTagIds || []).map((id) => normTag(id)))
  return d.checkItems.filter((c) => c.tagId && !done.has(normTag(c.tagId)))
})

function normTag(s: string) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '')
}

function resetSheet() {
  scannedInput.value = ''
  remark.value = ''
  imageUrls.value = []
  resultStatus.value = 'normal'
  abnormalDescription.value = ''
  submitWorkOrder.value = false
  workOrderSeverity.value = 'medium'
  nfcPhase.value = 'idle'
  nfcErrorText.value = ''
}

watch(scannedInput, () => {
  if (nfcPhase.value === 'success' || nfcPhase.value === 'error') {
    nfcPhase.value = 'idle'
    nfcErrorText.value = ''
  }
})

watch(resultStatus, (v) => {
  if (v === 'normal') {
    abnormalDescription.value = ''
    submitWorkOrder.value = false
  }
})

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少任务 ID'
    loading.value = false
    return
  }
  taskId.value = parseInt(id, 10)
  void load(id)
})

async function load(id: string) {
  loading.value = true
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
        checkItems: (res.data.checkItems || []).map((c) => ({
          ...c,
          linkedDevices: Array.isArray(c.linkedDevices) ? c.linkedDevices : [],
        })),
      }
      if (!res.data.canExecute) {
        err.value = '无执行权限'
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

function openItem(c: CheckItem) {
  pickedItem.value = c
  resetSheet()
}

function closeSheet() {
  pickedItem.value = null
}

function removeImage(i: number) {
  imageUrls.value = imageUrls.value.filter((_, idx) => idx !== i)
}

function openPreview(index: number) {
  const urls = imageUrls.value.map((u) => resolveMediaUrl(u))
  if (urls.length === 0) return
  uni.previewImage({
    current: urls[index] ?? urls[0],
    urls,
  })
}

async function pickImages() {
  const remain = maxImages - imageUrls.value.length
  if (remain <= 0) {
    uni.showToast({ title: `最多 ${maxImages} 张`, icon: 'none' })
    return
  }
  uni.chooseImage({
    count: Math.min(9, remain),
    sizeType: ['compressed'],
    success: async (r) => {
      const paths = r.tempFilePaths || []
      for (const p of paths) {
        if (imageUrls.value.length >= maxImages) break
        try {
          // 与工单一致：multipart 上传，避免 Base64+JSON 体过大导致 Next/网关失败
          const url = await uploadWorkOrderImage(p)
          imageUrls.value = [...imageUrls.value, url]
        } catch (e) {
          const raw = e instanceof Error ? e.message : '上传失败'
          uni.showToast({
            title: raw.length > 20 ? '图片上传失败，请检查网络' : raw,
            icon: 'none',
            duration: 2800,
          })
        }
      }
    },
  })
}

function tryNfc() {
  if (!pickedItem.value) return
  nfcErrorText.value = ''
  const expected = normTag(pickedItem.value.tagId)

  // #ifdef MP-WEIXIN
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniAny = uni as any
    if (typeof uniAny.getNFCAdapter !== 'function') {
      nfcPhase.value = 'error'
      nfcErrorText.value = ALLOW_MANUAL_NFC_INPUT
        ? '当前基础库不支持读卡，请使用下方输入框手录'
        : '当前基础库不支持 NFC，无法读卡'
      return
    }
    nfcPhase.value = 'scanning'
    const adapter = uniAny.getNFCAdapter()
    adapter.startDiscovery({
      success: () => {
        uni.showToast({ title: '请将标签靠近手机', icon: 'none' })
      },
      fail: () => {
        nfcPhase.value = 'error'
        nfcErrorText.value = ALLOW_MANUAL_NFC_INPUT
          ? '无法启动 NFC，请使用下方输入框手录'
          : '无法启动 NFC，请稍后再试'
      },
    })
    adapter.onDiscovered((res: { id?: string; techs?: string[] }) => {
      try {
        adapter.stopDiscovery({ success: () => {} })
      } catch {
        /* ignore */
      }
      const raw = res.id || (res.techs && res.techs[0]) || ''
      const got = normTag(String(raw))
      if (!got) {
        nfcPhase.value = 'error'
        nfcErrorText.value = '未读取到标签编号，请重试'
        return
      }
      scannedInput.value = String(raw).trim()
      if (got !== expected) {
        nfcPhase.value = 'error'
        nfcErrorText.value = '此 NFC 标签不符合此巡检点'
        return
      }
      scannedInput.value = pickedItem.value!.tagId
      nfcPhase.value = 'success'
      uni.showToast({ title: '已感应', icon: 'success' })
    })
  } catch {
    nfcPhase.value = 'error'
    nfcErrorText.value = ALLOW_MANUAL_NFC_INPUT ? '读卡失败，请手输编号' : '读卡失败'
  }
  // #endif

  // #ifndef MP-WEIXIN
  nfcPhase.value = 'scanning'
  setTimeout(() => {
    nfcPhase.value = 'idle'
    uni.showToast({
      title: ALLOW_MANUAL_NFC_INPUT ? '请在下方输入框手录 NFC ID（电脑调试）' : '请在微信内使用读卡',
      icon: 'none',
    })
  }, 700)
  // #endif
}

async function submitPoint() {
  if (!pickedItem.value || !taskId.value) return
  const raw = scannedInput.value.trim()
  if (!raw) {
    uni.showToast({ title: '请先感应或手输 NFC 编号', icon: 'none' })
    return
  }

  const scannedNorm = normTag(raw)
  const expectNorm = normTag(pickedItem.value.tagId)
  if (scannedNorm !== expectNorm) {
    uni.showToast({ title: '标签编号与当前巡检点不一致', icon: 'none' })
    return
  }

  if (resultStatus.value === 'abnormal' && !abnormalDescription.value.trim()) {
    uni.showToast({ title: '请填写异常说明', icon: 'none' })
    return
  }

  if (requirePhoto.value && imageUrls.value.length === 0) {
    uni.showToast({ title: '本任务须上传现场照片', icon: 'none' })
    return
  }

  if (resultStatus.value === 'abnormal' && submitWorkOrder.value && !workOrderSeverity.value) {
    uni.showToast({ title: '请选择题工单紧急程度', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = (await post(`/api/mp/inspection-tasks/${taskId.value}/checkpoint`, {
      scannedTagId: pickedItem.value.tagId,
      remark: remark.value.trim() || undefined,
      images: imageUrls.value.length ? imageUrls.value : undefined,
      resultStatus: resultStatus.value,
      abnormalDescription:
        resultStatus.value === 'abnormal' ? abnormalDescription.value.trim() : undefined,
      submitWorkOrder: resultStatus.value === 'abnormal' ? submitWorkOrder.value : undefined,
      workOrderSeverity:
        resultStatus.value === 'abnormal' && submitWorkOrder.value
          ? workOrderSeverity.value
          : undefined,
    })) as { success?: boolean; message?: string }
    if (res.success) {
      uni.showToast({
        title: submitWorkOrder.value && resultStatus.value === 'abnormal' ? '已提交并生成工单' : '已保存',
        icon: 'success',
      })
      closeSheet()
      await load(String(taskId.value))
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: (e as Error)?.message || '网络错误', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err && !detail" class="hint">{{ err }}</view>
    <template v-else-if="detail">
      <view v-if="err" class="warn">{{ err }}</view>
      <view class="head">
        <text class="t">{{ detail.planName }}</text>
        <text class="s">{{ detail.code }} · {{ detail.status }}</text>
      </view>
      <view class="tip">
        请到达各 NFC 巡检点：安卓微信小程序可点下方蓝色「感应 NFC」；电脑调试可手输与后台一致的标签号（上线后可关闭手输，仅允许读卡）。
      </view>
      <view v-if="pendingItems.length === 0" class="done">本任务所有检查点已完成</view>
      <view v-else class="list">
        <view v-for="(c, i) in pendingItems" :key="i" class="row" @click="openItem(c)">
          <view class="row-text">
            <text class="n">{{ c.name }}</text>
            <text class="sub">NFC {{ c.tagId }}</text>
            <view
              v-if="isDeviceInspectionType(detail.inspectionType)"
              class="dev-mini"
              @click.stop="openDevicesForItem(c)"
            >
              <text v-if="deviceCount(c) > 0" class="dev-mini-link">关联设备 {{ deviceCount(c) }} 台</text>
              <text v-else class="dev-mini-none">未绑定设备</text>
            </view>
          </view>
          <text class="go">去巡检</text>
        </view>
      </view>
    </template>

    <view v-if="pickedItem" class="mask" @click="closeSheet">
      <view class="sheet" @click.stop>
        <text class="sheet-title">{{ pickedItem.name }}</text>
        <text class="sheet-sub">本点标签：{{ pickedItem.tagId }}</text>
        <view
          v-if="isDeviceInspectionType(detail?.inspectionType || '')"
          class="sheet-dev-link"
          @click.stop="openDevicesForItem(pickedItem)"
        >
          <text v-if="deviceCount(pickedItem) > 0" class="sheet-dev-link-t">
            查看本点关联设备（{{ deviceCount(pickedItem) }} 台）
          </text>
          <text v-else class="sheet-dev-link-muted">本点未绑定设备</text>
        </view>

        <view
          class="nfc-sense"
          :class="{
            'nfc-sense--scanning': nfcPhase === 'scanning',
            'nfc-sense--success': nfcPhase === 'success',
            'nfc-sense--error': nfcPhase === 'error',
          }"
          @click="tryNfc"
        >
          <view v-if="nfcPhase === 'idle'" class="nfc-inner">
            <text class="nfc-title">感应 NFC</text>
            <text class="nfc-hint">点击开始（微信安卓）；电脑调试请用手输</text>
          </view>
          <view v-else-if="nfcPhase === 'scanning'" class="nfc-inner">
            <view class="nfc-spinner" />
            <text class="nfc-title">感应中…</text>
            <text class="nfc-hint">请保持标签贴近手机</text>
          </view>
          <view v-else-if="nfcPhase === 'success'" class="nfc-inner">
            <text class="nfc-check">✓</text>
            <text class="nfc-title">已感应</text>
            <text class="nfc-hint">标签校验通过</text>
          </view>
          <view v-else class="nfc-inner">
            <text class="nfc-err-icon">!</text>
            <text class="nfc-title">未通过</text>
            <text class="nfc-hint">{{ nfcErrorText || '请重新感应正确标签' }}</text>
          </view>
        </view>

        <input
          v-if="ALLOW_MANUAL_NFC_INPUT"
          v-model="scannedInput"
          class="input"
          placeholder="读卡编号 / 手输与后台一致的 NFC ID"
        />
        <view v-else class="input input--disabled">
          <text class="input-lock-hint">已关闭手输，请使用上方「感应 NFC」</text>
        </view>

        <view class="seg">
          <view
            class="seg-item"
            :class="{ active: resultStatus === 'normal' }"
            @click="resultStatus = 'normal'"
          >
            正常
          </view>
          <view
            class="seg-item"
            :class="{ active: resultStatus === 'abnormal' }"
            @click="resultStatus = 'abnormal'"
          >
            异常
          </view>
        </view>

        <view v-if="resultStatus === 'abnormal'" class="abnormal-block">
          <text class="field-label">异常说明 <text class="req">*</text></text>
          <textarea
            v-model="abnormalDescription"
            class="area"
            placeholder="请描述异常情况（必填）"
          />
          <checkbox-group class="wo-group" @change="onSubmitWorkOrderGroupChange">
            <label class="wo-row">
              <checkbox
                :value="SUBMIT_WO_CHECKBOX_VALUE"
                :checked="submitWorkOrder"
                color="#3b82f6"
              />
              <text class="wo-row-label">同时生成物业工单并通知处理</text>
            </label>
          </checkbox-group>
          <view v-if="submitWorkOrder" class="sev-block">
            <text class="field-label">工单紧急程度</text>
            <view class="pill-row">
              <view
                class="pill"
                :class="{ on: workOrderSeverity === 'low' }"
                @tap="workOrderSeverity = 'low'"
              >
                轻微
              </view>
              <view
                class="pill"
                :class="{ on: workOrderSeverity === 'medium' }"
                @tap="workOrderSeverity = 'medium'"
              >
                一般
              </view>
              <view
                class="pill"
                :class="{ on: workOrderSeverity === 'high' }"
                @tap="workOrderSeverity = 'high'"
              >
                紧急
              </view>
            </view>
          </view>
        </view>

        <text class="field-label">情况说明（选填）</text>
        <textarea v-model="remark" class="area area-sm" placeholder="其他补充说明" />

        <text class="field-label">
          现场照片
          <text v-if="requirePhoto" class="req">（必填）</text>
          <text v-else class="opt">（选填）</text>
        </text>
        <view class="img-grid">
          <view v-for="(u, i) in imageUrls" :key="i" class="img-cell" @click="openPreview(i)">
            <image :src="resolveMediaUrl(u)" mode="aspectFill" class="img-fill" />
            <view class="img-del" @click.stop="removeImage(i)">×</view>
          </view>
          <view v-if="imageUrls.length < maxImages" class="img-add" @click="pickImages">
            <text class="img-plus">+</text>
            <text class="img-add-t">添加</text>
          </view>
        </view>

        <view class="actions">
          <button class="cancel" @click="closeSheet">取消</button>
          <button class="ok" :loading="submitting" type="primary" @click="submitPoint">
            {{
              resultStatus === 'abnormal' && submitWorkOrder
                ? '提交并生成工单'
                : resultStatus === 'abnormal'
                  ? '仅保存异常记录'
                  : '提交此点'
            }}
          </button>
        </view>
      </view>
    </view>

    <view v-if="deviceSheet" class="mask mask--device" @click="closeDeviceSheet">
      <view class="dev-sheet" @click.stop>
        <view class="dev-sheet-head">
          <text class="dev-sheet-title">关联设备</text>
          <text class="dev-sheet-sub">{{ deviceSheet.title }}</text>
        </view>
        <scroll-view scroll-y class="dev-sheet-scroll">
          <view v-for="d in deviceSheet.devices" :key="d.id" class="dev-sheet-card">
            <text class="dev-sheet-name">{{ d.name }}</text>
            <text class="dev-sheet-code">{{ d.code }}</text>
            <text class="dev-sheet-meta">{{ d.type }}{{ d.location ? ' · ' + d.location : '' }}</text>
          </view>
        </scroll-view>
        <button class="dev-sheet-close" @click="closeDeviceSheet">关闭</button>
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
.hint,
.warn {
  text-align: center;
  color: $pms-text-muted;
  padding: 32rpx;
}
.warn {
  color: #f97316;
}
.head {
  margin-bottom: 24rpx;
}
.t {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: $pms-text;
}
.s {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-top: 8rpx;
}
.tip {
  font-size: 22rpx;
  color: $pms-text-muted;
  line-height: 1.5;
  margin-bottom: 24rpx;
}
.done {
  text-align: center;
  color: $pms-accent;
  padding: 48rpx;
}
.list .row {
  @include pms-card;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx;
  margin-bottom: 20rpx;
}
.row-text {
  flex: 1;
  min-width: 0;
}
.dev-mini {
  margin-top: 10rpx;
}
.dev-mini-link {
  font-size: 22rpx;
  color: $pms-accent;
}
.dev-mini-none {
  font-size: 22rpx;
  color: $pms-text-muted;
}
.sheet-dev-link {
  margin: 12rpx 0 8rpx;
}
.sheet-dev-link-t {
  font-size: 24rpx;
  color: $pms-accent;
}
.sheet-dev-link-muted {
  font-size: 24rpx;
  color: $pms-text-muted;
}
.mask--device {
  z-index: 200;
}
.dev-sheet {
  width: 100%;
  max-height: 70vh;
  background: #1e293b;
  border-radius: 24rpx 24rpx 0 0;
  padding: 28rpx;
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.dev-sheet-head {
  margin-bottom: 20rpx;
}
.dev-sheet-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
}
.dev-sheet-sub {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-top: 8rpx;
}
.dev-sheet-scroll {
  max-height: 46vh;
}
.dev-sheet-card {
  padding: 20rpx 0;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}
.dev-sheet-name {
  display: block;
  font-size: 28rpx;
  color: $pms-text;
  font-weight: 500;
}
.dev-sheet-code {
  display: block;
  font-size: 22rpx;
  font-family: monospace;
  color: $pms-text-muted;
  margin-top: 6rpx;
}
.dev-sheet-meta {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-top: 4rpx;
}
.dev-sheet-close {
  margin-top: 24rpx;
  background: $pms-accent !important;
  color: #fff;
  font-size: 28rpx;
}
.n {
  display: block;
  font-size: 28rpx;
  color: $pms-text;
}
.sub {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-top: 8rpx;
}
.go {
  font-size: 26rpx;
  color: $pms-accent;
}
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}
.sheet {
  width: 100%;
  max-height: 88vh;
  overflow-y: auto;
  background: #1e293b;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
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
  margin: 12rpx 0 24rpx;
}

.nfc-sense {
  width: 100%;
  min-height: 120rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.35);
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
  box-sizing: border-box;
}
.nfc-sense--scanning {
  animation: nfc-pulse 1.2s ease-in-out infinite;
}
.nfc-sense--success {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  box-shadow: 0 8rpx 24rpx rgba(5, 150, 105, 0.35);
}
.nfc-sense--error {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  box-shadow: 0 8rpx 24rpx rgba(220, 38, 38, 0.3);
}
.nfc-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.nfc-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
}
.nfc-hint {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.4;
}
.nfc-check {
  font-size: 48rpx;
  color: #fff;
  line-height: 1;
}
.nfc-err-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  border: 3rpx solid #fff;
  color: #fff;
  font-size: 32rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nfc-spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes nfc-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.92;
    transform: scale(0.99);
  }
}

.input {
  width: 100%;
  padding: 20rpx;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12rpx;
  color: $pms-text;
  margin-bottom: 16rpx;
  box-sizing: border-box;
}
.input--disabled {
  display: flex;
  align-items: center;
  min-height: 72rpx;
}
.input-lock-hint {
  font-size: 24rpx;
  color: $pms-text-muted;
}

.seg {
  display: flex;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1rpx solid rgba(148, 163, 184, 0.35);
  margin-bottom: 20rpx;
}
.seg-item {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  font-size: 26rpx;
  color: $pms-text-muted;
  background: rgba(0, 0, 0, 0.15);
}
.seg-item.active {
  background: rgba(59, 130, 246, 0.25);
  color: #93c5fd;
  font-weight: 600;
}

.abnormal-block {
  margin-bottom: 16rpx;
}
.field-label {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 8rpx;
}
.req {
  color: #f87171;
}
.opt {
  color: $pms-text-muted;
  font-weight: 400;
}
.area {
  width: 100%;
  min-height: 160rpx;
  padding: 20rpx;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12rpx;
  color: $pms-text;
  margin-bottom: 16rpx;
  box-sizing: border-box;
}
.area-sm {
  min-height: 120rpx;
}
.wo-group {
  display: block;
  width: 100%;
  margin-bottom: 16rpx;
}
.wo-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 26rpx;
  color: $pms-text;
}
.wo-row-label {
  flex: 1;
  min-width: 0;
}
.sev-block {
  margin-bottom: 8rpx;
}
.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.pill {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: $pms-text-muted;
  background: rgba(0, 0, 0, 0.2);
  border: 1rpx solid rgba(148, 163, 184, 0.35);
}
.pill.on {
  color: #fff;
  background: rgba(59, 130, 246, 0.45);
  border-color: #60a5fa;
}

.img-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.img-cell,
.img-add {
  width: 160rpx;
  height: 160rpx;
  border-radius: 16rpx;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.img-cell {
  background: rgba(0, 0, 0, 0.25);
}
.img-fill {
  width: 100%;
  height: 100%;
}
.img-del {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 28rpx;
  line-height: 40rpx;
  text-align: center;
}
.img-add {
  border: 2rpx dashed rgba(96, 165, 250, 0.55);
  background: rgba(59, 130, 246, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.img-plus {
  font-size: 56rpx;
  color: #60a5fa;
  line-height: 1;
  font-weight: 300;
}
.img-add-t {
  font-size: 22rpx;
  color: #93c5fd;
  margin-top: 4rpx;
}

.actions {
  display: flex;
  gap: 24rpx;
  margin-top: 8rpx;
}
.cancel {
  flex: 1;
}
.ok {
  flex: 2;
  background: $pms-accent !important;
}
</style>
