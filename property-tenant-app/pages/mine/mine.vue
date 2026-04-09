<template>
  <view class="mine-container">
    <view class="user-info" @click="goTo('/pages/profile/profile')">
      <image
        v-if="showAvatarImage"
        class="avatar-image"
        :src="avatarSrc"
        mode="aspectFill"
        @error="handleAvatarError"
      ></image>
      <view v-else class="avatar-fallback">{{ avatarText }}</view>
      <view class="info-text">
        <view class="name">{{ displayName }}</view>
        <view class="phone">{{ userPhone }}</view>
      </view>
      <u-icon name="arrow-right" color="#999" size="16" class="arrow-icon"></u-icon>
    </view>

    <view class="menu-group">
      <u-cell-group :border="false">
        <u-cell icon="home" title="当前租客" :value="tenantLabel" @click="openTenantSwitch" isLink></u-cell>
        <u-cell v-if="showEmployee" icon="account" title="员工管理" isLink @click="goTo('/pages/employee/list')"></u-cell>
      </u-cell-group>
    </view>

    <view class="menu-group">
      <u-cell-group :border="false">
        <u-cell icon="lock" title="修改密码" isLink @click="goTo('/pages/password/password')"></u-cell>
        <u-cell icon="info-circle" title="关于我们" isLink @click="goTo('/pages/about/about')"></u-cell>
      </u-cell-group>
    </view>

    <view class="logout-btn">
      <u-button type="error" text="退出登录" @click="handleLogout"></u-button>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '../../utils/request.js'
import { useUserStore } from '../../stores/user.js'
import { isTenantAdmin } from '../../utils/tenant-role.js'

const userStore = useUserStore()
const showEmployee = computed(() => isTenantAdmin(userStore.user))

const displayName = computed(() => (userStore.user && userStore.user.name) || '未登录')
const userPhone = computed(() => (userStore.user && userStore.user.phone) || '—')
const avatarLoadError = ref(false)
const avatarSrc = computed(() => String(userStore.user?.avatar || userStore.user?.avatarUrl || '').trim())
const showAvatarImage = computed(() => !!avatarSrc.value && !avatarLoadError.value)
const avatarText = computed(() => {
  const n = String(displayName.value || '').trim()
  if (!n) return '租'
  return n.slice(-2)
})

watch(avatarSrc, () => {
  avatarLoadError.value = false
})

function handleAvatarError() {
  avatarLoadError.value = true
}

const tenantLabel = computed(() => {
  const rel = userStore.user && userStore.user.relations
  if (!Array.isArray(rel) || !rel.length) return '—'
  const cur = rel.find((r) => r.tenantId != null)
  return cur && cur.tenantName ? cur.tenantName : '已关联租客'
})

onMounted(() => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
  }
})

onShow(() => {
  if (userStore.token) {
    void userStore.fetchUser()
  }
})

function optionTitle(opt) {
  return opt.tenantName || `租客 #${opt.tenantId}`
}

async function openTenantSwitch() {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  let extra = []
  try {
    const res = await get('/api/mp/tenant-switch-options')
    extra = res.success && Array.isArray(res.data) ? res.data.filter((o) => !o.isCurrent) : []
  } catch {
    extra = []
  }
  if (!extra.length) {
    uni.showToast({ title: '暂无可切换的租客', icon: 'none' })
    return
  }
  uni.showActionSheet({
    itemList: extra.map((o) => `${optionTitle(o)} · ${o.propertyCompanyName || ''}`),
    success: async (res) => {
      const item = extra[res.tapIndex]
      if (!item || !userStore.user) return
      try {
        if (item.tenantUserId !== userStore.user.id) {
          await userStore.switchTenant(item.tenantUserId)
        }
        await userStore.switchActiveTenant(item.tenantId)
        uni.showToast({ title: '已切换' })
        await userStore.fetchUser()
      } catch (e) {
        uni.showToast({ title: (e && e.message) || '切换失败', icon: 'none' })
      }
    },
  })
}

const goTo = (url) => {
  const targetUrl = url.startsWith('/') ? url : '/' + url

  if (
    targetUrl === '/pages/mine/mine' ||
    targetUrl === '/pages/index/index' ||
    targetUrl === '/pages/message/list'
  ) {
    uni.switchTab({ url: targetUrl })
  } else {
    uni.navigateTo({ url: targetUrl })
  }
}

const handleLogout = () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.reLaunch({ url: '/pages/login/login' })
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.mine-container {
  padding: 24rpx;

  .user-info {
    display: flex;
    align-items: center;
    background-color: #fff;
    padding: 40rpx 30rpx;
    border-radius: 16rpx;
    margin-bottom: 24rpx;
    position: relative;

    .avatar-image,
    .avatar-fallback {
      width: 120rpx;
      height: 120rpx;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .avatar-image {
      display: block;
      background: #c0c4cc;
    }

    .avatar-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #c0c4cc;
      color: #fff;
      font-size: 32rpx;
      font-weight: 600;
      line-height: 1;
    }

    .info-text {
      margin-left: 30rpx;
      flex: 1;

      .name {
        font-size: 36rpx;
        font-weight: bold;
        color: #333;
      }

      .phone {
        font-size: 28rpx;
        color: #999;
        margin-top: 10rpx;
      }
    }

    .arrow-icon {
      position: absolute;
      right: 30rpx;
    }
  }

  .menu-group {
    background-color: #fff;
    border-radius: 16rpx;
    margin-bottom: 24rpx;
    overflow: hidden;
  }

  .logout-btn {
    margin-top: 60rpx;
  }
}
</style>
