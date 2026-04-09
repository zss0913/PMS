<template>
  <view class="container">
    <view class="header-bg"></view>

    <view :style="{ height: navPaddingPx + 'px' }"></view>

    <view class="tenant-card" :style="tenantCardStyle">
      <view class="info">
        <view class="name">{{ context.tenantName || '—' }}</view>
        <view class="location">当前楼宇：{{ context.buildingName || '—' }}</view>
      </view>
      <view class="switch-btn" @click="openSwitchPanel">
        <u-icon name="reload" color="#2979ff" size="14"></u-icon>
        <text class="btn-text">切换租客</text>
      </view>
    </view>

    <view class="grid-menu">
      <view class="menu-item" @click="goTo('/pages/repair/list')">
        <view class="icon-box bg-blue">
          <u-icon name="setting" color="#fff" size="28"></u-icon>
        </view>
        <text class="text">报事报修</text>
      </view>
      <view class="menu-item" @click="goTo('/pages/feedback/list')">
        <view class="icon-box bg-orange">
          <u-icon name="chat" color="#fff" size="28"></u-icon>
        </view>
        <text class="text">吐槽反馈</text>
      </view>
      <view class="menu-item" @click="goTo('/pages/bill/list')">
        <view class="icon-box bg-green">
          <u-icon name="rmb" color="#fff" size="28"></u-icon>
        </view>
        <text class="text">企业账单</text>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="title">最新公告</text>
        <view class="more" @click="goTo('/pages/notice/list')">
          <text>查看全部</text>
          <u-icon name="arrow-right" color="#909399" size="12"></u-icon>
        </view>
      </view>
      <view v-if="annLoading" class="hint">加载中…</view>
      <view v-else class="notice-list">
        <view
          v-for="item in annList"
          :key="item.id"
          class="notice-item"
          @click="goAnnDetail(item)"
        >
          <u-icon name="volume" color="#2979ff" size="20" class="icon"></u-icon>
          <text class="notice-title">{{ item.title }}</text>
          <text class="time">{{ formatAnnTime(item.publishTime) }}</text>
        </view>
        <u-empty v-if="!annList.length" mode="list" text="暂无公告" margin-top="20"></u-empty>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { formatDateTime } from '../../utils/datetime.js'
import { useUserStore } from '../../stores/user.js'

const userStore = useUserStore()

/** 顶部留白（px）：需大于微信胶囊按钮下缘，避免与关闭/菜单胶囊重叠 */
const navPaddingPx = ref(20)
/** 右侧留白（px）：避免卡片右侧按钮与胶囊区域水平重叠 */
const capsuleRightPadPx = ref(0)

const tenantCardStyle = computed(() => {
  const pr = capsuleRightPadPx.value
  return pr > 0 ? { paddingRight: pr + 'px' } : {}
})

function initMpSafeArea() {
  const sys = uni.getSystemInfoSync()
  const sb = sys.statusBarHeight || 20
  // #ifdef MP-WEIXIN
  try {
    const m = uni.getMenuButtonBoundingClientRect()
    if (m && typeof m.bottom === 'number' && m.bottom > 0) {
      navPaddingPx.value = m.bottom + 8
      const w = sys.windowWidth || sys.screenWidth || 375
      // 仅预留胶囊按钮右侧至屏幕边缘的间隙，避免整块卡片右侧被过大 padding 挤扁
      if (typeof m.right === 'number' && m.right > 0 && w >= m.right) {
        capsuleRightPadPx.value = Math.max(Math.ceil(w - m.right) + 12, 8)
      }
      return
    }
  } catch (_) {}
  // #endif
  navPaddingPx.value = sb + 44
  capsuleRightPadPx.value = 0
}

const context = ref({
  tenantId: null,
  buildingId: null,
  tenantName: null,
  buildingName: null,
})

const annList = ref([])
const annLoading = ref(false)
const switchOptions = ref([])
const switching = ref(false)

function formatAnnTime(v) {
  return formatDateTime(v, '')
}

async function loadSwitchOptions() {
  if (!userStore.token) return
  try {
    const res = await get('/api/mp/tenant-switch-options')
    switchOptions.value = res.success && Array.isArray(res.data) ? res.data : []
  } catch {
    switchOptions.value = []
  }
}

async function loadContext() {
  try {
    const res = await get('/api/mp/work-order-submit-context')
    if (res.success && res.data) {
      context.value = {
        tenantId: res.data.tenantId ?? null,
        buildingId: res.data.buildingId ?? null,
        tenantName: res.data.tenantName ?? null,
        buildingName: res.data.buildingName ?? null,
      }
    }
  } catch {
    context.value = {
      tenantId: null,
      buildingId: null,
      tenantName: null,
      buildingName: null,
    }
  }
}

async function loadAnnouncements() {
  annLoading.value = true
  try {
    const params = {}
    if (context.value.buildingId != null) {
      params.buildingId = String(context.value.buildingId)
    }
    const res = await get('/api/mp/announcements', params)
    annList.value = res.success && Array.isArray(res.list) ? res.list : []
  } catch {
    annList.value = []
  } finally {
    annLoading.value = false
  }
}

