<template>
  <view class="wrap"></view>
</template>

<script setup>
import { onShow } from '@dcloudio/uni-app'

onShow(() => {
  uni.switchTab({ url: '/pages/messages/messages' })
})
</script>

<style scoped>
.wrap {
  min-height: 100vh;
  background: #0f172a;
}
</style>
