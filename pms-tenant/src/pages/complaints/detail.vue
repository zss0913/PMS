<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get } from '@/api/request'
import { resolveMediaUrl } from '@/api/work-order-upload'

const loading = ref(true)
const err = ref('')
const d = ref<{
  status: string
  buildingName: string
  tenantName: string
  location: string
  description: string
  images: string[]
  result: string | null
  resultImages: string[]
  createdAt: string
  handledAt: string | null
} | null>(null)

onLoad((q: Record<string, string | undefined>) => {
  const id = q.id
  if (!id) {
    err.value = '缺少 ID'
    loading.value = false
    return
  }
  void load(id)
})

async function load(id: string) {
  loading.value = true
  err.value = ''
  try {
    const res = (await get(`/api/mp/complaints/${id}`)) as {
      success?: boolean
      data?: typeof d.value
      message?: string
    }
    if (res.success && res.data) {
      d.value = res.data
    } else {
      err.value = res.message || '加载失败'
    }
  } catch {
    err.value = '网络错误'
  } finally {
    loading.value = false
  }
}

function previewGroup(urls: string[] | undefined, current: string) {
  const list = (urls || []).filter(Boolean)
  if (!list.length) return
  uni.previewImage({
    urls: list.map((x) => resolveMediaUrl(x)),
    current: resolveMediaUrl(current),
  })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="err" class="hint">{{ err }}</view>
    <view v-else-if="d" class="card">
      <view class="row">
        <text class="k">状态</text>
        <text class="v">{{ d.status }}</text>
      </view>
      <view class="row">
        <text class="k">楼宇</text>
        <text class="v">{{ d.buildingName }}</text>
      </view>
      <view class="row">
        <text class="k">租客</text>
        <text class="v">{{ d.tenantName }}</text>
      </view>
      <view class="row">
        <text class="k">提交时间</text>
        <text class="v">{{ d.createdAt?.replace('T', ' ').slice(0, 19) }}</text>
      </view>
      <view class="block">
        <text class="label">说明</text>
        <text class="body">{{ d.description }}</text>
      </view>
      <view v-if="d.images?.length" class="block">
        <text class="label">附图</text>
        <view class="pics">
          <image
            v-for="(u, i) in d.images"
            :key="i"
            :src="resolveMediaUrl(u)"
            mode="widthFix"
            class="pic"
            @click="previewGroup(d.images, u)"
          />
        </view>
      </view>
      <view v-if="d.result" class="block">
        <text class="label">处理结果</text>
        <text class="body">{{ d.result }}</text>
        <text v-if="d.handledAt" class="sub">处理时间 {{ d.handledAt?.replace('T', ' ').slice(0, 19) }}</text>
      </view>
      <view v-if="d.resultImages?.length" class="block">
        <text class="label">处理附图</text>
        <view class="pics">
          <image
            v-for="(u, i) in d.resultImages"
            :key="i"
            :src="resolveMediaUrl(u)"
            mode="widthFix"
            class="pic"
            @click="previewGroup(d.resultImages, u)"
          />
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
.hint {
  text-align: center;
  padding: 80rpx;
  color: $pms-text-muted;
}
.card {
  @include pms-card;
  padding: 32rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 14rpx 0;
  font-size: 28rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}
.k {
  color: $pms-text-muted;
}
.v {
  color: $pms-text;
  max-width: 65%;
  text-align: right;
}
.block {
  margin-top: 24rpx;
}
.label {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 8rpx;
}
.body {
  font-size: 28rpx;
  color: $pms-text;
  line-height: 1.55;
}
.sub {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  margin-top: 8rpx;
}
.pics {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.pic {
  width: 100%;
  border-radius: 12rpx;
}
</style>
