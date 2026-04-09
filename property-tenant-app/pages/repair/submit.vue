<template>
  <view class="container">
    <view v-if="ctxLoading" class="state">加载中…</view>
    <view v-else class="page-body">
      <view class="form-card">
        <view v-if="ctxBanner" class="banner">{{ ctxBanner }}</view>

        <view class="ctx-block">
          <text class="ctx-line" v-if="tenantName">租客：{{ tenantName }}</text>
          <text class="ctx-line" v-if="buildingName">楼宇：{{ buildingName }}</text>
          <text class="ctx-line" v-if="roomLabel">房源：{{ roomLabel }}</text>
        </view>

        <u-form
          :model="form"
          ref="uForm"
          labelPosition="top"
          labelWidth="180"
          class="repair-form"
        >
          <u-form-item class="seg-form-item" label="类型" labelPosition="left" labelWidth="80" borderBottom>
            <view class="seg">
              <view
                class="seg-item"
                :class="{ active: form.category === '报事' }"
                @click="form.category = '报事'"
              >报事</view>
              <view
                class="seg-item"
                :class="{ active: form.category === '报修' }"
                @click="form.category = '报修'"
              >报修</view>
            </view>
          </u-form-item>
          <u-form-item class="seg-form-item" label="设施范围" labelPosition="left" labelWidth="112" borderBottom>
            <view class="seg">
              <view
                class="seg-item"
                :class="{ active: form.facilityScope === '公共设施' }"
                @click="form.facilityScope = '公共设施'"
              >公共设施</view>
              <view
                class="seg-item"
                :class="{ active: form.facilityScope === '套内设施' }"
                @click="form.facilityScope = '套内设施'"
              >套内设施</view>
            </view>
          </u-form-item>
          <u-form-item label="标题" borderBottom>
            <u-input v-model="form.title" placeholder="简要概括问题" border="none" />
          </u-form-item>
          <u-form-item label="问题描述" borderBottom>
            <u-textarea v-model="form.description" placeholder="请描述具体情况" count maxlength="2000"></u-textarea>
          </u-form-item>
          <u-form-item label="位置（选填）" borderBottom>
            <u-input v-model="form.location" placeholder="楼层、区域等" border="none" />
          </u-form-item>

          <view v-if="showFeeNotice" class="fee-tip">
            <text>套内设施报修可能产生费用，请勾选确认。</text>
            <view class="fee-row" @click="feeAckChecked = !feeAckChecked">
              <view class="check" :class="{ on: feeAckChecked }" />
              <text>我已阅读并确认</text>
            </view>
          </view>

          <u-form-item label="现场照片（选填）">
            <view class="photo-row">
              <view v-for="(u, idx) in imageUrls" :key="idx" class="thumb-wrap" @click="preview(idx)">
                <image :src="resolveMediaUrl(u)" mode="aspectFill" class="thumb" />
                <text class="rm" @click.stop="removePhoto(idx)">×</text>
              </view>
              <view class="add-pho" @click="addPhotos">
                <text>{{ uploadingPhotos ? '上传中…' : '+ 照片' }}</text>
              </view>
            </view>
          </u-form-item>
        </u-form>
      </view>

      <view class="action-btn">
        <u-button type="primary" :loading="submitting" @click="submitReport">提交报修</u-button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { get, post } from '../../utils/request.js'
import { uploadWorkOrderImage, resolveMediaUrl } from '../../utils/work-order-upload.js'

const MAX_IMAGES = 10

const ctxLoading = ref(true)
const ctxBanner = ref('')
const noTenant = ref(false)
const tenantName = ref(null)
const buildingName = ref(null)
const roomLabel = ref(null)

const form = reactive({
  category: '报修',
  facilityScope: '公共设施',
  title: '',
  description: '',
  location: '',
})

const feeAckChecked = ref(false)
const imageUrls = ref([])
const uploadingPhotos = ref(false)
const submitting = ref(false)

const showFeeNotice = computed(() => form.facilityScope === '套内设施')
const feeNoticeAcknowledged = computed(() => feeAckChecked.value)

onMounted(async () => {
  try {
    const res = await get('/api/mp/work-order-submit-context')
    if (res.success && res.data) {
      tenantName.value = res.data.tenantName ?? null
      buildingName.value = res.data.buildingName ?? null
      roomLabel.value = res.data.roomLabel ?? null
      if (res.data.tenantId == null) {
        noTenant.value = true
        ctxBanner.value = '当前账号未关联租客，无法提交。请先在首页切换租客。'
      }
    }
  } catch {
    ctxBanner.value = '未能加载楼宇信息，仍可尝试提交。'
  } finally {
    ctxLoading.value = false
  }
})

function addPhotos() {
  if (noTenant.value) return
  const remain = MAX_IMAGES - imageUrls.value.length
  if (remain <= 0) {
    uni.showToast({ title: `最多 ${MAX_IMAGES} 张`, icon: 'none' })
    return
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed', 'original'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const paths = res.tempFilePaths || []
      if (!paths.length) return
      void (async () => {
        uploadingPhotos.value = true
        try {
          for (const fp of paths) {
            if (imageUrls.value.length >= MAX_IMAGES) break
            const url = await uploadWorkOrderImage(fp)
            imageUrls.value = [...imageUrls.value, url]
          }
        } catch (e) {
          uni.showToast({ title: (e && e.message) || '上传失败', icon: 'none' })
        } finally {
          uploadingPhotos.value = false
        }
      })()
    },
  })
}

