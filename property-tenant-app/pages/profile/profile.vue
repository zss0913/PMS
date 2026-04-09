<template>
  <view class="container">
    <view class="info-list">
      <u-cell-group>
        <u-cell title="姓名" :value="userName"></u-cell>
        <u-cell title="手机号" :value="phone"></u-cell>
        <u-cell title="角色" :value="roleLabel"></u-cell>
        <u-cell title="所属租客" :value="tenantLine"></u-cell>
      </u-cell-group>
    </view>
  </view>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useUserStore } from '../../stores/user.js'
import { isTenantAdmin } from '../../utils/tenant-role.js'

const userStore = useUserStore()

const roleLabel = computed(() => (isTenantAdmin(userStore.user) ? '租户管理员' : '租客成员'))

const userName = computed(() => (userStore.user && userStore.user.name) || '—')
const phone = computed(() => (userStore.user && userStore.user.phone) || '—')
const tenantLine = computed(() => {
  const rel = userStore.user && userStore.user.relations
  if (!Array.isArray(rel) || !rel.length) return '—'
  return rel
    .map((r) => r.tenantName || `租客#${r.tenantId}`)
    .filter(Boolean)
    .join('、')
})

onMounted(() => {
  if (userStore.token) {
    void userStore.fetchUser()
  }
})
</script>

<style lang="scss" scoped>
.container {
  padding: 20rpx 0;
  .info-list {
    background-color: #fff;
  }
}
</style>
