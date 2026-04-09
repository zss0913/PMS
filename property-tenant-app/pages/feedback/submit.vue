<template>
  <view class="container">
    <view class="page-body">
      <view class="form-card">
        <view class="tips">说明为必填；图片选填。楼宇、租客由系统根据当前账号记录。</view>
        <u-form :model="form" labelPosition="top" labelWidth="220" class="feedback-form">
          <u-form-item label="吐槽位置（选填）" borderBottom>
            <u-input v-model="form.location" placeholder="如：1楼卫生间" border="none" />
          </u-form-item>
          <u-form-item label="吐槽说明" borderBottom>
            <u-textarea v-model="form.description" placeholder="请描述卫生问题" count maxlength="2000"></u-textarea>
          </u-form-item>
          <u-form-item label="图片（选填）">
            <view class="photo-row">
              <view v-for="(u, i) in images" :key="i" class="thumb-wrap">
                <image :src="resolveMediaUrl(u)" mode="aspectFill" class="thumb" @click="preview(i)" />
                <text class="rm" @click.stop="images.splice(i, 1)">×</text>
              </view>
              <view class="add-pho" @click="pickImages">+ 图片</view>
            </view>
          </u-form-item>
        </u-form>
      </view>
      <view class="action-btn">
        <u-button type="primary" :loading="submitting" @click="submit">提交</u-button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { post } from '../../utils/request.js'
import { uploadWorkOrderImage, resolveMediaUrl } from '../../utils/work-order-upload.js'

const form = reactive({
  location: '',
  description: '',
})
const images = ref([])
const submitting = ref(false)

function preview(i) {
  const urls = images.value.map((u) => resolveMediaUrl(u))
  uni.previewImage({ urls, current: urls[i] })
}

function pickImages() {
  uni.chooseImage({
    count: 6,
    sizeType: ['compressed'],
    success: async (r) => {
      const paths = r.tempFilePaths || []
      for (const p of paths) {
        try {
          const url = await uploadWorkOrderImage(p)
          images.value = [...images.value, url]
        } catch (e) {
          uni.showToast({ title: (e && e.message) || '上传失败', icon: 'none' })
        }
      }
    },
  })
}

async function submit() {
  const loc = form.location.trim()
  const t = form.description.trim()
  if (!t) {
    uni.showToast({ title: '请填写吐槽说明', icon: 'none' })
    return
  }
  const description = loc ? `【${loc}】${t}` : t
  submitting.value = true
  try {
    const res = await post('/api/mp/complaints', {
      description,
      ...(images.value.length ? { images: images.value } : {}),
    })
    if (res.success) {
      uni.showToast({ title: '已提交', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 500)
    } else {
      uni.showToast({ title: res.message || '失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '网络错误', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
}
.page-body {
  padding-bottom: 176rpx;
}
.form-card {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 28rpx 30rpx 32rpx;

  .tips {
    font-size: 24rpx;
    color: #909399;
    margin-bottom: 16rpx;
    line-height: 1.5;
  }

  .feedback-form {
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
}
</style>
