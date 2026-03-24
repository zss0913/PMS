<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { get, post } from '@/api/request'
import { uploadWorkOrderImage, resolveMediaUrl } from '@/api/work-order-upload'

const MAX_IMAGES = 10

type Category = '报事' | '报修'
type FacilityScope = '公共设施' | '套内设施'

const ctxLoading = ref(true)
const ctxBanner = ref('')
const noTenant = ref(false)
const tenantName = ref<string | null>(null)
const buildingName = ref<string | null>(null)
const roomLabel = ref<string | null>(null)

const category = ref<Category>('报修')
const facilityScope = ref<FacilityScope>('公共设施')
const title = ref('')
const description = ref('')
const location = ref('')
const feeNoticeAcknowledged = ref(false)
const submitting = ref(false)
const imageUrls = ref<string[]>([])
const uploadingPhotos = ref(false)

const categories: Category[] = ['报事', '报修']
const facilityOptions: FacilityScope[] = ['公共设施', '套内设施']

const showFeeNotice = computed(() => facilityScope.value === '套内设施')

onMounted(async () => {
  try {
    const res = (await get('/api/mp/work-order-submit-context')) as {
      success?: boolean
      data?: {
        tenantName?: string | null
        buildingName?: string | null
        roomLabel?: string | null
        tenantId?: number | null
      }
    }
    if (res.success && res.data) {
      tenantName.value = res.data.tenantName ?? null
      buildingName.value = res.data.buildingName ?? null
      roomLabel.value = res.data.roomLabel ?? null
      if (res.data.tenantId == null) {
        noTenant.value = true
        ctxBanner.value = '当前账号未关联租客，无法提交报修。请先在「我的」中切换租客或联系物业。'
      }
    }
  } catch {
    ctxBanner.value = '未能加载楼宇信息，您仍可填写提交；若失败请检查网络或稍后重试。'
  } finally {
    ctxLoading.value = false
  }
})

function setCategory(c: Category) {
  category.value = c
}

function setFacility(f: FacilityScope) {
  facilityScope.value = f
  if (f === '公共设施') feeNoticeAcknowledged.value = false
}

function addPhotos() {
  if (noTenant.value) return
  const remain = MAX_IMAGES - imageUrls.value.length
  if (remain <= 0) {
    uni.showToast({ title: `最多上传 ${MAX_IMAGES} 张`, icon: 'none' })
    return
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed', 'original'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const paths = res.tempFilePaths || []
      if (paths.length === 0) return
      void (async () => {
        uploadingPhotos.value = true
        try {
          for (const fp of paths) {
            if (imageUrls.value.length >= MAX_IMAGES) break
            const url = await uploadWorkOrderImage(fp)
            imageUrls.value = [...imageUrls.value, url]
          }
        } catch (e: unknown) {
          uni.showToast({ title: (e as Error)?.message || '上传失败', icon: 'none' })
        } finally {
          uploadingPhotos.value = false
        }
      })()
    },
  })
}

function removePhoto(index: number) {
  imageUrls.value = imageUrls.value.filter((_, i) => i !== index)
}

function previewPhoto(index: number) {
  const urls = imageUrls.value.map((u) => resolveMediaUrl(u))
  if (urls.length === 0) return
  uni.previewImage({
    urls,
    current: urls[index] ?? urls[0],
  })
}

