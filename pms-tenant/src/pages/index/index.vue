<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/api/request'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

type SubmitCtx = {
  tenantId: number | null
  buildingId: number | null
  tenantName: string | null
  buildingName: string | null
}

type AnnouncementItem = {
  id: number
  title: string
  content: string
  publishTime: string | Date | null
}

type SwitchOpt = {
  tenantUserId: number
  tenantId: number
  buildingId: number
  tenantName: string
  propertyCompanyName: string
  accountName: string
  isCurrent: boolean
}

const context = ref<SubmitCtx>({
  tenantId: null,
  buildingId: null,
  tenantName: null,
  buildingName: null,
})

const annList = ref<AnnouncementItem[]>([])
const annLoading = ref(false)

const switchOptions = ref<SwitchOpt[]>([])
const switchPanelOpen = ref(false)
const switching = ref(false)

const showSwitchEntry = computed(
  () => switchOptions.value.filter((o) => !o.isCurrent).length > 0
)

function formatAnnTime(v: string | Date | null | undefined): string {
  if (v == null) return ''
  try {
    const d = typeof v === 'string' ? new Date(v) : v
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('zh-CN')
  } catch {
    return String(v)
  }
}

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

async function loadContext() {
  try {
    const res = (await get('/api/mp/work-order-submit-context')) as {
      success?: boolean
      data?: SubmitCtx
    }
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
    const params: Record<string, string> = {}
    if (context.value.buildingId != null) {
      params.buildingId = String(context.value.buildingId)
    }
    const res = (await get('/api/mp/announcements', params)) as {
      success?: boolean
      list?: AnnouncementItem[]
    }
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
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  await refreshHome()
})

onShow(() => {
  if (userStore.token) {
    void refreshHome()
  }
})

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
    await refreshHome()
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

function goComplaints() {
  uni.navigateTo({ url: '/pages/complaints/complaints' })
}