function removePhoto(index) {
  imageUrls.value = imageUrls.value.filter((_, i) => i !== index)
}

function preview(index) {
  const urls = imageUrls.value.map((u) => resolveMediaUrl(u))
  uni.previewImage({ urls, current: urls[index] })
}

async function submitReport() {
  if (noTenant.value) {
    uni.showToast({ title: '请先关联租客', icon: 'none' })
    return
  }
  const t = form.title.trim()
  const d = form.description.trim()
  if (!t) {
    uni.showToast({ title: '请填写标题', icon: 'none' })
    return
  }
  if (!d) {
    uni.showToast({ title: '请填写问题描述', icon: 'none' })
    return
  }
  if (showFeeNotice.value && !feeNoticeAcknowledged.value) {
    uni.showToast({ title: '请确认套内设施费用说明', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = await post('/api/mp/work-orders', {
      category: form.category,
      facilityScope: form.facilityScope,
      title: t,
      description: d,
      location: form.location.trim() || undefined,
      feeNoticeAcknowledged: showFeeNotice.value ? feeNoticeAcknowledged.value : undefined,
      images: imageUrls.value.length > 0 ? imageUrls.value : undefined,
    })
    if (res.success) {
      uni.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => {
        uni.redirectTo({ url: '/pages/repair/list' })
      }, 450)
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  .state {
    text-align: center;
    padding: 60rpx;
    color: #909399;
  }
  .page-body {
    padding-bottom: 176rpx;
  }
  .form-card {
    background-color: #fff;
    border-radius: 12rpx;
    padding: 28rpx 30rpx 32rpx;
    .banner {
      background: #fff3cd;
      color: #856404;
      padding: 20rpx;
      border-radius: 8rpx;
      margin-bottom: 20rpx;
      font-size: 26rpx;
    }
    .ctx-block {
      margin-bottom: 12rpx;
      .ctx-line {
        display: block;
        font-size: 26rpx;
        color: #606266;
        margin-bottom: 8rpx;
        line-height: 1.5;
      }
    }
    .repair-form {
      :deep(.u-form-item__body) {
        padding: 18rpx 0;
      }

      :deep(.u-form-item__body__left) {
        margin-bottom: 10rpx !important;
      }

      :deep(.u-form-item__body__left__content__label) {
        font-size: 30rpx;
        font-weight: 600;
        line-height: 1.4;
      }

      :deep(.u-form-item__body__right__content) {
        align-items: flex-start;
      }

      :deep(.seg-form-item .u-form-item__body) {
        align-items: center;
      }

      :deep(.seg-form-item .u-form-item__body__left) {
        margin-bottom: 0 !important;
      }

      :deep(.seg-form-item .u-form-item__body__right) {
        width: 100%;
      }
    }
    .seg {
      display: flex;
      justify-content: flex-end;
      gap: 16rpx;
      flex-wrap: wrap;
      width: 100%;
    }
    .seg-item {
      min-width: 116rpx;
      padding: 14rpx 28rpx;
      border-radius: 8rpx;
      background: #f5f6f7;
      font-size: 28rpx;
      color: #606266;
      text-align: center;
      line-height: 1.2;
    }
    .seg-item.active {
      background: rgba(41, 121, 255, 0.12);
      color: #2979ff;
      font-weight: 600;
    }
    .fee-tip {
      margin: 16rpx 0 8rpx;
      font-size: 26rpx;
      color: #e6a23c;
      line-height: 1.5;
    }
    .fee-row {
      display: flex;
      align-items: center;
      margin-top: 12rpx;
      gap: 12rpx;
    }
    .check {
      width: 36rpx;
      height: 36rpx;
      border-radius: 8rpx;
      border: 2rpx solid #ccc;
    }
    .check.on {
      border-color: #2979ff;
      background: #2979ff;
    }
    .photo-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16rpx;
      .thumb-wrap {
        width: 160rpx;
        height: 160rpx;
        position: relative;
        .thumb {
          width: 100%;
          height: 100%;
          border-radius: 8rpx;
        }
        .rm {
          position: absolute;
          top: -8rpx;
          right: -8rpx;
          background: rgba(0, 0, 0, 0.5);
          color: #fff;
          width: 40rpx;
          height: 40rpx;
          border-radius: 20rpx;
          text-align: center;
          line-height: 40rpx;
          font-size: 28rpx;
        }
      }
      .add-pho {
        width: 160rpx;
        height: 160rpx;
        border: 1rpx dashed #ccc;
        border-radius: 8rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #909399;
        font-size: 26rpx;
      }
    }
  }
  .action-btn {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(env(safe-area-inset-bottom) + 24rpx);
    bottom: calc(constant(safe-area-inset-bottom) + 24rpx);
    z-index: 20;
    padding: 20rpx 24rpx;
    border-radius: 24rpx;
    backdrop-filter: blur(12rpx);
  }
}
</style>

