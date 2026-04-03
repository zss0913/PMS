<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, getApiBaseUrl, resolveMediaUrl } from '@/api/request'

interface CheckItem {
  name: string
  nfcTagId: number
  tagId: string
  location: string
}

const loading = ref(true)
const err = ref('')
const taskId = ref(0)
const submitting = ref(false)
const detail = ref<{
  code: string
  planName: string
  status: string
  canExecute: boolean
  checkItems: CheckItem[]
  doneTagIds: string[]
} | null>(null)

const pickedItem = ref<CheckItem | null>(null)
const scannedInput = ref('')
const remark = ref('')
const imageUrls = ref<string[]>([])

const pendingItems = computed(() => {
  const d = detail.value
  if (!d) return []
  const done = new Set(d.doneTagIds || [])
  return d.checkItems.filter((c) => c.tagId && !done.has(c.tagId))
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
      detail.value = res.data
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
    success: async (r) => {
      const paths = r.tempFilePaths || []
      const token = uni.getStorageSync('pms_token') || ''
      const base = getApiBaseUrl()
      for (const p of paths) {
        try {
          const fs = uni.getFileSystemManager()
          const b64 = fs.readFileSync(p, 'base64') as string
          const up = await post<{ url: string }>('/api/work-orders/upload-image', {
            fileBase64: b64,
            fileName: 'shot.jpg',
          })
          if (up.success && up.data?.url) {
            imageUrls.value = [...imageUrls.value, up.data.url]
          }
        } catch {
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
    const res = (await post(`/api/mp/inspection-tasks/${taskId.value}/checkpoint`, {
      scannedTagId: raw,
      remark: remark.value.trim() || undefined,
      images: imageUrls.value.length ? imageUrls.value : undefined,
    })) as { success?: boolean; message?: string }
    if (res.success) {
      uni.showToast({ title: '已记录', icon: 'success' })
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

function tryNfc() {
  // #ifdef MP-WEIXIN
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniAny = uni as any
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
    adapter.onDiscovered((res: { id?: string; techs?: string[] }) => {
      try {
        adapter.stopDiscovery({ success: () => {} })
      } catch {
        /* ignore */
      }
      const id = res.id || (res.techs && res.techs[0]) || ''
      if (id) {
        scannedInput.value = String(id).trim()
        uni.showToast({ title: '已读取', icon: 'success' })
      }
    })
  } catch {
    uni.showToast({ title: '请手输标签编号', icon: 'none' })
  }
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '当前端请手输读卡编号', icon: 'none' })
  // #endif
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
        请按顺序到达各 NFC 点：安卓微信小程序可点「尝试读卡」；或把读卡器/手机读到的标签编号手输到提交框（与后台 NFC
        ID 一致，忽略大小写）。
      </view>
      <view v-if="pendingItems.length === 0" class="done">本任务所有检查点已完成</view>
      <view v-else class="list">
        <view v-for="(c, i) in pendingItems" :key="i" class="row" @click="openItem(c)">
          <view>
            <text class="n">{{ c.name }}</text>
            <text class="sub">NFC {{ c.tagId }}</text>
          </view>
          <text class="go">去巡检</text>
        </view>
      </view>
    </template>

    <view v-if="pickedItem" class="mask" @click="closeSheet">
      <view class="sheet" @click.stop>
        <text class="sheet-title">{{ pickedItem.name }}</text>
        <text class="sheet-sub">期望标签：{{ pickedItem.tagId }}</text>
        <button class="nfc-btn" size="mini" @click="tryNfc">尝试读卡（微信安卓）</button>
        <input
          v-model="scannedInput"
          class="input"
          placeholder="读卡编号 / 手输与后台一致的 NFC ID"
        />
        <textarea v-model="remark" class="area" placeholder="情况说明（选填）" />
        <button class="pic-btn" size="mini" @click="pickImages">添加图片（选填）</button>
        <view v-if="imageUrls.length" class="pics">
          <image
            v-for="(u, i) in imageUrls"
            :key="i"
            :src="resolveMediaUrl(u)"
            mode="aspectFill"
            class="thumb"
          />
        </view>
        <view class="actions">
          <button class="cancel" @click="closeSheet">取消</button>
          <button class="ok" :loading="submitting" type="primary" @click="submitPoint">
            提交此点
          </button>
        </view>
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
  max-height: 85vh;
  overflow-y: auto;
  background: #1e293b;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx;
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
  margin: 12rpx 0 20rpx;
}
.nfc-btn {
  margin-bottom: 16rpx;
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
.pics {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.thumb {
  width: 120rpx;
  height: 120rpx;
  border-radius: 8rpx;
}
.actions {
  display: flex;
  gap: 24rpx;
  margin-top: 24rpx;
}
.cancel {
  flex: 1;
}
.ok {
  flex: 2;
  background: $pms-accent !important;
}
</style>
