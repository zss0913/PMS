<template>
  <view class="login-container">
    <view :style="{ height: statusBarHeight + 'px' }"></view>

    <view class="title">物业员工端</view>

    <view class="form-box">
      <u-form :model="form">
        <u-form-item label="手机号" prop="mobile" labelWidth="80">
          <u-input v-model="form.mobile" placeholder="请输入手机号" type="number" border="bottom" maxlength="11" />
        </u-form-item>
        <u-form-item label="密码" prop="password" labelWidth="80">
          <u-input v-model="form.password" placeholder="请输入密码" type="password" border="bottom" password />
        </u-form-item>
        <u-form-item>
          <u-checkbox-group v-model="form.rememberMe" placement="row">
            <u-checkbox name="1" label="记住密码" shape="square"></u-checkbox>
          </u-checkbox-group>
        </u-form-item>
      </u-form>
      <u-button type="primary" class="login-btn" :loading="loading" :disabled="loading" @click="handleLogin" shape="circle">
      {{ loading ? '登录中…' : '登录' }}
      </u-button>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useUserStore } from '../../stores/user.js'

const REMEMBER_PHONE_KEY = 'employee_remember_phone'
const REMEMBER_PASSWORD_KEY = 'employee_remember_password'
const REMEMBER_FLAG_KEY = 'employee_remember_flag'

const userStore = useUserStore()
const statusBarHeight = ref(20)
const loading = ref(false)

const form = reactive({
  mobile: '',
  password: '',
  rememberMe: [],
})

function fillRemembered() {
  const remember = uni.getStorageSync(REMEMBER_FLAG_KEY) === '1'
  form.rememberMe = remember ? ['1'] : []
  form.mobile = remember ? String(uni.getStorageSync(REMEMBER_PHONE_KEY) || '') : ''
  form.password = remember ? String(uni.getStorageSync(REMEMBER_PASSWORD_KEY) || '') : ''
}

function saveRemembered() {
  const remember = form.rememberMe.includes('1')
  if (remember) {
    uni.setStorageSync(REMEMBER_FLAG_KEY, '1')
    uni.setStorageSync(REMEMBER_PHONE_KEY, form.mobile.trim())
    uni.setStorageSync(REMEMBER_PASSWORD_KEY, form.password)
    return
  }
  uni.removeStorageSync(REMEMBER_FLAG_KEY)
  uni.removeStorageSync(REMEMBER_PHONE_KEY)
  uni.removeStorageSync(REMEMBER_PASSWORD_KEY)
}

onMounted(async () => {
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 20
  fillRemembered()
  if (userStore.token) {
    const user = await userStore.fetchUser()
    if (user) {
      uni.switchTab({ url: '/pages/index/index' })
    }
  }
})

async function handleLogin() {
  if (!form.mobile.trim() || !form.password) {
    uni.showToast({ title: '请输入手机号和密码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await userStore.login(form.mobile.trim(), form.password)
    saveRemembered()
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 400)
  } catch (e) {
    uni.showToast({ title: e?.message || '登录失败', icon: 'none', duration: 2500 })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-container {
  padding: 40rpx 60rpx;
  background-color: #fff;
  min-height: 100vh;
  box-sizing: border-box;
  .title {
    font-size: 56rpx;
    font-weight: bold;
    margin-top: 40rpx;
    margin-bottom: 40rpx;
    text-align: center;
    color: #333;
  }
  .form-box {
    margin-top: 24rpx;
  }
  .login-btn {
    margin-top: 60rpx;
    height: 88rpx;
    font-size: 32rpx;
  }
}
</style>
