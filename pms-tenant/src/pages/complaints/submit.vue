<script setup lang="ts">
import { ref } from 'vue'
import { post } from '@/api/request'
import {
  uploadWorkOrderImage,
  resolveMediaUrl,
  isMediaVideoUrl,
} from '@/api/work-order-upload'

const description = ref('')
/** 图片/视频上传后的 URL 列表（提交字段仍为 images） */
const images = ref<string[]>([])
const submitting = ref(false)

const MAX_FILES = 12

async function uploadPath(path: string) {
  return uploadWorkOrderImage(path)
}

function openFallbackPicker(remain: number) {
  uni.showActionSheet({
    itemList: ['选择图片', '选择视频'],
    success: (sheet) => {
      if (sheet.tapIndex === 0) {
        uni.chooseImage({
          count: Math.min(remain, 9),
          sizeType: ['compressed'],
          success: async (r) => {
            const paths = r.tempFilePaths || []
            for (const p of paths) {
              try {
                const url = await uploadPath(p)
                images.value = [...images.value, url]
              } catch (e) {
                uni.showToast({
                  title: (e as Error)?.message || '上传失败',
                  icon: 'none',
                })
              }
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
            try {
              const url = await uploadPath(p)
              images.value = [...images.value, url]
            } catch (e) {
              uni.showToast({
                title: (e as Error)?.message || '视频上传失败',
                icon: 'none',
              })
            }
          },
        })
      }
    },
  })
}

function pickMedia() {
  const remain = MAX_FILES - images.value.length
  if (remain <= 0) {
    uni.showToast({ title: `最多${MAX_FILES}个文件`, icon: 'none' })
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
        for (const f of files) {
          try {
            const url = await uploadPath(f.tempFilePath)
            images.value = [...images.value, url]
          } catch (e) {
            uni.showToast({
              title: (e as Error)?.message || '上传失败',
              icon: 'none',
            })
          }
        }
      },
      fail: () => {
        openFallbackPicker(remain)
      },
    })
    return
  }

  openFallbackPicker(remain)
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
      说明为必填；图片与视频为选填。楼宇、租客、提交时间由系统根据当前登录账号自动记录。
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
      <text class="label">图片 / 视频（选填）</text>
      <view class="media-grid">
        <view v-for="(u, i) in images" :key="i" class="media-tile">
          <video
            v-if="isMediaVideoUrl(u)"
            :src="resolveMediaUrl(u)"
            class="pv-video"
            controls
            object-fit="cover"
          />
          <image v-else :src="resolveMediaUrl(u)" mode="aspectFill" class="pv" />
          <view class="rm" @click.stop="removeImg(i)">
            <text class="rm-x">×</text>
          </view>
        </view>
        <view v-if="images.length < MAX_FILES" class="media-tile add-tile" @click="pickMedia">
          <text class="plus">+</text>
          <text class="add-hint">添加</text>
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
  padding-bottom: 48rpx;
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
  margin-bottom: 16rpx;
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

.media-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.media-tile {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
}

.pv {
  width: 100%;
  height: 100%;
}

.pv-video {
  width: 100%;
  height: 100%;
  display: block;
}

.add-tile {
  border: 2rpx dashed rgba(148, 163, 184, 0.45);
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  @include pms-tap;
}

.plus {
  font-size: 72rpx;
  font-weight: 200;
  color: $pms-accent;
  line-height: 1;
}

.add-hint {
  font-size: 22rpx;
  color: $pms-text-dim;
  margin-top: 4rpx;
}

.rm {
  position: absolute;
  top: 0;
  right: 0;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  border-bottom-left-radius: 12rpx;
}

.rm-x {
  color: #fff;
  font-size: 32rpx;
  line-height: 1;
  font-weight: 300;
}

.submit {
  margin-top: 48rpx;
  background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
}
</style>