async function handleSubmit() {
  if (noTenant.value) {
    uni.showToast({ title: '请先关联租客', icon: 'none' })
    return
  }
  const t = title.value.trim()
  const d = description.value.trim()
  if (!t) {
    uni.showToast({ title: '请填写标题', icon: 'none' })
    return
  }
  if (!d) {
    uni.showToast({ title: '请填写问题描述', icon: 'none' })
    return
  }
  if (showFeeNotice.value && !feeNoticeAcknowledged.value) {
    uni.showToast({ title: '请阅读并确认套内设施费用说明', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = (await post('/api/mp/work-orders', {
      category: category.value,
      facilityScope: facilityScope.value,
      title: t,
      description: d,
      location: location.value.trim() || undefined,
      feeNoticeAcknowledged: showFeeNotice.value ? feeNoticeAcknowledged.value : undefined,
      images: imageUrls.value.length > 0 ? imageUrls.value : undefined,
    })) as { success?: boolean; message?: string; code?: string }

    if (res.success) {
      uni.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => {
        uni.redirectTo({ url: '/pages/work-orders/work-orders' })
      }, 450)
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (e: unknown) {
    uni.showToast({ title: (e as Error)?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <view v-if="ctxLoading" class="state">加载中…</view>
    <view v-else class="form">
      <view v-if="ctxBanner" class="banner">{{ ctxBanner }}</view>

      <view class="ctx-card">
        <text class="ctx-line" v-if="tenantName">租客：{{ tenantName }}</text>
        <text class="ctx-line" v-if="buildingName">楼宇：{{ buildingName }}</text>
        <text class="ctx-line" v-if="roomLabel">房源：{{ roomLabel }}</text>
        <text v-if="!tenantName && !noTenant" class="ctx-muted">未展示租客名称（仍可尝试提交）</text>
      </view>

      <text class="label">类型</text>
      <view class="seg">
        <view
          v-for="c in categories"
          :key="c"
          class="seg-item"
          :class="{ active: category === c }"
          @click="setCategory(c)"
        >
          {{ c }}
        </view>
      </view>

      <text class="label">设施范围</text>
      <view class="seg">
        <view
          v-for="f in facilityOptions"
          :key="f"
          class="seg-item"
          :class="{ active: facilityScope === f }"
          @click="setFacility(f)"
        >
          {{ f }}
        </view>
      </view>

      <text class="label">标题</text>
      <input v-model="title" class="input" placeholder="简要概括问题" placeholder-class="ph" />

      <text class="label">问题描述</text>
      <textarea
        v-model="description"
        class="textarea"
        placeholder="请描述具体情况、发生时间等"
        placeholder-class="ph"
        :maxlength="2000"
      />

      <text class="label">位置（选填）</text>
      <input v-model="location" class="input" placeholder="如：楼层、区域、房号附近" placeholder-class="ph" />

      <text class="label">现场照片（选填）</text>
      <text class="field-hint">最多 {{ MAX_IMAGES }} 张，PNG / JPG，单张不超过 10MB，与电脑端工单一致</text>
      <view class="photo-block">
        <view v-if="imageUrls.length > 0" class="photo-grid">
          <view
            v-for="(u, idx) in imageUrls"
            :key="u + '-' + idx"
            class="photo-tile"
            @click="previewPhoto(idx)"
          >
            <image class="photo-img" :src="resolveMediaUrl(u)" mode="aspectFill" />
            <view class="photo-remove" @click.stop="removePhoto(idx)">
              <text class="photo-remove-x">×</text>
            </view>
          </view>
        </view>
        <view
          v-if="imageUrls.length < MAX_IMAGES"
          class="btn-add-photo"
          :class="{ disabled: uploadingPhotos || noTenant }"
          @click="addPhotos"
        >
          <text class="btn-add-photo-text">{{ uploadingPhotos ? '上传中…' : '+ 添加照片' }}</text>
        </view>
      </view>

      <view v-if="showFeeNotice" class="fee-box">
        <text class="fee-text">
          套内设施报修可能产生费用，具体以物业确认为准。提交即表示您已了解上述说明。
        </text>
        <view class="fee-row" @click="feeNoticeAcknowledged = !feeNoticeAcknowledged">
          <view class="check" :class="{ on: feeNoticeAcknowledged }" />
          <text class="fee-check-label">我已阅读并确认</text>
        </view>
      </view>

      <button
        class="submit"
        :disabled="submitting || noTenant || uploadingPhotos"
        :class="{ disabled: submitting || noTenant || uploadingPhotos }"
        @click="handleSubmit"
      >
        {{ submitting ? '提交中…' : '提交' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
}

.state {
  text-align: center;
  padding: 80rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.form {
  padding-bottom: 48rpx;
}

.banner {
  @include pms-card;
  padding: 24rpx;
  margin-bottom: 24rpx;
  font-size: 26rpx;
  color: $pms-warning;
  line-height: 1.5;
}

.ctx-card {
  @include pms-card;
  padding: 28rpx;
  margin-bottom: 32rpx;
}

.ctx-line {
  display: block;
  font-size: 26rpx;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
  &:last-child {
    margin-bottom: 0;
  }
}

.ctx-muted {
  font-size: 26rpx;
  color: $pms-text-dim;
}

/* 表单字段内边距：与 Pro Max 租客端节奏一致 */
$field-inset-x: 32rpx;
$field-inset-y: 28rpx;

.label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $pms-text-muted;
  letter-spacing: 0.02em;
  margin-bottom: 16rpx;
  margin-top: 12rpx;
}

.seg {
  display: flex;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.seg-item {
  flex: 1;
  text-align: center;
  padding: 22rpx 16rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: $pms-text-muted;
  border: 1rpx solid $pms-border;
  background: $pms-surface;
  @include pms-tap;
}

.seg-item.active {
  color: $pms-accent;
  border-color: rgba(56, 189, 248, 0.55);
  background: rgba(14, 165, 233, 0.12);
  font-weight: 600;
}

/* H5：uni-input 占位符默认 left:0，需与 wrapper 同步内边距，否则贴边 */
.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  background: $pms-surface;
  border-radius: 22rpx;
  border: 1rpx solid $pms-border;
  box-shadow: 0 10rpx 36rpx rgba(0, 0, 0, 0.28);
  padding: 0;
  font-size: 28rpx;
  color: $pms-text;
  margin-bottom: 32rpx;
  height: auto !important;
  min-height: 0;
  overflow: visible !important;
  position: relative;
  z-index: 1;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.input {
  min-height: 108rpx;
}

.textarea {
  min-height: 240rpx;
  line-height: 1.55;
}

.input:focus-within,
.textarea:focus-within {
  border-color: rgba(56, 189, 248, 0.45);
  box-shadow:
    0 10rpx 36rpx rgba(0, 0, 0, 0.28),
    0 0 0 2rpx rgba(56, 189, 248, 0.2);
}

.input :deep(.uni-input-wrapper),
.input :deep(.uni-input-form) {
  min-height: 96rpx;
  height: 100% !important;
  padding: $field-inset-y $field-inset-x;
  box-sizing: border-box;
}

/* 占位符层绝对定位，必须单独对齐内边距 */
.input :deep(.uni-input-placeholder) {
  left: $field-inset-x !important;
  right: $field-inset-x !important;
  width: auto !important;
  max-width: calc(100% - #{$field-inset-x * 2});
  top: $field-inset-y !important;
  bottom: auto !important;
  line-height: 1.5 !important;
  font-size: 28rpx !important;
  color: $pms-text-dim !important;
  box-sizing: border-box;
}

.input :deep(.uni-input-input) {
  min-height: 40px;
  height: auto !important;
  line-height: 1.5 !important;
  padding: 0 !important;
  margin: 0 !important;
  color: $pms-text !important;
  -webkit-text-fill-color: $pms-text;
  caret-color: $pms-accent;
  user-select: text !important;
  -webkit-user-select: text !important;
}

/*
 * 多行框：H5 上占位符/正文随原生 textarea 绘制，padding 必须写在 textarea 上；
 * 仅包一层 wrapper 的 padding 往往与单行 input 视觉不一致。
 */
.textarea :deep(.uni-textarea-wrapper) {
  padding: 0 !important;
  box-sizing: border-box;
  min-height: 220rpx;
  width: 100%;
}

.textarea :deep(.uni-textarea-textarea) {
  display: block;
  width: 100% !important;
  min-height: 220rpx !important;
  padding: $field-inset-y $field-inset-x !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  line-height: 1.55 !important;
  font-size: 28rpx !important;
  color: $pms-text !important;
  -webkit-text-fill-color: $pms-text;
  caret-color: $pms-accent;
  user-select: text !important;
  -webkit-user-select: text !important;
  vertical-align: top;
}

.textarea :deep(.uni-textarea-textarea)::placeholder {
  color: $pms-text-dim;
}

/* 部分运行时下仍有独立占位层（与 uni-input 类似），与标题/位置对齐 */
.textarea :deep(.uni-textarea-placeholder) {
  left: $field-inset-x !important;
  right: $field-inset-x !important;
  top: $field-inset-y !important;
  width: auto !important;
  max-width: calc(100% - #{$field-inset-x * 2});
  line-height: 1.55 !important;
  font-size: 28rpx !important;
  color: $pms-text-dim !important;
  box-sizing: border-box;
}

.ph {
  color: $pms-text-dim;
}

.field-hint {
  display: block;
  font-size: 24rpx;
  color: $pms-text-dim;
  line-height: 1.5;
  margin-top: -8rpx;
  margin-bottom: 20rpx;
}

.photo-block {
  margin-bottom: 32rpx;
}

.photo-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.photo-tile {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid $pms-border;
  background: rgba(15, 23, 42, 0.5);
  @include pms-tap;
}

.photo-img {
  width: 100%;
  height: 100%;
  display: block;
}

.photo-remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  @include pms-tap;
}

.photo-remove-x {
  color: #fff;
  font-size: 36rpx;
  line-height: 1;
  font-weight: 300;
}

.btn-add-photo {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  padding: 20rpx 28rpx;
  border-radius: 20rpx;
  border: 1rpx dashed rgba(56, 189, 248, 0.45);
  background: rgba(14, 165, 233, 0.06);
  @include pms-tap;
}

.btn-add-photo.disabled {
  opacity: 0.45;
  pointer-events: none;
}

.btn-add-photo-text {
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-accent;
}

.fee-box {
  @include pms-card;
  padding: 24rpx;
  margin-bottom: 32rpx;
  border: 1rpx solid rgba(251, 191, 36, 0.35);
}

.fee-text {
  font-size: 24rpx;
  color: $pms-text-muted;
  line-height: 1.55;
  display: block;
  margin-bottom: 20rpx;
}

.fee-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  @include pms-tap;
}

.check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 8rpx;
  border: 2rpx solid $pms-border;
  flex-shrink: 0;
}

.check.on {
  background: $pms-accent;
  border-color: $pms-accent;
  position: relative;
}

.check.on::after {
  content: '';
  position: absolute;
  left: 10rpx;
  top: 4rpx;
  width: 10rpx;
  height: 18rpx;
  border: solid #0f172a;
  border-width: 0 3rpx 3rpx 0;
  transform: rotate(45deg);
}

.fee-check-label {
  font-size: 26rpx;
  color: $pms-text;
}

.submit {
  margin-top: 16rpx;
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 16rpx;
  border: none;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, $pms-accent 0%, #0ea5e9 100%);
}

.submit.disabled {
  opacity: 0.45;
}
</style>
