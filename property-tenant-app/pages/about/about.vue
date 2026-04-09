<template>
  <view class="container">
    <view class="logo-box">
      <view class="logo">租</view>
      <view class="app-name">物业租客端</view>
      <view class="version">版本号：{{ displayVersion }}</view>
    </view>

    <view class="desc-card">
      <view class="content">
        本应用为写字楼物业租客提供报事报修、卫生吐槽、公告与账单查询等服务。具体能力以物业公司开通范围为准。
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { APP_VERSION } from '../../config/app.js'

const displayVersion = ref('v' + APP_VERSION)

onMounted(() => {
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
  margin-top: 40rpx;
  margin-bottom: 60rpx;
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
</style>
