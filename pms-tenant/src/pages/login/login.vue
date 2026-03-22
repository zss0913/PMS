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
    <view class="decor">
      <view class="decor-ring" />
    </view>
    <view class="panel">
      <text class="panel-brand">PMS TENANT</text>
      <text class="panel-title">租客登录</text>
      <text class="panel-desc">账单、报修与公告统一入口</text>
      <view class="form">
        <view class="input-wrap">
          <text class="field-label">手机号</text>
          <input
            v-model="phone"
            type="number"
            placeholder="请输入手机号"
            placeholder-class="ph"
            maxlength="11"
            class="input"
          />
        </view>
        <view class="input-wrap">
          <text class="field-label">密码</text>
          <input
            v-model="password"
            type="password"
            placeholder="请输入密码"
            placeholder-class="ph"
            class="input"
          />
        </view>
        <button class="btn" :disabled="loading" :class="{ disabled: loading }" @click="() => handleLogin()">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 48rpx 40rpx 80rpx;
  position: relative;
  overflow: hidden;
}

.decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.decor-ring {
  position: absolute;
  top: -120rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 600rpx;
  height: 600rpx;
  border-radius: 50%;
  background: radial-gradient(circle, $pms-accent-soft 0%, transparent 55%);
  opacity: 0.9;
}

.panel {
  position: relative;
  z-index: 1;
  margin-top: 80rpx;
  @include pms-card;
  padding: 56rpx 40rpx 48rpx;
}

.panel-brand {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 0.28em;
  color: $pms-accent;
  margin-bottom: 20rpx;
}

.panel-title {
  display: block;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 44rpx;
  font-weight: 700;
  color: $pms-text;
}

.panel-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: $pms-text-muted;
  margin-bottom: 48rpx;
}

.form {
  .input-wrap {
    margin-bottom: 36rpx;
  }
  .field-label {
    display: block;
    font-size: 24rpx;
    color: $pms-text-muted;
    margin-bottom: 12rpx;
  }
  .input {
    height: 96rpx;
    padding: 0 28rpx;
    background: $pms-bg-deep;
    border-radius: 16rpx;
    border: 1rpx solid $pms-border;
    font-size: 28rpx;
    color: $pms-text;
  }
  .btn {
    margin-top: 24rpx;
    height: 96rpx;
    line-height: 96rpx;
    background: linear-gradient(135deg, $pms-accent 0%, #0ea5e9 100%);
    color: #fff;
    border-radius: 16rpx;
    font-size: 32rpx;
    font-weight: 600;
    border: none;
    @include pms-tap;
  }
  .btn.disabled {
    opacity: 0.55;
  }
}
</style>
