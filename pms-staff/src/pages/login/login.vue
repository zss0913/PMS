<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const phone = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!phone.value || !password.value) {
    uni.showToast({ title: '请输入手机号和密码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await userStore.login(phone.value, password.value)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      // index 为 tabBar 页，必须用 switchTab，navigateTo 会静默失败导致停留在登录页
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
  <view class="page login-page">
    <view class="decor">
      <view class="decor-ring" />
    </view>
    <view class="panel">
      <text class="panel-brand">PMS STAFF</text>
      <text class="panel-title">员工登录</text>
      <text class="panel-desc">安全接入物业运营工作台</text>
      <view class="form">
        <view class="input-wrap">
          <text class="field-label">手机号</text>
          <view class="input-shell">
            <input
              v-model="phone"
              type="number"
              placeholder="请输入手机号"
              placeholder-class="input-ph"
              maxlength="11"
              class="login-field"
              style="background: transparent; background-color: rgba(0,0,0,0); color: #ffffff; -webkit-text-fill-color: #ffffff"
            />
          </view>
        </view>
        <view class="input-wrap">
          <text class="field-label">密码</text>
          <view class="input-shell">
            <input
              v-model="password"
              type="password"
              placeholder="请输入密码"
              placeholder-class="input-ph"
              class="login-field"
              style="background: transparent; background-color: rgba(0,0,0,0); color: #ffffff; -webkit-text-fill-color: #ffffff"
            />
          </view>
        </view>
        <button class="btn" :disabled="loading" :class="{ disabled: loading }" @click="handleLogin">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
/* 告知浏览器使用深色表单控件，避免 Chrome/Safari 给 input 铺浅色底 */
.page.login-page {
  min-height: 100vh;
  padding: 48rpx 40rpx 80rpx;
  position: relative;
  overflow: hidden;
  color-scheme: dark;
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
  .input-shell {
    height: 96rpx;
    padding: 0 28rpx;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    background: $pms-bg-deep;
    border-radius: 16rpx;
    border: 1rpx solid $pms-border;
    color-scheme: dark;
    /* uni H5：占位符常为独立 .uni-input-placeholder，勿对 wrapper 统一设字色，否则与真值叠影 */
    :deep(input),
    :deep(.uni-input-input) {
      flex: 1;
      width: 100% !important;
      min-width: 0 !important;
      min-height: 0;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      background: transparent !important;
      background-color: rgba(0, 0, 0, 0) !important;
      box-shadow: none !important;
      font-size: 30rpx !important;
      font-weight: 600 !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: $pms-accent !important;
      line-height: 1.25 !important;
      position: relative;
      z-index: 1;
    }
    :deep(.uni-input-wrapper) {
      display: flex !important;
      align-items: center;
      flex: 1;
      min-width: 0;
      background: transparent !important;
    }
    :deep(.uni-input-placeholder) {
      color: #64748b !important;
      -webkit-text-fill-color: #64748b !important;
      font-size: 28rpx !important;
      font-weight: 400 !important;
      pointer-events: none;
      z-index: 0;
    }
    :deep(.uni-input-wrapper:has(input:not(:placeholder-shown)) .uni-input-placeholder),
    :deep(.uni-input-wrapper:has(.uni-input-input:not(:placeholder-shown)) .uni-input-placeholder) {
      opacity: 0 !important;
      visibility: hidden !important;
    }
  }
  .login-field {
    flex: 1;
    width: 100%;
    height: 96rpx;
    min-height: 0;
    padding: 0;
    margin: 0;
    background: transparent !important;
    background-color: rgba(0, 0, 0, 0) !important;
    border: none !important;
    border-radius: 0;
    font-size: 30rpx;
    font-weight: 600;
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    caret-color: $pms-accent;
    line-height: 1.25;
  }
  .btn {
    margin-top: 24rpx;
    height: 96rpx;
    line-height: 96rpx;
    background: linear-gradient(135deg, $pms-accent 0%, #16a34a 100%);
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

<style lang="scss">
.input-ph {
  color: #64748b;
  font-size: 28rpx;
  font-weight: 400;
}
</style>

<style lang="scss">
/* H5：原生 input 与自动填充（部分浏览器需单独写死选择器） */
.login-page input.login-field,
.login-page .input-shell input {
  -webkit-appearance: none !important;
  appearance: none !important;
  outline: none !important;
  background: transparent !important;
  background-color: rgba(0, 0, 0, 0) !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}
.login-page input.login-field:-webkit-autofill,
.login-page input.login-field:-webkit-autofill:hover,
.login-page input.login-field:-webkit-autofill:focus,
.login-page input.login-field:-webkit-autofill:active,
.login-page .input-shell input:-webkit-autofill,
.login-page .input-shell input:-webkit-autofill:hover,
.login-page .input-shell input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #020617 inset !important;
  box-shadow: 0 0 0 1000px #020617 inset !important;
  -webkit-text-fill-color: #ffffff !important;
  caret-color: #22c55e;
  transition: background-color 99999s ease-out;
}
</style>
