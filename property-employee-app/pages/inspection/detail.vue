<template>
  <view class="page-root">
    <view v-if="loading" class="container"><view class="hint">加载中…</view></view>
    <view v-else-if="err" class="container"><view class="hint">{{ err }}</view></view>
    <view v-else-if="detail" class="detail-page">
    <view class="container" :class="{ 'container--footer': showSubmitFooter }">
    <view class="task-wrap">
      <view class="task-info">
        <view class="task-title-row">
          <text class="title">{{ detail.planName }}</text>
          <u-tag
            v-if="detail.status"
            :text="detail.status"
            :type="statusTagType(detail.status)"
            size="mini"
            plain
          />
        </view>
        <view class="task-meta-grid">
          <view class="meta-cell">
            <text class="meta-k">计划时间</text>
            <text class="meta-v">{{ formatTime(detail.scheduledDate) }}</text>
          </view>
          <view class="meta-cell full">
            <text class="meta-k">巡检路线</text>
            <text class="meta-v">{{ detail.route || detail.checkItems.map((item) => item.name).join(' → ') || '—' }}</text>
          </view>
        </view>
        <view class="progress-block" v-if="(detail.progress?.total ?? 0) > 0">
          <view class="progress-top">
            <text class="progress-label">完成进度</text>
            <text class="progress-num">{{ detail.progress.done }} / {{ detail.progress.total }}</text>
          </view>
          <view class="progress-track">
            <view class="progress-fill" :style="{ width: progressPercent + '%' }" />
          </view>
        </view>
        <view v-else class="meta-row-fallback">进度 {{ detail.progress?.done ?? 0 }} / {{ detail.progress?.total ?? 0 }}</view>
      </view>

      <!-- 仅在有提示文案时渲染；可执行且有待巡检点时不再占空白块 -->
      <view v-if="showStateCard" class="state-card">
        <view v-if="!detail.canExecute" class="state-msg warn">当前账号无执行权限，无法提交检查点。</view>
        <view v-else-if="!hasCheckRows" class="state-msg">当前任务没有检查项（进度 0/0）。请在管理后台确认该巡检计划已关联楼宇并配置了 NFC 检查点。</view>
        <view v-else-if="pendingItems.length === 0" class="state-msg ok">全部检查点已完成。</view>
      </view>

      <view
        v-if="detail.canExecute && !readonly && detail.status !== '已完成' && pendingItems.length > 0"
        class="submit-card"
        id="checkpoint-form"
      >
        <view class="field field-checkpoint">
          <view class="checkpoint-head">
            <text class="label label-inline">当前检查点</text>
            <view class="abnormal-wrap">
              <u-button type="error" plain size="small" text="异常上报" @click="reportAbnormalSelected" />
            </view>
          </view>
          <picker
            class="checkpoint-picker"
            mode="selector"
            :range="pendingItems"
            range-key="name"
            @change="onPickPending"
          >
            <view class="picker-line">
              <text class="picker-text">{{ selectedItem?.name || '请选择待巡检点' }}</text>
              <u-icon name="arrow-down" color="#909399" size="14" />
            </view>
          </picker>
        </view>

        <view class="field nfc-field">
          <text class="label">标签编号</text>
          <text class="field-hint">读卡将自动填入；苹果微信请手输</text>
          <view class="nfc-row">
            <input
              v-model="tagInput"
              class="input nfc-input"
              placeholder-class="ph"
              placeholder="读卡或输入与后台一致的 ID"
              confirm-type="done"
            />
            <view class="nfc-btn-wrap" :class="{ 'nfc-btn-wrap--disabled': isNfcDisabledPlatform }">
              <u-button
                type="primary"
                :plain="!isNfcDisabledPlatform"
                size="small"
                :text="nfcBusy ? '感应中…' : isNfcDisabledPlatform ? '读卡不可用' : '感应读卡'"
                :loading="nfcBusy"
                :disabled="nfcBusy || isNfcDisabledPlatform"
                @click="onReadNfcClick"
              />
            </view>
          </view>
        </view>

        <view class="field">
          <text class="label">情况说明</text>
          <textarea
            v-model="remark"
            class="textarea"
            placeholder-class="ph"
            placeholder="选填：现场备注"
            :maxlength="500"
          />
        </view>

        <view class="field">
          <text class="label" :class="{ 'label-required': requirePhoto }">
            现场照片（{{ requirePhoto ? '必填' : '选填' }}，最多 9 张）
          </text>
          <view class="grid-9">
            <view v-for="(u, i) in imageUrls" :key="'img-' + i" class="grid-cell">
              <image :src="resolveMediaUrl(u)" mode="aspectFill" class="grid-img" @click="previewImage(i)" />
              <view class="grid-del" @click.stop="removeImage(i)">×</view>
            </view>
            <view v-if="imageUrls.length < maxImages" class="grid-cell grid-cell-add" @click="pickImages">
              <view class="grid-add-fill">
                <text class="grid-add-icon">+</text>
                <text class="grid-add-txt">上传</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
    </view>

    <view v-if="showSubmitFooter" class="submit-footer">
      <view class="submit-footer-inner">
        <u-button type="primary" shape="circle" text="提交检查点" :loading="submitting" @click="submitCheckpoint" />
      </view>
    </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, resolveMediaUrl } from '../../utils/request.js'
