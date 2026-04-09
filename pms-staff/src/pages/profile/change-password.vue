<script setup lang="ts">
import { ref } from 'vue'
import { post } from '@/api/request'

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)

async function submit() {
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    uni.showToast({ title: '请填写完整', icon: 'none' })
    return
  }
  if (newPassword.value.length < 6) {
    uni.showToast({ title: '新密码至少 6 位', icon: 'none' })
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    uni.showToast({ title: '两次新密码不一致', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const res = await post('/api/mp/change-password', {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    })
    if (!res.success) {
      uni.showToast({ title: res.message || '修改失败', icon: 'none' })
      return
    }
    uni.showToast({ title: res.message || '密码已更新', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 800)
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message || '请求失败'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="field">
        <text class="label">原密码</text>
        <input
          v-model="oldPassword"
          class="input"
          type="password"
          placeholder="请输入原密码"
          placeholder-class="ph"
        />
      </view>
      <view class="field">
        <text class="label">新密码</text>
        <input
          v-model="newPassword"
          class="input"
          type="password"
          placeholder="至少 6 位"
          placeholder-class="ph"
        />
      </view>
      <view class="field">
        <text class="label">确认新密码</text>
        <input
          v-model="confirmPassword"
          class="input"
          type="password"
          placeholder="再次输入新密码"
          placeholder-class="ph"
        />
      </view>
      <button class="btn" :disabled="loading" @click="submit">
        {{ loading ? '提交中…' : '保存' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 32rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.card {
  @include pms-card;
  padding: 32rpx;
}

.field {
  margin-bottom: 28rpx;
}

.label {
  display: block;
  font-size: 24rpx;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
}

.input {
  width: 100%;
  box-sizing: border-box;
  padding: 22rpx 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: rgba(15, 23, 42, 0.6);
  color: $pms-text;
  font-size: 28rpx;
}

.ph {
  color: $pms-text-dim;
}

.btn {
  margin-top: 16rpx;
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
  font-size: 30rpx;
  border: none;
}
</style>
