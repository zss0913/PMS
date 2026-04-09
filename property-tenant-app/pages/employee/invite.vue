<template>
  <view class="page">
    <view v-if="!isAdmin" class="deny">
      <u-empty mode="list" text="仅租户管理员可邀请员工" margin-top="80"></u-empty>
    </view>
    <template v-else>
      <view class="card">
        <view class="card-title">邀请员工</view>
        <text class="desc">生成一次性邀请码后会展示二维码，新成员可在登录页「邀请码」页签点击扫一扫加入。</text>
        <view class="code-box">
          <view v-if="inviteCode" class="qr-wrapper">
            <u-qrcode :val="inviteCode" :size="220" />
            <text class="code-tip">打开登录页邀请码登录，点击右侧扫一扫即可识别</text>
            <text class="code">{{ inviteCode }}</text>
          </view>
          <text v-else class="code-placeholder">点击下方生成邀请码二维码</text>
        </view>
        <u-button type="primary" :loading="codeLoading" @click="generateCode">生成邀请码</u-button>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useUserStore } from '../../stores/user.js'
import { isTenantAdmin } from '../../utils/tenant-role.js'
import { post } from '../../utils/request.js'

const userStore = useUserStore()
const inviteCode = ref('')
const codeLoading = ref(false)

const isAdmin = computed(() => isTenantAdmin(userStore.user))

const activeTenantId = computed(() => {
  const r = userStore.user && Array.isArray(userStore.user.relations) && userStore.user.relations[0]
  return r ? r.tenantId : null
})

onMounted(async () => {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  await userStore.fetchUser()
})

async function generateCode() {
  const tid = activeTenantId.value
  if (!tid) {
    uni.showToast({ title: '无法确定当前租客', icon: 'none' })
    return
  }
  codeLoading.value = true
  try {
    const res = await post('/api/mp/tenant-invite-codes', { tenantId: tid })
    if (!res.success || !res.data || !res.data.code) {
      throw new Error(res.message || '生成失败')
    }
    inviteCode.value = res.data.code
    uni.showToast({ title: '二维码已生成' })
  } catch (e) {
    uni.showToast({ title: (e && e.message) || '生成失败', icon: 'none' })
  } finally {
    codeLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  padding: 24rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

.deny {
  padding-top: 40rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
}

.desc {
  display: block;
  font-size: 26rpx;
  color: #909399;
  line-height: 1.5;
  margin-bottom: 20rpx;
}

.code-box {
  padding: 24rpx;
  background: #f5f7fa;
  border-radius: 12rpx;
  margin-bottom: 20rpx;

  .qr-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20rpx;
  }

  .code-tip {
    font-size: 24rpx;
    color: #606266;
    text-align: center;
    line-height: 1.5;
  }

  .code {
    font-size: 28rpx;
    color: #2979ff;
    font-family: monospace;
    word-break: break-all;
    text-align: center;
  }

  .code-placeholder {
    display: block;
    font-size: 28rpx;
    color: #909399;
    text-align: center;
  }
}
</style>
