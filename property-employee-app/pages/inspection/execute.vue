<template>
  <view class="container">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="detail" class="page-card">
      <view class="head">
        <text class="title">{{ detail.planName }}</text>
        <text class="sub">{{ detail.code }} · {{ detail.status }}</text>
      </view>
      <view class="tip">
        微信小程序安卓端可尝试 NFC 读卡；若当前设备不支持，请手输标签编号。
      </view>
      <view v-if="pendingItems.length === 0" class="done">本任务所有检查点已完成</view>
      <view v-else class="list">
        <view v-for="(c, i) in pendingItems" :key="i" class="row" @click="openItem(c)">
          <view>
            <text class="n">{{ c.name }}</text>
            <text class="subline">NFC {{ c.tagId }} · {{ c.location || '—' }}</text>
          </view>
          <text class="go">去巡检</text>
        </view>
      </view>
    </view>

    <view v-if="pickedItem" class="mask" @click="closeSheet">
      <view class="sheet" @click.stop>
        <text class="sheet-title">{{ pickedItem.name }}</text>
        <text class="sheet-sub">期望标签：{{ pickedItem.tagId }}</text>
        <button class="nfc-btn" size="mini" @click="tryNfc">尝试读卡（微信安卓）</button>
        <input v-model="scannedInput" class="input" placeholder="读卡编号 / 手输与后台一致的 NFC ID" />
        <textarea v-model="remark" class="area" placeholder="情况说明（选填）" />
        <button class="pic-btn" size="mini" @click="pickImages">添加图片（选填）</button>
        <view v-if="imageUrls.length" class="pics">
          <image v-for="(u, i) in imageUrls" :key="i" :src="resolveMediaUrl(u)" mode="aspectFill" class="thumb" />
        </view>
        <view class="actions">
          <button class="cancel" @click="closeSheet">取消</button>
          <button class="warn" @click="goAbnormal">异常上报</button>
          <button class="ok" :loading="submitting" type="primary" @click="submitPoint">提交此点</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, resolveMediaUrl } from '../../utils/request.js'
import { openPage } from '../../utils/navigate.js'

const loading = ref(true)
const err = ref('')
const taskId = ref(0)
const detail = ref(null)
const pickedItem = ref(null)
const scannedInput = ref('')
const remark = ref('')
const imageUrls = ref([])
const submitting = ref(false)

const pendingItems = computed(() => {
  const row = detail.value
  if (!row) return []
  const done = new Set(row.doneTagIds || [])
  return (row.checkItems || []).filter((item) => item.tagId && !done.has(item.tagId))
})

onLoad((q) => {
  const id = q.id
  if (!id) {
    err.value = '缺少任务 ID'
    loading.value = false
    return
  }
  taskId.value = parseInt(id, 10)
  void load(id)
})

async function load(id) {
  loading.value = true
  err.value = ''
  try {
    const res = await get(`/api/mp/inspection-tasks/${id}`)
    if (res.success && res.data) {
      detail.value = res.data
      if (!res.data.canExecute) {
        err.value = '无执行权限'
      }
    } else {
      err.value = res.message || '加载失败'
    }
  } catch (e) {
    err.value = e?.message || '网络错误'
  } finally {
    loading.value = false
  }
}

function openItem(c) {
  pickedItem.value = c
  scannedInput.value = ''
  remark.value = ''
  imageUrls.value = []
}

function closeSheet() {
  pickedItem.value = null
}

async function pickImages() {
  uni.chooseImage({
    count: 6,
    sizeType: ['compressed'],
    success: async (res) => {
      const paths = res.tempFilePaths || []
      for (const p of paths) {
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

async function submitPoint() {
  if (!pickedItem.value || !taskId.value) return
  const raw = scannedInput.value.trim()
  if (!raw) {
    uni.showToast({ title: '请填写或粘贴读卡编号', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await post(`/api/mp/inspection-tasks/${taskId.value}/checkpoint`, {
      scannedTagId: raw,
      remark: remark.value.trim() || undefined,
      images: imageUrls.value.length ? imageUrls.value : undefined,
    })
    if (res.success) {
      uni.showToast({ title: '已记录', icon: 'success' })
      closeSheet()
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

function goAbnormal() {
  if (!pickedItem.value || !taskId.value) return
  openPage(
    '/pages/inspection/report?id=' +
      taskId.value +
      '&tagId=' +
      encodeURIComponent(pickedItem.value.tagId || '') +
      '&name=' +
      encodeURIComponent(pickedItem.value.name || '')
  )
}

function tryNfc() {
  // #ifdef MP-WEIXIN
  try {
    const uniAny = uni
    if (typeof uniAny.getNFCAdapter !== 'function') {
      uni.showToast({ title: '请手输标签编号', icon: 'none' })
      return
    }
    const adapter = uniAny.getNFCAdapter()
    adapter.startDiscovery({
      success: () => {
        uni.showToast({ title: '请将标签靠近手机', icon: 'none' })
      },
      fail: () => {
        uni.showToast({ title: '无法启动 NFC，请手输编号', icon: 'none' })
      },
    })
    adapter.onDiscovered((res) => {
      try {
        adapter.stopDiscovery({ success: () => {} })
      } catch (_) {}
      const id = res.id || (res.techs && res.techs[0]) || ''
      if (id) {
        scannedInput.value = String(id).trim()
        uni.showToast({ title: '已读取', icon: 'success' })
      }
    })
  } catch (_) {
    uni.showToast({ title: '请手输标签编号', icon: 'none' })
  }
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '当前端请手输读卡编号', icon: 'none' })
  // #endif
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
}
.hint {
  text-align: center;
  color: #909399;
  padding: 48rpx;
}
.page-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
}
.head {
  margin-bottom: 24rpx;
}
.title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}
.sub {
  display: block;
  font-size: 24rpx;
  color: #909399;
  margin-top: 8rpx;
}
.tip {
  font-size: 22rpx;
  color: #909399;
  line-height: 1.5;
  margin-bottom: 24rpx;
}
.done {
  text-align: center;
  color: #18bc9c;
  padding: 48rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx;
  margin-bottom: 20rpx;
  border-radius: 12rpx;
  background: #f8f8f8;
}
.n {
  display: block;
  font-size: 28rpx;
  color: #333;
}
.subline {
  display: block;
  font-size: 22rpx;
  color: #909399;
  margin-top: 8rpx;
}
.go {
  font-size: 26rpx;
  color: #2979ff;
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
  max-height: 85vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx;
  box-sizing: border-box;
}
.sheet-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}
.sheet-sub {
  display: block;
  font-size: 24rpx;
  color: #909399;
  margin: 12rpx 0 20rpx;
}
.nfc-btn {
  margin-bottom: 16rpx;
}
.input,
.area {
  width: 100%;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  color: #333;
  margin-bottom: 16rpx;
  box-sizing: border-box;
}
.area {
  min-height: 160rpx;
}
.pics {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}
.thumb {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
}
.actions {
  display: flex;
  gap: 12rpx;
  margin-top: 24rpx;
}
.actions button {
  flex: 1;
}
.warn {
  background: #fff7ed;
  color: #e43d33;
}
</style>