function goAnnDetail(item: AnnouncementItem) {
  let url = `/pages/announcements/detail?id=${item.id}`
  if (context.value.buildingId != null) {
    url += `&buildingId=${context.value.buildingId}`
  }
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <view class="hero-orb" />
      <view class="hero-inner">
        <text class="brand">PMS · TENANT</text>
        <text class="title">物业租客端</text>
        <text class="greet">你好，{{ userStore.user?.name || '租客' }}</text>

        <view class="ctx-block">
          <view class="ctx-row">
            <text class="ctx-label">当前所属公司</text>
            <view class="ctx-value-row">
              <text class="ctx-value ctx-value--grow">{{ context.tenantName || '—' }}</text>
              <view
                v-if="showSwitchEntry"
                class="btn-switch"
                :class="{ disabled: switching }"
                @click="openSwitchPanel"
              >
                <text class="btn-switch-text">切换租客</text>
              </view>
            </view>
            <text
              v-if="!context.tenantName && !context.buildingName"
              class="ctx-hint ctx-hint--below"
            >
              暂未关联租客或楼宇，可尝试切换租客
            </text>
          </view>
          <view class="ctx-row">
            <text class="ctx-label">所在楼宇</text>
            <text class="ctx-value">{{ context.buildingName || '—' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="menu-grid">
      <view class="menu-card" @click="goBills">
        <view class="icon-wrap">
          <text class="icon-char">账</text>
        </view>
        <text class="menu-label">我的账单</text>
        <text class="menu-hint">费用与缴费</text>
      </view>
      <view class="menu-card" @click="goWorkOrders">
        <view class="icon-wrap">
          <text class="icon-char">修</text>
        </view>
        <text class="menu-label">报事报修</text>
        <text class="menu-hint">提交与进度</text>
      </view>
      <view class="menu-card" @click="goComplaints">
        <view class="icon-wrap">
          <text class="icon-char">评</text>
        </view>
        <text class="menu-label">卫生吐槽</text>
        <text class="menu-hint">意见反馈</text>
      </view>
    </view>

    <view class="notice-module">
      <view class="notice-head">
        <text class="notice-title">通知公告</text>
      </view>
      <view v-if="annLoading" class="notice-state">加载中…</view>
      <view v-else-if="annList.length === 0" class="notice-state">暂时无公告</view>
      <view v-else class="notice-list">
        <view
          v-for="item in annList"
          :key="item.id"
          class="notice-row"
          hover-class="notice-row--hover"
          @click="goAnnDetail(item)"
        >
          <view class="notice-row-main">
            <text class="notice-row-title">{{ item.title }}</text>
            <text v-if="formatAnnTime(item.publishTime)" class="notice-row-time">{{
              formatAnnTime(item.publishTime)
            }}</text>
          </view>
          <text class="notice-row-arrow">›</text>
        </view>
      </view>
    </view>

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
  min-height: 100vh;
  padding: 32rpx 32rpx 48rpx;
  box-sizing: border-box;
}

.hero {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  padding: 40rpx 36rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid $pms-border;
  background: linear-gradient(145deg, $pms-surface 0%, $pms-bg-deep 100%);
}

.hero-orb {
  position: absolute;
  right: -80rpx;
  top: -80rpx;
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  background: radial-gradient(circle, $pms-accent-soft 0%, transparent 70%);
  pointer-events: none;
}

.hero-inner {
  position: relative;
  z-index: 1;
}

.brand {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: $pms-accent;
  margin-bottom: 12rpx;
}

.title {
  display: block;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 44rpx;
  font-weight: 700;
  color: $pms-text;
  letter-spacing: 0.02em;
}

.greet {
  display: block;
  margin-top: 20rpx;
  font-size: 26rpx;
  color: $pms-text-muted;
  line-height: 1.5;
}

.ctx-block {
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid $pms-border;
}

.ctx-row {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 20rpx;
}

.ctx-row:last-of-type {
  margin-bottom: 0;
}

.ctx-label {
  font-size: 22rpx;
  color: $pms-text-dim;
  letter-spacing: 0.02em;
}

.ctx-value {
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-text;
  line-height: 1.45;
  word-break: break-all;
}

.ctx-value-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  min-width: 0;
}

.ctx-value--grow {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctx-hint {
  font-size: 22rpx;
  color: $pms-text-dim;
  line-height: 1.4;
}

.ctx-hint--below {
  display: block;
  margin-top: 8rpx;
}

.btn-switch {
  flex-shrink: 0;
  padding: 14rpx 32rpx;
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
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-accent;
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.menu-card {
  @include pms-card;
  @include pms-tap;
  padding: 24rpx 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.icon-wrap {
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  background: $pms-accent-soft;
  border: 1rpx solid rgba(56, 189, 248, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14rpx;
}

.icon-char {
  font-size: 28rpx;
  font-weight: 700;
  color: $pms-accent;
}

.menu-label {
  font-size: 24rpx;
  font-weight: 600;
  color: $pms-text;
  line-height: 1.3;
}

.menu-hint {
  margin-top: 6rpx;
  font-size: 18rpx;
  color: $pms-text-dim;
  line-height: 1.3;
}

.notice-module {
  @include pms-card;
  padding: 24rpx 20rpx 8rpx;
  margin-top: 8rpx;
}

.notice-head {
  padding: 0 8rpx 18rpx;
  border-bottom: 1rpx solid $pms-border;
  margin-bottom: 4rpx;
}

.notice-title {
  font-size: 30rpx;
  font-weight: 700;
  color: $pms-text;
  padding-left: 16rpx;
  border-left: 6rpx solid $pms-accent;
}

.notice-state {
  text-align: center;
  padding: 44rpx 20rpx 52rpx;
  font-size: 26rpx;
  color: $pms-text-dim;
}

.notice-list {
  padding-bottom: 8rpx;
}

.notice-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 24rpx 10rpx;
  border-bottom: 1rpx solid $pms-border;
}

.notice-row:last-child {
  border-bottom: none;
}

.notice-row--hover {
  opacity: 0.88;
}

.notice-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.notice-row-title {
  font-size: 28rpx;
  font-weight: 600;
  color: $pms-text;
  line-height: 1.35;
}

.notice-row-time {
  font-size: 22rpx;
  color: $pms-text-dim;
}

.notice-row-arrow {
  flex-shrink: 0;
  font-size: 32rpx;
  color: $pms-text-dim;
  line-height: 1;
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
