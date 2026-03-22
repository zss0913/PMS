<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/store/user'
import { get } from '@/api/request'

const userStore = useUserStore()

type SwitchOpt = {
  tenantUserId: number
  tenantId: number
  buildingId: number
  tenantName: string
  propertyCompanyName: string
  accountName: string
  isCurrent: boolean
}

const switchOptions = ref<SwitchOpt[]>([])
const switchPanelOpen = ref(false)
const switching = ref(false)

const activeTenantLabel = computed(() => {
  const rels = userStore.user?.relations ?? []
  if (rels.length === 0) return ''
  if (rels.length === 1) {
    const n = rels[0].tenantName
    return n ? `当前租客：${n}` : ''
  }
  const names = rels.map((r) => r.tenantName).filter(Boolean) as string[]
  return names.length ? `数据范围：${names.join('、')}` : ''
})

const showSwitchEntry = computed(
  () => switchOptions.value.filter((o) => !o.isCurrent).length > 0
)

onMounted(() => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  void userStore.fetchUser()
  void loadSwitchOptions()
})

async function loadSwitchOptions() {
  if (!userStore.token) return
  try {
    const res = (await get('/api/mp/tenant-switch-options')) as {
      success?: boolean
      data?: SwitchOpt[]
    }
    switchOptions.value = res.success && Array.isArray(res.data) ? res.data : []
  } catch {
    switchOptions.value = []
  }
}

async function openSwitchPanel() {
  await loadSwitchOptions()
  if (!showSwitchEntry.value) {
    uni.showToast({ title: '暂无可切换的租客公司', icon: 'none' })
    return
  }
  switchPanelOpen.value = true
}

function closeSwitchPanel() {
  switchPanelOpen.value = false
}

async function applySwitchOption(opt: SwitchOpt) {
  if (opt.isCurrent) {
    uni.showToast({ title: '已是当前租客', icon: 'none' })
    return
  }
  if (!userStore.user) return
  switching.value = true
  try {
    if (opt.tenantUserId !== userStore.user.id) {
      await userStore.switchTenant(opt.tenantUserId)
    }
    await userStore.switchActiveTenant(opt.tenantId)
    uni.showToast({ title: '已切换' })
    closeSwitchPanel()
    await loadSwitchOptions()
  } catch (err: unknown) {
    uni.showToast({ title: (err as Error)?.message || '切换失败', icon: 'none' })
  } finally {
    switching.value = false
  }
}

function optionTitle(opt: SwitchOpt) {
  return opt.tenantName || `租客 #${opt.tenantId}`
}

function optionSub(opt: SwitchOpt) {
  return `${opt.propertyCompanyName} · ${opt.accountName}`
}

function goBills() {
  uni.navigateTo({ url: '/pages/bills/bills' })
}

function goWorkOrders() {
  uni.navigateTo({ url: '/pages/work-orders/work-orders' })
}

function goAnnouncements() {
  uni.navigateTo({ url: '/pages/announcements/announcements' })
}

function goComplaints() {
  uni.navigateTo({ url: '/pages/complaints/complaints' })
}

