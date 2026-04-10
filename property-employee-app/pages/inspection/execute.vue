<template>
  <view class="wrap" />
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app'

/** 执行巡检已合并到「巡检详情」页，旧入口重定向，避免两套逻辑 */
onLoad((q) => {
  const id = q.id
  if (!id) {
    uni.showToast({ title: '缺少任务 ID', icon: 'none' })
    return
  }
  uni.redirectTo({
    url: '/pages/inspection/detail?id=' + encodeURIComponent(String(id)),
  })
})
</script>

<style scoped>
.wrap {
  min-height: 40vh;
}
</style>