import { openPage } from '../../utils/navigate.js'
import { formatDateTime } from '../../utils/datetime.js'
import { readNfcTagId, normTag } from '../../utils/nfc.js'
import { getSystemInfoCompat } from '../../utils/system-info.js'

const maxImages = 9

const loading = ref(true)
const err = ref('')
const taskId = ref(0)
const readonly = ref(false)
const detail = ref(null)

const selectedItem = ref(null)
const tagInput = ref('')
const remark = ref('')
const imageUrls = ref([])
const submitting = ref(false)
const nfcBusy = ref(false)
let autoNfcAttempted = false

const hasCheckRows = computed(() => {
  const list = detail.value?.checkItems
  return Array.isArray(list) && list.length > 0
})

/** 避免无文案时仍渲染白底 state-card，在「完成进度」与「当前检查点」之间出现空白条 */
const showStateCard = computed(() => {
  const d = detail.value
  if (!d || readonly.value || d.status === '已完成') return false
  if (!d.canExecute) return true
  if (!hasCheckRows.value) return true
  if (pendingItems.value.length === 0) return true
  return false
})

/** 底部固定提交栏：与可编辑表单同显隐 */
const showSubmitFooter = computed(() => {
  const d = detail.value
  if (!d || readonly.value || d.status === '已完成') return false
  return d.canExecute && pendingItems.value.length > 0
})

const pendingItems = computed(() => {
  const d = detail.value
  if (!d) return []
  const done = new Set((d.doneTagIds || []).map((id) => normTag(id)))
  return (d.checkItems || []).filter((item) => item.tagId && !done.has(normTag(item.tagId)))
})

const isNfcDisabledPlatform = computed(() => {
  // #ifdef MP-WEIXIN
  try {
    return getSystemInfoCompat().platform === 'ios'
  } catch {
    return false
  }
  // #endif
  // #ifdef APP-PLUS
  try {
    return plus.os.name === 'iOS'
  } catch {
    return false
  }
  // #endif
  return false
})

const progressPercent = computed(() => {
  const p = detail.value?.progress
  const total = p?.total ?? 0
  const done = p?.done ?? 0
  if (!total) return 0
  return Math.min(100, Math.round((done / total) * 100))
})

/** 与 PC 巡检计划「必须拍照」一致；接口字段缺省时按必填处理 */
const requirePhoto = computed(() => detail.value?.requirePhoto !== false)

function statusTagType(status) {
  const s = String(status || '')
  if (s === '已完成') return 'success'
  if (s === '巡检中' || s === '执行中') return 'primary'
  if (s === '待执行') return 'warning'
  return 'info'
}

