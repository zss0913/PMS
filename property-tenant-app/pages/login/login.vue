<template>
  <view class="login-container">
    <view :style="{ height: statusBarHeight + 'px' }"></view>

    <view class="title">租客端登录</view>

    <u-tabs :list="tabList" :current="tabIndex" @click="onTabClick"></u-tabs>

    <view v-if="tabIndex === 0" class="form-box">
      <u-form :model="form" ref="uForm">
        <u-form-item label="手机号" prop="mobile" labelWidth="80">
          <u-input v-model="form.mobile" placeholder="请输入手机号" type="number" border="bottom" maxlength="11" />
        </u-form-item>
        <u-form-item label="密码" prop="password" labelWidth="80">
          <u-input v-model="form.password" placeholder="请输入密码" type="password" border="bottom" password />
        </u-form-item>
      </u-form>
      <u-button
        type="primary"
        class="login-btn"
        :loading="loading"
        :disabled="loading"
        @click="handleLogin"
        shape="circle"
      >
        {{ loading ? '登录中…' : '登录' }}
      </u-button>
    </view>

    <view v-else class="form-box">
      <view class="invite-tip">使用物业发放的邀请码加入对应租客主体；邀请码一次性使用。已注册账号需填写正确密码。</view>
      <u-form :model="inviteForm" labelWidth="80">
        <u-form-item label="邀请码" prop="code">
          <u-input v-model="inviteForm.code" placeholder="请输入或扫描邀请码" border="bottom">
            <template #suffix>
              <u-icon name="scan" size="24" color="#2979ff" @click="handleScan"></u-icon>
            </template>
          </u-input>
        </u-form-item>
        <u-form-item label="手机号" prop="mobile">
          <u-input v-model="inviteForm.mobile" placeholder="用于绑定账号" type="number" border="bottom" maxlength="11" />
        </u-form-item>
        <u-form-item label="密码" prop="password">
          <u-input
            v-model="inviteForm.password"
            placeholder="新用户设密码 / 老用户填登录密码"
            type="password"
            border="bottom"
            password
          />
        </u-form-item>
        <u-form-item label="姓名" prop="name">
          <u-input v-model="inviteForm.name" placeholder="新用户可选填" border="bottom" />
        </u-form-item>
      </u-form>
      <u-button
        type="primary"
        class="login-btn"
        :loading="loading"
        :disabled="loading"
        @click="handleInviteLogin"
        shape="circle"
      >
        {{ loading ? '处理中…' : '验证并加入' }}
      </u-button>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useUserStore } from '../../stores/user.js'
import { post } from '../../utils/request.js'
import { getSystemInfoCompat } from '../../utils/system-info.js'

const userStore = useUserStore()
const statusBarHeight = ref(20)
const loading = ref(false)
const tabIndex = ref(0)
const tabList = ref([{ name: '账号密码' }, { name: '邀请码' }])

const form = reactive({
  mobile: '',
  password: '',
})

const inviteForm = reactive({
  code: '',
  mobile: '',
  password: '',
  name: '',
})

onMounted(() => {
  const sysInfo = getSystemInfoCompat()
  statusBarHeight.value = sysInfo.statusBarHeight || 20
})

function onTabClick(e) {
  tabIndex.value = e.index
}

function handleScan() {
  uni.scanCode({
    success: (res) => {
      inviteForm.code = String(res.result || '')
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase()
    },
    fail: () => {
      uni.showToast({ title: '无法调起扫码', icon: 'none' })
    },
  })
}

async function handleInviteLogin() {
  if (!inviteForm.code || !inviteForm.mobile || !inviteForm.password) {
    uni.showToast({ title: '请填写邀请码、手机号与密码', icon: 'none' })
    return
  }
  if (inviteForm.password.length < 6) {
    uni.showToast({ title: '密码至少 6 位', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await post('/api/mp/invite-login', {
      code: inviteForm.code.trim(),
      phone: inviteForm.mobile.trim(),
      password: inviteForm.password,
      ...(inviteForm.name && inviteForm.name.trim() ? { name: inviteForm.name.trim() } : {}),
    })
    if (!res.success || !res.token || !res.user) {
      throw new Error(res.message || '加入失败')
    }
    userStore.token = res.token
    userStore.user = res.user
    uni.setStorageSync('pms_token', res.token)
    uni.setStorageSync('mp_company_id', res.user.companyId)
    uni.setStorageSync('mp_tenant_user_id', res.user.id)
    uni.setStorageSync('mp_pref_phone', res.user.phone)
    uni.setStorageSync('mp_pref_tenant_user_id', String(res.user.id))
    uni.setStorageSync('mp_pref_company_id', String(res.user.companyId))
    await userStore.fetchUser()
    uni.showToast({ title: '加入成功' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 400)
  } catch (e) {
    const msg = e && e.message ? e.message : '加入失败'
    uni.showToast({ title: msg, icon: 'none', duration: 3000 })
  } finally {
    loading.value = false
  }
}

async function handleLogin(opts) {
  if (!form.mobile || !form.password) {
    uni.showToast({ title: '请输入手机号和密码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const result = await userStore.login(form.mobile, form.password, opts?.companyId, opts?.tenantUserId)
    if (result && result.needCompany && result.companies && result.companies.length) {
      uni.showActionSheet({
        itemList: result.companies.map((c) => c.companyName),
        success: (e) => {
          const c = result.companies[e.tapIndex]
          if (c) void handleLogin({ companyId: c.companyId })
        },
      })
      return
    }
    uni.showToast({ title: '登录成功' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/index/index' })
    }, 400)
  } catch (e) {
    const msg = e && e.message ? e.message : '登录失败'
    uni.showToast({ title: msg, icon: 'none', duration: 3000 })
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
  .invite-tip {
    font-size: 24rpx;
    color: #909399;
    line-height: 1.5;
    margin-bottom: 24rpx;
  }
  .login-btn {
    margin-top: 60rpx;
    height: 88rpx;
    font-size: 32rpx;
  }
}
</style>
