<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { get, post, patch, del } from '@/api/request'

type Member = {
  relationId: number
  tenantUserId: number
  name: string
  phone: string
  status: string
  isAdmin: boolean
  lastLoginAt: string | null
}

const userStore = useUserStore()
const list = ref<Member[]>([])
const loading = ref(false)
const selectedTenantId = ref(0)
const inviteOpen = ref(false)
const inviteCode = ref('')
const inviteExpires = ref('')

const adminTenants = computed(() => {
  const rels = userStore.user?.relations ?? []
  const map = new Map<number, string>()
  for (const r of rels) {
    if (r.isAdmin && r.tenantId) {
      map.set(r.tenantId, r.tenantName || `租客 #${r.tenantId}`)
    }
  }
  return Array.from(map.entries()).map(([tenantId, tenantName]) => ({ tenantId, tenantName }))
})

const currentTenantName = computed(() => {
  const t = adminTenants.value.find((x) => x.tenantId === selectedTenantId.value)
  return t?.tenantName ?? ''
})

const pickerIndex = computed(() => {
  const i = adminTenants.value.findIndex((x) => x.tenantId === selectedTenantId.value)
  return Math.max(0, i)
})

const currentUserId = computed(() => userStore.user?.id ?? 0)

onShow(async () => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  await userStore.fetchUser()
  const tenants = adminTenants.value
  if (tenants.length === 0) {
    uni.showToast({ title: '暂无权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 500)
    return
  }
  if (!selectedTenantId.value || !tenants.some((t) => t.tenantId === selectedTenantId.value)) {
    selectedTenantId.value = tenants[0]!.tenantId
  }
  await loadList()
})

function onPickTenant(e: { detail: { value: string } }) {
  const i = parseInt(e.detail.value, 10)
  const row = adminTenants.value[i]
  if (row && row.tenantId !== selectedTenantId.value) {
    selectedTenantId.value = row.tenantId
    void loadList()
  }
}

async function loadList() {
  const tid = selectedTenantId.value
  if (!tid) return
  loading.value = true
  try {
    const res = (await get('/api/mp/tenant-employees', { tenantId: String(tid) })) as {
      success?: boolean
      list?: Member[]
      message?: string
    }
    if (!res.success) {
      uni.showToast({ title: res.message || '加载失败', icon: 'none' })
      list.value = []
      return
    }
    list.value = Array.isArray(res.list) ? res.list : []
  } catch (e: unknown) {
    uni.showToast({ title: (e as Error)?.message || '加载失败', icon: 'none' })
    list.value = []
  } finally {
    loading.value = false
  }
}

async function generateInvite() {
  const tid = selectedTenantId.value
  if (!tid) return
  try {
    const res = (await post('/api/mp/tenant-invite-codes', { tenantId: tid })) as {
      success?: boolean
      data?: { code: string; expiresAt?: string | null }
      message?: string
    }
    if (!res.success || !res.data?.code) {
      uni.showToast({ title: res.message || '生成失败', icon: 'none' })
      return
    }
    inviteCode.value = res.data.code
    inviteExpires.value = res.data.expiresAt ? formatDate(res.data.expiresAt) : ''
    inviteOpen.value = true
  } catch (e: unknown) {
    uni.showToast({ title: (e as Error)?.message || '生成失败', icon: 'none' })
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function copyCode() {
  if (!inviteCode.value) return
  uni.setClipboardData({
    data: inviteCode.value,
    success: () => uni.showToast({ title: '已复制', icon: 'none' }),
  })
}

function closeInvite() {
  inviteOpen.value = false
}

function confirmRemove(m: Member) {
  if (m.tenantUserId === currentUserId.value) {
    uni.showToast({ title: '不能移除本人', icon: 'none' })
    return
  }
  uni.showModal({
    title: '移除成员',
    content: `确定将「${m.name}」从本租客主体移除？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        const r = (await del(`/api/mp/tenant-employees/${m.tenantUserId}`, {
          tenantId: String(selectedTenantId.value),
        })) as { success?: boolean; message?: string }
        if (!r.success) {
          uni.showToast({ title: r.message || '操作失败', icon: 'none' })
          return
        }
        uni.showToast({ title: '已移除', icon: 'none' })
        await loadList()
      } catch (e: unknown) {
        uni.showToast({ title: (e as Error)?.message || '操作失败', icon: 'none' })
      }
    },
  })
}

function toggleDisable(m: Member) {
  if (m.tenantUserId === currentUserId.value) {
    uni.showToast({ title: '不能禁用本人', icon: 'none' })
    return
  }
  const next = m.status === 'active' ? 'disabled' : 'active'
  const tip = next === 'disabled' ? '禁用后该账号将无法登录' : '确定重新启用该账号？'
  uni.showModal({
    title: next === 'disabled' ? '禁用账号' : '启用账号',
    content: tip,
    success: async (res) => {
      if (!res.confirm) return
      try {
        const r = (await patch(`/api/mp/tenant-employees/${m.tenantUserId}`, {
          tenantId: selectedTenantId.value,
          status: next,
        })) as { success?: boolean; message?: string }
        if (!r.success) {
          uni.showToast({ title: r.message || '操作失败', icon: 'none' })
          return
        }
        uni.showToast({ title: '已更新', icon: 'none' })
        await loadList()
      } catch (e: unknown) {
        uni.showToast({ title: (e as Error)?.message || '操作失败', icon: 'none' })
      }
    },
  })
}

function toggleAdmin(m: Member) {
  if (m.tenantUserId === currentUserId.value) {
    uni.showToast({ title: '不能调整本人的管理员身份', icon: 'none' })
    return
  }
  const next = !m.isAdmin
  uni.showModal({
    title: next ? '设为管理员' : '取消管理员',
    content: next ? '确定将其设为管理员？' : '确定取消其管理员身份？',
    success: async (res) => {
      if (!res.confirm) return
      try {
        const r = (await patch(`/api/mp/tenant-employees/${m.tenantUserId}`, {
          tenantId: selectedTenantId.value,
          isAdmin: next,
        })) as { success?: boolean; message?: string }
        if (!r.success) {
          uni.showToast({ title: r.message || '操作失败', icon: 'none' })
          return
        }
        uni.showToast({ title: '已更新', icon: 'none' })
        await loadList()
      } catch (e: unknown) {
        uni.showToast({ title: (e as Error)?.message || '操作失败', icon: 'none' })
      }
    },
  })
}
</script>

<template>
  <view class="page">
    <view v-if="adminTenants.length > 1" class="tenant-pick">
      <text class="pick-label">租客主体</text>
      <picker
        mode="selector"
        :range="adminTenants"
        range-key="tenantName"
        :value="pickerIndex"
        @change="onPickTenant"
      >
        <view class="pick-value">{{ currentTenantName }}</view>
      </picker>
    </view>

    <view class="toolbar">
      <button class="btn-invite" @click="generateInvite">生成邀请码</button>
    </view>

    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="list.length === 0" class="hint">暂无成员</view>
    <view v-else class="list">
      <view v-for="m in list" :key="m.relationId" class="card">
        <view class="row-top">
          <text class="m-name">{{ m.name }}</text>
          <text v-if="m.isAdmin" class="tag admin">管理员</text>
          <text v-if="m.status !== 'active'" class="tag off">已禁用</text>
        </view>
        <text class="m-phone">{{ m.phone }}</text>
        <view v-if="m.tenantUserId !== currentUserId" class="actions">
          <button class="link" @click="toggleAdmin(m)">{{ m.isAdmin ? '取消管理员' : '设管理员' }}</button>
          <button class="link" @click="toggleDisable(m)">{{ m.status === 'active' ? '禁用' : '启用' }}</button>
          <button class="link danger" @click="confirmRemove(m)">移除</button>
        </view>
        <text v-else class="self-hint">当前登录账号</text>
      </view>
    </view>

    <view v-if="inviteOpen" class="mask" @click="closeInvite">
      <view class="dialog" @click.stop>
        <text class="dlg-title">邀请码</text>
        <text class="dlg-code">{{ inviteCode }}</text>
        <text v-if="inviteExpires" class="dlg-sub">有效期至 {{ inviteExpires }}</text>
        <text class="dlg-tip">新成员在登录页使用邀请码即可加入本租客主体</text>
        <view class="dlg-btns">
          <button class="dlg-btn secondary" @click="closeInvite">关闭</button>
          <button class="dlg-btn primary" @click="copyCode">复制</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx 32rpx 48rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.tenant-pick {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.pick-label {
  font-size: 26rpx;
  color: $pms-text-muted;
}
.pick-value {
  flex: 1;
  padding: 16rpx 24rpx;
  border-radius: 12rpx;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
  color: $pms-text;
  font-size: 28rpx;
}

.toolbar {
  margin-bottom: 24rpx;
}
.btn-invite {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  color: #fff;
  font-size: 28rpx;
  border: none;
}

.hint {
  text-align: center;
  color: $pms-text-muted;
  padding: 48rpx 0;
  font-size: 26rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card {
  @include pms-card;
  padding: 24rpx;
}

.row-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}
.m-name {
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
}
.tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.tag.admin {
  background: rgba(14, 165, 233, 0.2);
  color: #7dd3fc;
}
.tag.off {
  background: rgba(248, 113, 113, 0.15);
  color: #fca5a5;
}
.m-phone {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-top: 8rpx;
}

.self-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 22rpx;
  color: $pms-text-dim;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 20rpx;
}
.link {
  padding: 0 12rpx;
  height: 56rpx;
  line-height: 56rpx;
  font-size: 24rpx;
  background: transparent;
  color: $pms-accent;
  border: 1rpx solid rgba(56, 189, 248, 0.4);
  border-radius: 10rpx;
}
.link.danger {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.45);
}

.mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}
.dialog {
  width: 100%;
  max-width: 600rpx;
  background: $pms-surface;
  border-radius: 20rpx;
  padding: 32rpx;
  border: 1rpx solid $pms-border;
}
.dlg-title {
  display: block;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: $pms-text;
}
.dlg-code {
  display: block;
  text-align: center;
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
  color: #7dd3fc;
  margin: 24rpx 0;
  word-break: break-all;
}
.dlg-sub {
  display: block;
  text-align: center;
  font-size: 22rpx;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
}
.dlg-tip {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  line-height: 1.5;
  margin-bottom: 24rpx;
}
.dlg-btns {
  display: flex;
  gap: 16rpx;
}
.dlg-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: none;
}
.dlg-btn.secondary {
  background: $pms-bg-deep;
  color: $pms-text-muted;
}
.dlg-btn.primary {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  color: #fff;
}
</style>