function shouldAutoStartNfc() {
  // #ifdef MP-WEIXIN
  try {
    return getSystemInfoCompat().platform !== 'ios'
  } catch {
    return false
  }
  // #endif
  // #ifdef APP-PLUS
  try {
    return plus.os.name === 'Android'
  } catch {
    return false
  }
  // #endif
  return false
}

function syncSelectedPending() {
  const list = pendingItems.value
  if (list.length === 0) {
    selectedItem.value = null
    return
  }
  if (!selectedItem.value || !list.some((x) => x.tagId === selectedItem.value.tagId)) {
    selectedItem.value = list[0]
  }
}

watch(pendingItems, () => syncSelectedPending(), { deep: true })

onLoad((q) => {
  const id = q.id
  readonly.value = String(q.readonly || '') === 'true'
  autoNfcAttempted = false
  if (!id) {
    err.value = '缺少任务 ID'
    loading.value = false
    return
  }
  taskId.value = parseInt(id, 10)
  void load(String(id))
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
    if (detail.value) {
      await nextTick()
      syncSelectedPending()
      await maybeAutoNfcOnce()
    }
  }
}

async function maybeAutoNfcOnce() {
  if (autoNfcAttempted) return
  if (!detail.value?.canExecute || readonly.value || detail.value.status === '已完成') return
  if (pendingItems.value.length === 0) return
  if (!shouldAutoStartNfc()) return
  autoNfcAttempted = true
  nfcBusy.value = true
  try {
    const uid = await readNfcTagId({ timeoutMs: 45000 })
    tagInput.value = uid
    const hit = pendingItems.value.find((it) => normTag(it.tagId) === normTag(uid))
    if (hit) selectedItem.value = hit
    uni.showToast({ title: '已读取标签', icon: 'success' })
  } catch {
    uni.showToast({ title: '未感应到标签，可点「感应读卡」或手输', icon: 'none', duration: 2200 })
  } finally {
    nfcBusy.value = false
  }
}

function onPickPending(e) {
  const i = Number(e.detail.value)
  const row = pendingItems.value[i]
  if (row) selectedItem.value = row
}

function reportAbnormalSelected() {
  if (!selectedItem.value) {
    uni.showToast({ title: '请先选择检查点', icon: 'none' })
    return
  }
  reportAbnormal(selectedItem.value)
}

async function onReadNfcClick() {
  if (nfcBusy.value) return
  nfcBusy.value = true
  try {
    const uid = await readNfcTagId({ timeoutMs: 45000 })
    tagInput.value = uid
    const hit = pendingItems.value.find((it) => normTag(it.tagId) === normTag(uid))
    if (hit) selectedItem.value = hit
    uni.showToast({ title: '已读取', icon: 'success' })
  } catch (e) {
    const msg = e?.message || '读卡失败'
    uni.showToast({ title: msg.length > 20 ? msg.slice(0, 20) + '…' : msg, icon: 'none', duration: 2800 })
  } finally {
    nfcBusy.value = false
  }
}

async function pickImages() {
  const remain = maxImages - imageUrls.value.length
  if (remain <= 0) return
  uni.chooseImage({
    count: Math.min(remain, 9),
    sizeType: ['compressed'],
    success: async (res) => {
      const paths = res.tempFilePaths || []
      for (const p of paths) {
        if (imageUrls.value.length >= maxImages) break
        try {
          const fs = uni.getFileSystemManager()
          const b64 = fs.readFileSync(p, 'base64')
          const up = await post('/api/work-orders/upload-image', {
            fileBase64: b64,
            fileName: 'inspection.jpg',
          })
          if (up.success && up.data?.url) {
            imageUrls.value = [...imageUrls.value, up.data.url]
          }
        } catch (_) {
          uni.showToast({ title: '某张图片上传失败', icon: 'none' })
        }
      }
    },
  })
}

