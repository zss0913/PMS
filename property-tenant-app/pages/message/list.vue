<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="err" class="state err">{{ err }}</view>
    <scroll-view
      v-else
      scroll-y
      class="scroll"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onPullRefresh"
    >
      <text class="hint">按类型查看消息，未读条数在分类入口展示</text>
      <view class="grid">
        <view
          v-for="c in MESSAGE_CATEGORIES"
          :key="c.key"
          class="cat-card"
          :style="{ '--cat-color': c.color }"
          @click="goCategory(c.key)"
        >
          <view class="cat-top">
            <text class="cat-label">{{ c.label }}</text>
            <view v-if="unreadCounts[c.key] > 0" class="unread-pill">
              <text class="unread-num">{{ unreadCounts[c.key] > 99 ? '99+' : unreadCounts[c.key] }}</text>
            </view>
          </view>
          <text class="cat-desc">{{ c.desc }}</text>
          <view class="cat-foot">
            <text class="cat-action">进入列表</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { useUserStore } from '../../stores/user.js'
import { MESSAGE_CATEGORIES } from '../../utils/mp-notifications.js'

const userStore = useUserStore()
const loading = ref(true)
const refreshing = ref(false)
const err = ref('')
const unreadCounts = ref({
  complaint: 0,
  work_order: 0,
  announcement: 0,
  bill: 0,
})

async function load(options) {
  const initial = !options || options.initial !== false
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    loading.value = false
    refreshing.value = false
    return
  }
  if (initial) loading.value = true
  err.value = ''
  try {
    await userStore.fetchUser()
    const res = await get('/api/mp/notifications')
    if (res.success && res.unreadCounts && typeof res.unreadCounts === 'object') {
      unreadCounts.value = {
        complaint: Number(res.unreadCounts.complaint) || 0,
        work_order: Number(res.unreadCounts.work_order) || 0,
        announcement: Number(res.unreadCounts.announcement) || 0,
        bill: Number(res.unreadCounts.bill) || 0,
      }
    } else {
      err.value = res.message || '加载失败'
    }
  } catch (e) {
    err.value = (e && e.message) || '网络错误'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function onPullRefresh() {
  refreshing.value = true
  void load({ initial: false })
}

function goCategory(cat) {
  uni.navigateTo({
    url: `/pages/message/category?category=${encodeURIComponent(cat)}`,
  })
}

onShow(() => {
  void load({ initial: true })
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 24rpx 48rpx;
  box-sizing: border-box;
  background: #f5f6f7;
}

.state {
  text-align: center;
  padding: 120rpx 24rpx;
  font-size: 28rpx;
  color: #909399;
}

.state.err {
  color: #f56c6c;
}

.scroll {
  max-height: calc(100vh - 48rpx);
}

.hint {
  display: block;
  font-size: 24rpx;
  color: #909399;
  margin-bottom: 24rpx;
  line-height: 1.45;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.cat-card {
  width: calc(50% - 10rpx);
  box-sizing: border-box;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 22rpx 20rpx;
  min-height: 200rpx;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.cat-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.cat-label {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--cat-color, #303133);
  flex: 1;
  line-height: 1.35;
}

.unread-pill {
  flex-shrink: 0;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 12rpx;
  border-radius: 999rpx;
  background: rgba(245, 108, 108, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
}

.unread-num {
  font-size: 22rpx;
  font-weight: 700;
  color: #fff;
}

.cat-desc {
  font-size: 24rpx;
  color: #909399;
  line-height: 1.4;
  flex: 1;
}

.cat-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #ebeef5;
}

.cat-action {
  font-size: 24rpx;
  color: #c0c4cc;
}

.arrow {
  font-size: 28rpx;
  color: #c0c4cc;
  margin-left: 4rpx;
}
</style>
