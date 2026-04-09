<template>
  <view class="container">
    <view class="form-card">
      <u-form :model="form" labelWidth="80">
        <u-form-item label="原密码" prop="oldPassword">
          <u-input v-model="form.oldPassword" type="password" placeholder="请输入原密码" border="none"></u-input>
        </u-form-item>
        <u-form-item label="新密码" prop="newPassword">
          <u-input v-model="form.newPassword" type="password" placeholder="请输入新密码" border="none"></u-input>
        </u-form-item>
        <u-form-item label="确认密码" prop="confirmPassword">
          <u-input v-model="form.confirmPassword" type="password" placeholder="请再次输入新密码" border="none"></u-input>
        </u-form-item>
      </u-form>

      <view class="tip">修改成功后需重新登录。</view>

      <view class="action-btn">
        <u-button type="primary" text="确认修改" :loading="submitting" @click="submitModify"></u-button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { post } from '../../utils/request.js'
import { useUserStore } from '../../stores/user.js'

const userStore = useUserStore()
const submitting = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const submitModify = async () => {
  if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  if (form.newPassword.length < 6) {
    uni.showToast({ title: '新密码至少 6 位', icon: 'none' })
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    uni.showToast({ title: '两次密码不一致', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const res = await post('/api/mp/change-password', {
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    })
    if (!res.success) {
      throw new Error(res.message || '修改失败')
    }
    userStore.logout()
    uni.showToast({ title: '密码已修改，请重新登录', icon: 'none', duration: 1500 })
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/login/login' })
    }, 1500)
  } catch (e) {
    uni.showToast({ title: e?.message || '修改失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  .form-card {
    background-color: #fff;
    border-radius: 12rpx;
    padding: 30rpx;
    .tip {
      font-size: 24rpx;
      color: #909399;
      line-height: 1.5;
      margin: 24rpx 0;
    }
    .action-btn {
      margin-top: 40rpx;
    }
  }
}
</style>