function logout() {
  uni.showModal({
    title: '提示',
    content: '确定退出登录？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.navigateTo({ url: '/pages/login/login' })
      }
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="user-card" v-if="userStore.user">
      <view class="user-glow" />
      <text class="name">{{ userStore.user.name }}</text>
      <text class="phone">{{ userStore.user.phone }}</text>
      <view v-if="activeTenantLabel || showSwitchEntry" class="tenant-row">
        <text v-if="activeTenantLabel" class="tenant-ctx">{{ activeTenantLabel }}</text>
        <text v-else class="tenant-ctx dim">已关联多个租客公司，可切换查看</text>
        <view
          v-if="showSwitchEntry"
          class="btn-switch"
          :class="{ disabled: switching }"
          @click="openSwitchPanel"
        >
          <text class="btn-switch-text">切换租客</text>
        </view>
      </view>
    </view>
    <view class="menu-list">
      <view class="menu-item" @click="goBills">
        <text class="menu-text">我的账单</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goWorkOrders">
        <text class="menu-text">报事报修</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goAnnouncements">
        <text class="menu-text">公告</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @click="goComplaints">
        <text class="menu-text">卫生吐槽</text>
        <text class="arrow">›</text>
      </view>
    </view>
    <view class="logout-wrap">
      <button class="btn-logout" @click="logout">退出登录</button>
    </view>

    <!-- 租客公司统一切换 -->
    <view v-if="switchPanelOpen" class="mask" @click="closeSwitchPanel">
      <view class="sheet" @click.stop>
        <text class="sheet-title">选择租客公司</text>
        <text class="sheet-sub">同一手机号下已关联的租客主体均可在此切换</text>
        <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
          <view
            v-for="(opt, idx) in switchOptions"
            :key="`${opt.tenantUserId}-${opt.tenantId}-${opt.buildingId}-${idx}`"
            class="sheet-row"
            :class="{ current: opt.isCurrent, disabled: switching }"
            @click="applySwitchOption(opt)"
          >
            <view class="sheet-row-main">
              <text class="sheet-row-title">{{ optionTitle(opt) }}</text>
              <text class="sheet-row-sub">{{ optionSub(opt) }}</text>
            </view>
            <text v-if="opt.isCurrent" class="sheet-badge">当前</text>
          </view>
        </scroll-view>
        <view class="sheet-cancel" @click="closeSwitchPanel">取消</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 32rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.user-card {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  padding: 48rpx 40rpx;
  margin-bottom: 32rpx;
  border: 1rpx solid rgba(56, 189, 248, 0.4);
  background: linear-gradient(135deg, $pms-surface 0%, $pms-bg-deep 50%, #0c4a6e 100%);
}

.user-glow {
  position: absolute;
  right: -40rpx;
  top: -40rpx;
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: radial-gradient(circle, $pms-accent-soft 0%, transparent 70%);
  pointer-events: none;
}

.name {
  position: relative;
  z-index: 1;
  display: block;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 40rpx;
  font-weight: 700;
  color: $pms-text;
}

.phone {
  position: relative;
  z-index: 1;
  display: block;
  font-size: 26rpx;
  color: $pms-text-muted;
  margin-top: 12rpx;
}

.tenant-row {
  position: relative;
  z-index: 1;
  margin-top: 20rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.tenant-ctx {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: $pms-accent;
  line-height: 1.4;
}
.tenant-ctx.dim {
  color: $pms-text-muted;
}

.btn-switch {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(56, 189, 248, 0.55);
  background: rgba(14, 165, 233, 0.15);
  @include pms-tap;
}
.btn-switch.disabled {
  opacity: 0.45;
  pointer-events: none;
}
.btn-switch-text {
  font-size: 24rpx;
  font-weight: 600;
  color: $pms-accent;
}

.menu-list {
  @include pms-card;
  overflow: hidden;
}

.menu-item {
  @include pms-tap;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 34rpx 32rpx;
  border-bottom: 1rpx solid $pms-border;
  gap: 16rpx;
  &:last-child {
    border-bottom: none;
  }
}

.menu-text {
  font-size: 30rpx;
  color: $pms-text;
  flex: 1;
  min-width: 0;
}

.arrow {
  color: $pms-text-dim;
  font-size: 36rpx;
  flex-shrink: 0;
}

.logout-wrap {
  margin-top: 48rpx;
}

.btn-logout {
  background: transparent;
  color: $pms-danger;
  border: 1rpx solid rgba(248, 113, 113, 0.45);
  border-radius: 16rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
}

.mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-height: 75vh;
  background: $pms-surface;
  border-radius: 28rpx 28rpx 0 0;
  border: 1rpx solid $pms-border;
  border-bottom: none;
  padding: 32rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.sheet-title {
  display: block;
  text-align: center;
  font-size: 32rpx;
  font-weight: 700;
  color: $pms-text;
}

.sheet-sub {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: $pms-text-dim;
  margin-top: 8rpx;
  margin-bottom: 24rpx;
}

.sheet-scroll {
  max-height: 48vh;
  margin-bottom: 16rpx;
}

.sheet-row {
  @include pms-tap;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 28rpx 24rpx;
  border-radius: 16rpx;
  margin-bottom: 12rpx;
  background: $pms-bg-deep;
  border: 1rpx solid $pms-border;
}
.sheet-row.current {
  border-color: rgba(56, 189, 248, 0.45);
}
.sheet-row.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.sheet-row-main {
  flex: 1;
  min-width: 0;
}

.sheet-row-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-text;
}

.sheet-row-sub {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-top: 6rpx;
}

.sheet-badge {
  flex-shrink: 0;
  font-size: 22rpx;
  color: $pms-accent;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(14, 165, 233, 0.12);
}

.sheet-cancel {
  text-align: center;
  padding: 24rpx;
  font-size: 28rpx;
  color: $pms-text-muted;
  @include pms-tap;
}
</style>
