<template>
  <view class="page">
    <view v-if="!isAdmin" class="deny">
      <u-empty mode="list" text="仅租户管理员可使用员工管理" margin-top="80"></u-empty>
    </view>
    <template v-else>
      <view class="card employee-card">
        <view v-if="listLoading" class="muted">加载中…</view>
        <view v-else-if="!members.length" class="muted">暂无成员</view>
        <view v-else class="member-list">
          <view v-for="m in members" :key="m.relationId" class="swipe-item">
            <view v-if="m.tenantUserId !== selfId" class="delete-pane" @tap.stop="onSwipeAction(m)">
              <text class="delete-pane__text">删除</text>
            </view>
            <view
              class="member-row"
              :class="{ 'member-row--dragging': touchRowId === m.relationId }"
              :style="rowStyle(m)"
              @touchstart="handleTouchStart(m, $event)"
              @touchmove.stop="handleTouchMove(m, $event)"
              @touchend="handleTouchEnd(m)"
              @touchcancel="handleTouchEnd(m)"
              @tap="handleRowTap(m)"
            >
              <view class="meta">
                <view class="name-line">
                  <text class="name">{{ m.name }}</text>
                  <text class="role-pill">{{ m.isAdmin ? '管理员' : '员工' }}</text>
                </view>
                <text class="phone">{{ m.phone }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="invite-fab-wrap">
        <u-button type="primary" class="invite-fab" @click="goInvitePage">邀请员工</u-button>
      </view>

      <u-modal
        :show="confirmVisible"
        title="删除成员"
        :content="confirmContent"
        showCancelButton
        confirmText="删除"
        cancelText="取消"
        confirmColor="#ff3b30"
        cancelColor="#8e8e93"
        @confirm="confirmRemove"
        @cancel="handleCancelRemove"
        @close="handleCancelRemove"
      ></u-modal>
    </template>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../../stores/user.js'
import { isTenantAdmin } from '../../utils/tenant-role.js'
import { get, del } from '../../utils/request.js'

const userStore = useUserStore()
const listLoading = ref(false)
const members = ref([])
const removingId = ref(null)
const confirmVisible = ref(false)
const pendingMember = ref(null)
const openRowId = ref(null)
const touchRowId = ref(null)
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchStartOffset = ref(0)
const touchOffset = ref(0)
const touchMoved = ref(false)
const suppressTap = ref(false)
const deleteWidthPx = ref(0)

const isAdmin = computed(() => isTenantAdmin(userStore.user))

const selfId = computed(() => (userStore.user && userStore.user.id) || 0)

const activeTenantId = computed(() => {
  const r = userStore.user && Array.isArray(userStore.user.relations) && userStore.user.relations[0]
  return r ? r.tenantId : null
})

const confirmContent = computed(() => {
  const m = pendingMember.value
  return m ? `确定删除「${m.name || m.phone}」吗？删除后将无法再以该成员身份加入当前租客。` : ''
})

onMounted(async () => {
  deleteWidthPx.value = uni.upx2px(180)
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  await userStore.fetchUser()
  if (isTenantAdmin(userStore.user)) {
    await loadMembers()
  }
})

async function loadMembers() {
  const tid = activeTenantId.value
  if (!tid) {
    members.value = []
    return
  }
  listLoading.value = true
  try {
    const res = await get('/api/mp/tenant-employees', { tenantId: tid })
    if (!res.success) throw new Error(res.message || '加载失败')
    members.value = Array.isArray(res.list) ? res.list : []
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '加载失败', icon: 'none' })
    members.value = []
  } finally {
    listLoading.value = false
  }
}

function goInvitePage() {
  uni.navigateTo({ url: '/pages/employee/invite' })
}

function canSwipe(member) {
  return member.tenantUserId !== selfId.value
}

function rowStyle(member) {
  if (!canSwipe(member)) {
    return { transform: 'translateX(0px)' }
  }
  let offset = 0
  if (touchRowId.value === member.relationId) {
    offset = touchOffset.value
  } else if (openRowId.value === member.relationId) {
    offset = -deleteWidthPx.value
  }
  return {
    transform: `translateX(${offset}px)`,
  }
}

function handleTouchStart(member, event) {
  if (!canSwipe(member)) return
  const touch = event.touches && event.touches[0]
  if (!touch) return
  if (openRowId.value && openRowId.value !== member.relationId) {
    openRowId.value = null
  }
  touchRowId.value = member.relationId
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
  touchStartOffset.value = openRowId.value === member.relationId ? -deleteWidthPx.value : 0
  touchOffset.value = touchStartOffset.value
  touchMoved.value = false
}

