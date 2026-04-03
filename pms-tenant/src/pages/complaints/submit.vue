<script setup lang="ts">
import { ref } from 'vue'
import { post } from '@/api/request'
import { uploadWorkOrderImage, resolveMediaUrl } from '@/api/work-order-upload'

const description = ref('')
const images = ref<string[]>([])
const submitting = ref(false)

async function pickImages() {
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
          uni.showToast({
            title: (e as Error)?.message || '某张图片上传失败',
            icon: 'none',
          })
        }
      }
    },
  })
}

function removeImg(i: number) {
  images.value = images.value.filter((_, idx) => idx !== i)
}

async function submit() {
  const t = description.value.trim()
  if (!t) {
    uni.showToast({ title: '请填写吐槽说明', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await post<{ id: number }>('/api/mp/complaints', {
      description: t,
      ...(images.value.length ? { images: images.value } : {}),
    })
    if (res.success) {
      uni.showToast({ title: '已提交', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 500)
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
    <view class="hint">
      说明为必填；图片选填。楼宇、租客、提交时间由系统根据当前登录账号自动记录。
    </view>
    <view class="field">
      <text class="label">吐槽说明 *</text>
      <textarea
        v-model="description"
        class="area"
        placeholder="请简要描述卫生问题"
        maxlength="2000"
      />
    </view>
    <view class="field">
      <text class="label">图片（选填）</text>
      <button class="pic-btn" size="mini" @click="pickImages">选择图片</button>
      <view v-if="images.length" class="previews">
        <view v-for="(u, i) in images" :key="i" class="pv-wrap">
          <image :src="resolveMediaUrl(u)" mode="aspectFill" class="pv" />
          <text class="rm" @click="removeImg(i)">×</text>
        </view>
      </view>
    </view>
    <button class="submit" type="primary" :loading="submitting" @click="submit">提交</button>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.hint {
  font-size: 24rpx;
  color: $pms-text-muted;
  line-height: 1.5;
  margin-bottom: 32rpx;
}
.field {
  margin-bottom: 32rpx;
}
.label {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: $pms-text;
  margin-bottom: 12rpx;
}
.area {
  width: 100%;
  min-height: 240rpx;
  padding: 20rpx;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12rpx;
  font-size: 28rpx;
  color: $pms-text;
}
.pic-btn {
  margin-bottom: 16rpx;
}
.previews {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.pv-wrap {
  position: relative;
}
.pv {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
}
.rm {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 40rpx;
  height: 40rpx;
  line-height: 36rpx;
  text-align: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 50%;
  font-size: 28rpx;
}
.submit {
  margin-top: 48rpx;
  background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
}
</style>