function removeImage(i) {
  imageUrls.value = imageUrls.value.filter((_, idx) => idx !== i)
}

function previewImage(i) {
  const urls = imageUrls.value.map((u) => resolveMediaUrl(u))
  if (!urls.length) return
  uni.previewImage({
    current: urls[i],
    urls,
  })
}

async function submitCheckpoint() {
  if (!taskId.value || !selectedItem.value) {
    uni.showToast({ title: '请选择检查点', icon: 'none' })
    return
  }
  const raw = tagInput.value.trim()
  if (!raw) {
    uni.showToast({ title: '请填写 NFC 编号或先读卡', icon: 'none' })
    return
  }
  if (normTag(raw) !== normTag(selectedItem.value.tagId)) {
    uni.showToast({ title: '编号与当前所选检查点不一致', icon: 'none' })
    return
  }
  if (requirePhoto.value && imageUrls.value.length === 0) {
    uni.showToast({ title: '请上传至少一张现场照片', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await post(`/api/mp/inspection-tasks/${taskId.value}/checkpoint`, {
      scannedTagId: raw,
      remark: remark.value.trim() || undefined,
      images: imageUrls.value,
    })
    if (res.success) {
      uni.showToast({ title: '已记录', icon: 'success' })
      tagInput.value = ''
      remark.value = ''
      imageUrls.value = []
      autoNfcAttempted = false
      await load(String(taskId.value))
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: e?.message || '网络错误', icon: 'none' })
  } finally {
    submitting.value = false
  }
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
.ph {
  color: #c0c4cc;
  font-size: 26rpx;
}

.page-root {
  min-height: 100vh;
  background: #f0f2f5;
}

.detail-page {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;

  .submit-footer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 200;
    background: #fff;
    box-shadow: 0 -8rpx 32rpx rgba(0, 0, 0, 0.08);
    padding-bottom: env(safe-area-inset-bottom);
    box-sizing: border-box;
  }
  .submit-footer-inner {
    padding: 20rpx 24rpx 24rpx;
    max-width: 750rpx;
    margin: 0 auto;
    box-sizing: border-box;
  }
}

.container {
  padding: 24rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  background: #f0f2f5;
  min-height: 100%;
  box-sizing: border-box;
  &.container--footer {
    /* 为底部固定栏留出空间，避免九宫格等最后一块被遮挡 */
    padding-bottom: calc(32rpx + 168rpx + env(safe-area-inset-bottom));
  }
  .hint {
    text-align: center;
    padding: 60rpx 24rpx;
    color: #909399;
  }
  .task-info {
    background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
    padding: 28rpx 28rpx 24rpx;
    border-radius: 16rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
    border: 1rpx solid rgba(0, 0, 0, 0.04);
    overflow: hidden;
    .task-title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16rpx;
      margin-bottom: 24rpx;
    }
    .title {
      flex: 1;
      font-size: 34rpx;
      font-weight: 700;
      color: #303133;
      line-height: 1.35;
    }
    .task-meta-grid {
      display: flex;
      flex-direction: column;
      gap: 20rpx;
    }
    .meta-cell {
      &.full {
        width: 100%;
      }
      .meta-k {
        display: block;
        font-size: 22rpx;
        color: #909399;
        margin-bottom: 8rpx;
      }
      .meta-v {
        font-size: 28rpx;
        color: #606266;
        line-height: 1.45;
        word-break: break-all;
      }
    }
    .progress-block {
      margin-top: 20rpx;
      padding-top: 20rpx;
      border-top: 1rpx solid #ebeef5;
    }
    .progress-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10rpx;
    }
    .progress-label {
      font-size: 24rpx;
      color: #909399;
    }
    .progress-num {
      font-size: 26rpx;
      font-weight: 600;
      color: #2979ff;
    }
    .progress-track {
      height: 12rpx;
      background: #ebeef5;
      border-radius: 8rpx;
      overflow: hidden;
      font-size: 0;
      line-height: 0;
    }
    .progress-fill {
      display: block;
      height: 12rpx;
      background: linear-gradient(90deg, #5dade2, #2979ff);
      border-radius: 8rpx;
      transition: width 0.25s ease;
    }
    .meta-row-fallback {
      margin-top: 16rpx;
      font-size: 26rpx;
      color: #909399;
    }
  }

  .submit-card {
    background: #fff;
    border-radius: 16rpx;
    padding: 28rpx;
    margin-bottom: 0;
    box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
    border: 1rpx solid rgba(0, 0, 0, 0.04);
    .field {
      margin-bottom: 24rpx;
      &.nfc-field {
        margin-bottom: 28rpx;
      }
      .label {
        display: block;
        font-size: 28rpx;
        font-weight: 500;
        color: #303133;
        margin-bottom: 8rpx;
        &.label-required::after {
          content: ' *';
          color: #f56c6c;
        }
      }
      .field-hint {
        display: block;
        font-size: 22rpx;
        color: #c0c4cc;
        margin-bottom: 12rpx;
      }
    }
    .field-checkpoint {
      .checkpoint-head {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 20rpx;
        margin-bottom: 12rpx;
      }
      .label-inline {
        flex: 1;
        min-width: 0;
        margin-bottom: 0;
      }
    }
    .checkpoint-picker {
      width: 100%;
      display: block;
    }
    .abnormal-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    .picker-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 22rpx 24rpx;
      min-height: 72rpx;
      box-sizing: border-box;
      background: #f5f7fa;
      border-radius: 12rpx;
      border: 1rpx solid #ebeef5;
      .picker-text {
        font-size: 28rpx;
        color: #303133;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    .nfc-row {
      display: flex;
      align-items: stretch;
      gap: 16rpx;
    }
    .nfc-input {
      flex: 1;
      min-width: 0;
      height: 72rpx;
      line-height: 72rpx;
      padding: 0 22rpx;
      background: #f5f7fa;
      border-radius: 12rpx;
      border: 1rpx solid #ebeef5;
      font-size: 28rpx;
      color: #303133;
      box-sizing: border-box;
    }
    .nfc-btn-wrap {
      flex-shrink: 0;
      width: 200rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      &--disabled {
        opacity: 0.55;
        width: 176rpx;
      }
    }
    .textarea {
      width: 100%;
      min-height: 120rpx;
      padding: 20rpx 22rpx;
      background: #f5f7fa;
      border-radius: 12rpx;
      border: 1rpx solid #ebeef5;
      font-size: 26rpx;
      color: #303133;
      box-sizing: border-box;
    }
    .grid-9 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16rpx;
      margin-top: 8rpx;
    }
    .grid-cell {
      position: relative;
      width: 100%;
      padding-bottom: 100%;
      height: 0;
      border-radius: 12rpx;
      overflow: hidden;
      background: #f5f7fa;
      border: 1rpx dashed #dcdfe6;
      box-sizing: border-box;
    }
    .grid-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .grid-del {
      position: absolute;
      top: 4rpx;
      right: 4rpx;
      width: 44rpx;
      height: 44rpx;
      line-height: 40rpx;
      text-align: center;
      font-size: 36rpx;
      color: #fff;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 50%;
      z-index: 2;
    }
    .grid-cell-add {
      border-style: dashed;
    }
    .grid-add-fill {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .grid-add-icon {
      font-size: 56rpx;
      color: #c0c4cc;
      line-height: 1;
    }
    .grid-add-txt {
      font-size: 22rpx;
      color: #909399;
      margin-top: 8rpx;
    }
  }

  .state-card {
    background: #fff;
    border-radius: 12rpx;
    padding: 24rpx 28rpx;
    margin-bottom: 24rpx;
    .state-msg {
      font-size: 26rpx;
      color: #606266;
      line-height: 1.55;
      &.warn {
        color: #e6a23c;
      }
      &.ok {
        color: #18bc9c;
      }
    }
  }
}
</style>
