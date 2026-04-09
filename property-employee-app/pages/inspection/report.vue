<template>
  <view class="container">
    <view class="form-card">
      <view class="title">异常上报</view>
      <u-form :model="form" labelPosition="top">
        <u-form-item label="检查点" borderBottom>
          <u-input v-model="form.pointName" disabled border="none" />
        </u-form-item>

        <u-form-item label="标签编号" borderBottom>
          <u-input v-model="form.tagId" disabled border="none" />
        </u-form-item>

        <u-form-item label="严重级别" borderBottom>
          <u-radio-group v-model="form.severity" placement="row">
            <u-radio label="轻微" name="low" customStyle="margin-right: 20rpx" shape="square"></u-radio>
            <u-radio label="一般" name="medium" customStyle="margin-right: 20rpx" shape="square"></u-radio>
            <u-radio label="紧急" name="high" shape="square"></u-radio>
          </u-radio-group>
        </u-form-item>

        <u-form-item label="异常描述" prop="description" borderBottom>
          <u-textarea v-model="form.description" placeholder="请输入异常描述信息..." count></u-textarea>
        </u-form-item>

        <u-form-item label="现场照片">
          <view class="upload-row">
            <u-button size="small" type="primary" plain @click="chooseImages">上传图片</u-button>
            <text class="tips">提交后将自动生成工单。</text>
          </view>
          <view v-if="fileUrls.length" class="photos">
            <view v-for="(item, index) in fileUrls" :key="index" class="photo-wrap">
              <image :src="resolveMediaUrl(item)" class="thumb" mode="aspectFill" @click="previewImages(index)" />
              <view class="remove" @click="removePic(index)">×</view>
            </view>
          </view>
        </u-form-item>

        <view class="action-btn">
          <u-button type="primary" text="提交异常并生成工单" :loading="submitting" @click="submitReport"></u-button>
        </view>
      </u-form>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { post, resolveMediaUrl } from '../../utils/request.js'
import { uploadWorkOrderImage } from '../../utils/work-order-upload.js'

const taskId = ref(0)
const submitting = ref(false)
const fileUrls = ref([])

const form = reactive({
  pointName: '',
  tagId: '',
  severity: 'medium',
  description: '',
})

onLoad((options) => {
  taskId.value = parseInt(String(options.id || ''), 10)
  form.pointName = String(options.name || '')
  form.tagId = String(options.tagId || '')
})

async function chooseImages() {
  const remain = 6 - fileUrls.value.length
  if (remain <= 0) {
    uni.showToast({ title: '最多 6 张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: Math.min(remain, 6),
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const files = res.tempFilePaths || []
      try {
        uni.showLoading({ title: '上传中' })
        for (const filePath of files) {
          const url = await uploadWorkOrderImage(filePath)
          fileUrls.value = [...fileUrls.value, url]
        }
      } catch (e) {
        uni.showToast({ title: e?.message || '上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function removePic(index) {
  fileUrls.value.splice(index, 1)
}

function previewImages(index) {
  const urls = fileUrls.value.map((item) => resolveMediaUrl(item))
  uni.previewImage({ current: urls[index], urls })
}

async function submitReport() {
  if (!taskId.value) {
    uni.showToast({ title: '缺少任务ID', icon: 'none' })
    return
  }
  if (!form.tagId.trim()) {
    uni.showToast({ title: '缺少标签编号', icon: 'none' })
    return
  }
  if (!form.description.trim()) {
    uni.showToast({ title: '请输入异常描述', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await post(`/api/mp/inspection-tasks/${taskId.value}/abnormal-report`, {
      tagId: form.tagId.trim(),
      pointName: form.pointName.trim() || '巡检点',
      severity: form.severity,
      description: form.description.trim(),
      images: fileUrls.value,
    })
    if (!res.success) {
      throw new Error(res.message || '异常上报失败')
    }
    uni.showToast({ title: '异常上报成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1200)
  } catch (e) {
    uni.showToast({ title: e?.message || '异常上报失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  .form-card {
    background-color: #fff;
    border-radius: 12rpx;
    padding: 30rpx;
    .title {
      font-size: 34rpx;
      font-weight: bold;
      margin-bottom: 20rpx;
      padding-bottom: 16rpx;
      border-bottom: 1rpx solid #f0f0f0;
    }
    .upload-row {
      display: flex;
      align-items: center;
      gap: 16rpx;
    }
    .tips {
      font-size: 24rpx;
      color: #e43d33;
    }
    .photos {
      display: flex;
      flex-wrap: wrap;
      gap: 16rpx;
      margin-top: 20rpx;
    }
    .photo-wrap {
      position: relative;
    }
    .thumb {
      width: 160rpx;
      height: 160rpx;
      border-radius: 12rpx;
      background: #f5f6f7;
    }
    .remove {
      position: absolute;
      top: -12rpx;
      right: -12rpx;
      width: 36rpx;
      height: 36rpx;
      line-height: 36rpx;
      text-align: center;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.65);
      color: #fff;
      font-size: 26rpx;
    }
    .action-btn {
      margin-top: 50rpx;
    }
  }
}
</style>