async function refreshHome() {
  if (!userStore.token) return
  if (!userStore.user) {
    await userStore.fetchUser()
  }
  await loadSwitchOptions()
  await loadContext()
  await loadAnnouncements()
}

onMounted(async () => {
  initMpSafeArea()
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  await refreshHome()
})

onShow(() => {
  initMpSafeArea()
  if (userStore.token) {
    void refreshHome()
  }
})

function optionTitle(opt) {
  return opt.tenantName || `租客 #${opt.tenantId}`
}

async function openSwitchPanel() {
  await loadSwitchOptions()
  const extra = switchOptions.value.filter((o) => !o.isCurrent)
  if (!extra.length) {
    uni.showToast({ title: '暂无可切换的租客', icon: 'none' })
    return
  }
  uni.showActionSheet({
    itemList: extra.map((o) => `${optionTitle(o)} · ${o.propertyCompanyName || ''}`),
    success: async (res) => {
      const item = extra[res.tapIndex]
      if (!item || switching.value) return
      if (!userStore.user) return
      switching.value = true
      try {
        if (item.tenantUserId !== userStore.user.id) {
          await userStore.switchTenant(item.tenantUserId)
        }
        await userStore.switchActiveTenant(item.tenantId)
        uni.showToast({ title: '已切换' })
        await refreshHome()
      } catch (err) {
        uni.showToast({ title: (err && err.message) || '切换失败', icon: 'none' })
      } finally {
        switching.value = false
      }
    },
  })
}

function goAnnDetail(item) {
  let url = `/pages/notice/detail?id=${item.id}`
  if (context.value.buildingId != null) {
    url += `&buildingId=${context.value.buildingId}`
  }
  uni.navigateTo({ url })
}

const goTo = (url) => {
  if (!url) return
  const targetUrl = url.startsWith('/') ? url : '/' + url
  if (
    targetUrl.includes('mine/mine') ||
    targetUrl.includes('index/index') ||
    targetUrl.includes('message/list')
  ) {
    uni.switchTab({ url: targetUrl })
  } else {
    uni.navigateTo({ url: targetUrl })
  }
}
</script>

<style lang="scss" scoped>
.container {
  padding: 0;
  position: relative;
  .header-bg {
    width: 100%;
    height: 340rpx;
    background: linear-gradient(to bottom, #2979ff, #f5f6f7);
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
  }

  .tenant-card {
    position: relative;
    z-index: 1;
    margin: 24rpx 24rpx 24rpx;
    box-sizing: border-box;
    background-color: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
    .info {
      flex: 1;
      .name {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
        margin-bottom: 10rpx;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 1;
        overflow: hidden;
      }
      .location {
        font-size: 24rpx;
        color: #666;
      }
    }
    .switch-btn {
      display: flex;
      align-items: center;
      padding: 10rpx 20rpx;
      background-color: rgba(41, 121, 255, 0.1);
      border-radius: 30rpx;
      margin-left: 20rpx;
      flex-shrink: 0;
      .btn-text {
        font-size: 24rpx;
        color: #2979ff;
        margin-left: 6rpx;
      }
    }
  }

  .grid-menu {
    position: relative;
    z-index: 1;
    margin: 0 24rpx 24rpx;
    background-color: #fff;
    border-radius: 16rpx;
    padding: 30rpx 10rpx;
    display: flex;
    justify-content: space-around;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);
    .menu-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      .icon-box {
        width: 90rpx;
        height: 90rpx;
        border-radius: 30rpx;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 16rpx;
        box-shadow: 0 6rpx 12rpx rgba(0, 0, 0, 0.1);
        &.bg-blue {
          background: linear-gradient(135deg, #5193ff, #2979ff);
        }
        &.bg-orange {
          background: linear-gradient(135deg, #f7b864, #f3a73f);
        }
        &.bg-green {
          background: linear-gradient(135deg, #36d1b3, #18bc9c);
        }
        &.bg-purple {
          background: linear-gradient(135deg, #a453f5, #8a2be2);
        }
      }
      .text {
        font-size: 26rpx;
        color: #333;
        font-weight: 500;
      }
    }
  }

  .section {
    position: relative;
    z-index: 1;
    margin: 0 24rpx 24rpx;
    background-color: #fff;
    border-radius: 16rpx;
    padding: 30rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24rpx;
      .title {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
      }
      .more {
        display: flex;
        align-items: center;
        gap: 6rpx;
        font-size: 24rpx;
        color: #999;
      }
    }
    .hint {
      font-size: 26rpx;
      color: #909399;
      padding: 20rpx 0;
    }
    .notice-list {
      .notice-item {
        display: flex;
        align-items: center;
        padding: 24rpx 0;
        border-bottom: 1rpx solid #f5f5f5;
        &:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .icon {
          margin-right: 16rpx;
          flex-shrink: 0;
        }
        .notice-title {
          flex: 1;
          font-size: 28rpx;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .time {
          font-size: 24rpx;
          color: #999;
          margin-left: 20rpx;
          flex-shrink: 0;
        }
      }
    }
  }
}
</style>