function handleTouchMove(member, event) {
  if (touchRowId.value !== member.relationId || !canSwipe(member)) return
  const touch = event.touches && event.touches[0]
  if (!touch) return
  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value
  if (!touchMoved.value && Math.abs(deltaX) <= Math.abs(deltaY)) return
  touchMoved.value = true
  const nextOffset = Math.min(0, Math.max(-deleteWidthPx.value, touchStartOffset.value + deltaX))
  touchOffset.value = nextOffset
}

function handleTouchEnd(member) {
  if (touchRowId.value !== member.relationId || !canSwipe(member)) return
  suppressTap.value = touchMoved.value
  const threshold = deleteWidthPx.value / 3
  openRowId.value = touchOffset.value <= -threshold ? member.relationId : null
  touchRowId.value = null
  touchOffset.value = 0
  touchMoved.value = false
}

function handleRowTap(member) {
  if (suppressTap.value) {
    suppressTap.value = false
    return
  }
  if (!canSwipe(member)) return
  if (openRowId.value === member.relationId) {
    openRowId.value = null
    return
  }
  if (openRowId.value) {
    openRowId.value = null
  }
}

function onSwipeAction(member) {
  if (removingId.value || !canSwipe(member)) return
  openRowId.value = null
  pendingMember.value = member
  confirmVisible.value = true
}

function handleCancelRemove() {
  confirmVisible.value = false
  pendingMember.value = null
  openRowId.value = null
  touchRowId.value = null
  touchOffset.value = 0
}

async function confirmRemove() {
  const m = pendingMember.value
  const tid = activeTenantId.value
  if (!m || !tid) {
    confirmVisible.value = false
    return
  }
  removingId.value = m.tenantUserId
  try {
    const res = await del(`/api/mp/tenant-employees/${m.tenantUserId}?tenantId=${tid}`)
    if (!res.success) throw new Error(res.message || '移除失败')
    confirmVisible.value = false
    pendingMember.value = null
    openRowId.value = null
    uni.showToast({ title: '已删除' })
    await loadMembers()
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '移除失败', icon: 'none' })
  } finally {
    removingId.value = null
  }
}

</script>

<style lang="scss" scoped>
.page {
  padding: 0 0 calc(220rpx + env(safe-area-inset-bottom));
  min-height: 100vh;
  box-sizing: border-box;
}

.deny {
  padding-top: 40rpx;
}

.card {
  background: #fff;
  border-radius: 0;
  padding: 0;
  margin-bottom: 24rpx;
  box-shadow: none;
}

.employee-card {
  margin-bottom: 0;
}

.muted {
  font-size: 26rpx;
  color: #909399;
  padding: 24rpx 28rpx;
}

.member-list {
  background: #fff;
}

.swipe-item {
  position: relative;
  overflow: hidden;
  background: #fff;
}

.delete-pane {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 180rpx;
  background: #ff3b30;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-pane__text {
  color: #fff;
  font-size: 28rpx;
}

.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 32rpx 28rpx;
  background: #fff;
  position: relative;
  z-index: 2;
  transition: transform 0.2s ease;

  &--dragging {
    transition: none;
  }

  &::after {
    content: '';
    position: absolute;
    left: 28rpx;
    right: 0;
    bottom: 0;
    height: 1rpx;
    background: #eceef3;
  }

  .meta {
    flex: 1;
    min-width: 0;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: 12rpx;
    flex-wrap: nowrap;
    min-width: 0;
  }

  .name {
    flex: 0 1 auto;
    min-width: 0;
    font-size: 30rpx;
    color: #333;
    font-weight: 500;
    line-height: 1.4;
    word-break: break-all;
  }

  .role-pill {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6rpx 18rpx;
    min-height: 40rpx;
    font-size: 22rpx;
    line-height: 1;
    color: #2979ff;
    background: rgba(41, 121, 255, 0.1);
    border-radius: 999rpx;
    white-space: nowrap;
  }

  .phone {
    font-size: 26rpx;
    color: #666;
    display: block;
    margin-top: 10rpx;
    line-height: 1.4;
  }
}

.swipe-item:last-child .member-row::after {
  display: none;
}

.invite-fab-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 10;
  padding: 16rpx 24rpx 0;
  background: linear-gradient(to top, rgba(245, 246, 247, 1) 60%, rgba(245, 246, 247, 0));
}

.invite-fab {
  height: 88rpx;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 24rpx rgba(41, 121, 255, 0.22);
}
</style>
