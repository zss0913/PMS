<template>
  <view class="container">
    <view class="logo-box">
      <view class="logo">员</view>
      <view class="app-name">{{ about.appName || '物业员工端' }}</view>
      <view class="version">版本号：{{ displayVersion }}</view>
    </view>

    <view class="desc-card">
      <view class="title">关于我们</view>
      <view class="content">{{ about.aboutText || '暂无介绍' }}</view>
    </view>

    <view class="desc-card meta-card">
      <view class="row"><text class="k">物业公司</text><text class="v">{{ about.companyName || '—' }}</text></view>
      <view class="row"><text class="k">联系人</text><text class="v">{{ about.contact || '—' }}</text></view>
      <view class="row"><text class="k">联系电话</text><text class="v">{{ about.phone || '—' }}</text></view>
      <view class="row"><text class="k">地址</text><text class="v">{{ about.address || '—' }}</text></view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { get } from '../../utils/request.js'
import { APP_VERSION } from '../../config/app.js'

const displayVersion = ref('v' + APP_VERSION)
const about = reactive({
  appName: '物业员工端',
  version: APP_VERSION,
  companyName: '',
  contact: '',
  phone: '',
  address: '',
  aboutText: '',
})

onMounted(async () => {
  try {
    const res = await get('/api/mp/about')
    if (res.success && res.data) {
      Object.assign(about, res.data)
      displayVersion.value = 'v' + (res.data.version || APP_VERSION)
    }
  } catch (_) {}

  try {
    if (typeof uni.getAccountInfoSync === 'function') {
      const a = uni.getAccountInfoSync()
      if (a && a.miniProgram && a.miniProgram.version) {
        displayVersion.value = 'v' + a.miniProgram.version
      }
    }
  } catch (_) {}
})
</script>

<style lang="scss" scoped>
.container {
  padding: 40rpx;
}
.logo-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 60rpx;
  margin-bottom: 80rpx;
  .logo {
    width: 160rpx;
    height: 160rpx;
    background-color: #2979ff;
    color: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 30rpx;
    font-size: 48rpx;
    font-weight: bold;
  }
  .app-name {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    margin-top: 30rpx;
  }
  .version {
    font-size: 28rpx;
    color: #999;
    margin-top: 16rpx;
  }
}
.desc-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
  margin-bottom: 24rpx;
  .title {
    font-size: 32rpx;
    font-weight: bold;
    margin-bottom: 20rpx;
    text-align: center;
  }
  .content {
    font-size: 28rpx;
    color: #666;
    line-height: 1.8;
    text-indent: 2em;
  }
}
.meta-card {
  .row {
    display: flex;
    justify-content: space-between;
    gap: 24rpx;
    margin-bottom: 20rpx;
  }
  .row:last-child {
    margin-bottom: 0;
  }
  .k {
    width: 140rpx;
    font-size: 28rpx;
    color: #666;
  }
  .v {
    flex: 1;
    text-align: right;
    font-size: 28rpx;
    color: #333;
    word-break: break-all;
  }
}
</style>
