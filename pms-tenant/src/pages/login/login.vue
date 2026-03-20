<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const phone = ref('')
const password = ref('')
const loading = ref(false)

type LoginOpts = { companyId?: number; tenantUserId?: number }

async function handleLogin(opts?: LoginOpts) {
  if (!phone.value || !password.value) {
    uni.showToast({ title: '请输入手机号和密码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const result = await userStore.login(
      phone.value,
      password.value,
      opts?.companyId,
      opts?.tenantUserId
    )
    if (result && 'needCompany' in result && result.needCompany) {
      uni.showActionSheet({
        itemList: result.companies.map((c) => c.companyName),
        success: async (e) => {
          const c = result.companies[e.tapIndex]
          if (c) await handleLogin({ companyId: c.companyId })
        },
      })
      return
    }
    if (result && 'needTenantUser' in result && result.needTenantUser) {
      uni.showActionSheet({
        itemList: result.tenantUsers.map((u) => {
          const tenants = u.tenants.map((t) => t.companyName).join('、')
          return `${u.companyName} · ${u.name}${tenants ? `（${tenants}）` : ''}`
        }),
        success: async (e) => {
          const u = result.tenantUsers[e.tapIndex]
          if (u) await handleLogin({ companyId: u.companyId, tenantUserId: u.id })
        },
      })
      return
    }
    uni.showToast({ title: '登录成功' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 500)
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || '登录失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="form">
      <view class="input-wrap">
        <input v-model="phone" type="number" placeholder="手机号" maxlength="11" class="input" />
      </view>
      <view class="input-wrap">
        <input v-model="password" type="password" placeholder="密码" class="input" />
      </view>
      <button class="btn" :disabled="loading" @click="() => handleLogin()">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 80rpx 60rpx;
}
.form {
  .input-wrap {
    margin-bottom: 32rpx;
  }
  .input {
    height: 88rpx;
    padding: 0 24rpx;
    background: #f5f5f5;
    border-radius: 12rpx;
    font-size: 28rpx;
  }
  .btn {
    margin-top: 60rpx;
    height: 88rpx;
    line-height: 88rpx;
    background: #007aff;
    color: #fff;
    border-radius: 12rpx;
    font-size: 32rpx;
  }
}
</style>
