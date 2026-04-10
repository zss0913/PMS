<template>
  <view class="page-root">
    <view v-if="loading" class="container"><view class="hint">加载中…</view></view>
    <view v-else-if="err" class="container"><view class="hint">{{ err }}</view></view>
    <view v-else class="detail-page">
      <view class="container container--footer">
        <view class="form-card">
          <view class="field">
            <view class="kv-row">
              <text class="kv-label">检查点</text>
              <text class="kv-value">{{ pointName || '—' }}</text>
            </view>
          </view>

          <view class="field nfc-field">
            <text class="label">标签编号</text>
            <input
              v-model="tagInput"
              class="input nfc-input"
              placeholder-class="ph"
              placeholder="与后台一致的 NFC 编号"
              confirm-type="done"
            />
          </view>

          <view class="field">
            <text class="label label-required">严重级别</text>
            <view class="severity-row">
              <view
                v-for="opt in severityOptions"
                :key="opt.value"
                class="severity-chip"
                :class="{ 'severity-chip--active': severity === opt.value }"
                @click="severity = opt.value"
              >
                <text class="severity-chip-text">{{ opt.label }}</text>
              </view>
            </view>
          </view>

          <view class="field">
            <text class="label label-required">异常描述</text>
            <textarea
              v-model="description"
              class="textarea"
              placeholder-class="ph"
              placeholder="请输入异常描述信息…"
              :maxlength="500"
            />
            <text class="char-count">{{ description.length }}/500</text>
          </view>

          <view class="field">
            <text class="label">现场照片</text>
            <text class="photo-hint">选填；提交后将自动生成工单。</text>
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

      <view class="submit-footer">
        <view class="submit-footer-inner">
          <u-button
            type="primary"
            shape="circle"
            text="提交异常并生成工单"
            :loading="submitting"
            @click="submit"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { post, resolveMediaUrl } from '../../utils/request.js'

const maxImages = 9

const loading = ref(true)
const err = ref('')
const taskId = ref(0)
const pointName = ref('')
const tagInput = ref('')
const severity = ref('medium')
const description = ref('')
const imageUrls = ref([])
const submitting = ref(false)

const severityOptions = [
  { value: 'low', label: '轻微' },
  { value: 'medium', label: '一般' },
  { value: 'high', label: '紧急' },
]

/** 路由参数可能被多次 encode，显示成 %E7%…；解码为中文 */
function decodeQueryParam(raw) {
  if (raw == null || raw === '') return ''
  let s = String(raw)
  for (let i = 0; i < 3; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(s)) break
    try {
      const next = decodeURIComponent(s.replace(/\+/g, ' '))
      if (next === s) break
      s = next
    } catch {
      break
    }
  }
  return s
}

onLoad((q) => {
  const id = q.id
  if (!id) {
    err.value = '缺少任务 ID'
    loading.value = false
    return
  }
  taskId.value = parseInt(String(id), 10)
  if (Number.isNaN(taskId.value)) {
    err.value = '无效的任务 ID'
    loading.value = false
    return
  }
  pointName.value = decodeQueryParam(q.name)
  tagInput.value = decodeQueryParam(q.tagId)
  loading.value = false
})

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

async function submit() {
  const tag = tagInput.value.trim()
  if (!tag) {
    uni.showToast({ title: '请填写标签编号', icon: 'none' })
    return
  }
  const name = pointName.value.trim()
  if (!name) {
    uni.showToast({ title: '缺少检查点名称', icon: 'none' })
    return
  }
  const desc = description.value.trim()
  if (!desc) {
    uni.showToast({ title: '请填写异常描述', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await post(`/api/mp/inspection-tasks/${taskId.value}/abnormal-report`, {
      tagId: tag,
      pointName: name,
      severity: severity.value,
      description: desc,
      images: imageUrls.value.length ? imageUrls.value : undefined,
    })
    if (res.success) {
      uni.showToast({ title: '已生成工单', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 400)
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: e?.message || '网络错误', icon: 'none' })
  } finally {
    submitting.value = false
  }
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
    padding-bottom: calc(32rpx + 168rpx + env(safe-area-inset-bottom));
  }
  .hint {
    text-align: center;
    padding: 60rpx 24rpx;
    color: #909399;
  }
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.06);
  border: 1rpx solid rgba(0, 0, 0, 0.04);
}

.field {
  margin-bottom: 28rpx;
  &:last-child {
    margin-bottom: 0;
  }
  .label {
    display: block;
    font-size: 28rpx;
    font-weight: 500;
    color: #303133;
    margin-bottom: 12rpx;
    &.label-required::after {
      content: ' *';
      color: #f56c6c;
    }
  }
}

.kv-row {
  display: flex;
  align-items: flex-start;
  gap: 24rpx;
}

.kv-label {
  flex-shrink: 0;
  width: 140rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #303133;
  line-height: 44rpx;
  white-space: nowrap;
}

.kv-value {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: #606266;
  line-height: 44rpx;
  word-break: break-all;
}

.nfc-field .nfc-input {
  width: 100%;
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

.severity-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 16rpx;
  margin-top: 4rpx;
}

.severity-chip {
  flex: 1;
  min-width: 0;
  padding: 18rpx 12rpx;
  text-align: center;
  background: #f5f7fa;
  border-radius: 12rpx;
  border: 2rpx solid #ebeef5;
  box-sizing: border-box;
  &--active {
    background: rgba(41, 121, 255, 0.08);
    border-color: #2979ff;
  }
}

.severity-chip-text {
  font-size: 26rpx;
  color: #606266;
}

.severity-chip--active .severity-chip-text {
  color: #2979ff;
  font-weight: 600;
}

.textarea {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx 22rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  border: 1rpx solid #ebeef5;
  font-size: 26rpx;
  color: #303133;
  box-sizing: border-box;
}

.char-count {
  display: block;
  text-align: right;
  font-size: 22rpx;
  color: #c0c4cc;
  margin-top: 8rpx;
}

.photo-hint {
  display: block;
  font-size: 22rpx;
  color: #909399;
  line-height: 1.45;
  margin-bottom: 12rpx;
}

.grid-9 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
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
</style>
