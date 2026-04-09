<template>
  <view class="container">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="errMsg" class="hint">{{ errMsg }}</view>
    <template v-else-if="wo">
      <view class="info-card">
        <view class="title-row">
          <text class="t">{{ wo.title }}</text>
          <u-tag :text="wo.status" size="mini" type="primary"></u-tag>
        </view>
        <view class="detail-meta">
          <view class="meta-row">
            <text class="meta-label">工单号</text>
            <text class="meta-value">{{ wo.code || '—' }}</text>
          </view>
          <view class="meta-row">
            <text class="meta-label">类型</text>
            <text class="meta-value">{{ wo.type || '—' }}</text>
          </view>
          <view v-if="wo.facilityScope" class="meta-row">
            <text class="meta-label">设施范围</text>
            <text class="meta-value">{{ wo.facilityScope }}</text>
          </view>
          <view class="meta-row">
            <text class="meta-label">提交时间</text>
            <text class="meta-value">{{ fmtTime(wo.createdAt) }}</text>
          </view>
        </view>
        <view class="desc-box">
          <view class="label">问题描述</view>
          <view class="text">{{ wo.description }}</view>
        </view>
        <view v-if="wo.imageUrls && wo.imageUrls.length" class="imgs">
          <image
            v-for="(u, i) in wo.imageUrls"
            :key="i"
            :src="resolveMediaUrl(u)"
            mode="aspectFill"
            class="img"
            @click="previewImg(wo.imageUrls, i)"
          />
        </view>
      </view>

      <view v-if="feePay && wo.status === '待租客确认费用'" class="fee-card">
        <view class="sub-title">费用确认</view>
        <view class="fee-caption">请先完成在线支付，维修将继续推进</view>
        <view class="fee-amount-label">待缴费用</view>
        <view class="fee-amount">¥{{ fmtMoney(feePay.amountDue) }}</view>
        <view class="fee-meta">账单编号：{{ feePay.billCode }}</view>
        <view v-if="feePay.pendingPayment" class="fee-pending">
          已生成支付单 {{ feePay.pendingPayment.code }}，如支付结果稍有延迟，请稍后刷新页面。
        </view>
        <view class="fee-actions">
          <view class="fee-action fee-action-refuse">
            <u-button size="small" plain type="error" :disabled="actionBusy" @click="refuseFee">拒绝支付</u-button>
          </view>
          <view class="fee-action fee-action-pay">
            <u-button size="small" type="success" :loading="actionBusy" @click="checkoutFee('wechat')">微信支付</u-button>
          </view>
        </view>
      </view>

      <view v-if="showTenantCancel" class="card">
        <u-button type="error" plain @click="confirmCancel">取消工单</u-button>
      </view>

      <view v-if="showPendingEval" class="card">
        <view class="sub-title">服务评价</view>
        <view class="rate-row">
          <text class="rate-label">服务星级</text>
          <u-rate v-model="evalStars" :count="5" activeColor="#f3a73f"></u-rate>
        </view>
        <u-textarea v-model="evalDraft" placeholder="选填评价内容" count maxlength="500"></u-textarea>
        <u-button type="primary" class="mt" :loading="evalBusy" @click="submitEval">提交评价</u-button>
      </view>

      <view v-if="canEditBasics && false" class="card">
        <view class="sub-title">修改工单（未结束）</view>
        <u-input v-model="editTitle" placeholder="标题" border="surround"></u-input>
        <u-textarea v-model="editDescription" class="mt" placeholder="描述" count maxlength="2000"></u-textarea>
        <view class="mt photo-row">
          <view v-for="(u, idx) in editImageUrls" :key="idx" class="thumb-wrap">
            <image :src="resolveMediaUrl(u)" mode="aspectFill" class="thumb" @click="previewImg(editImageUrls, idx)" />
            <text class="rm" @click.stop="editImageUrls.splice(idx, 1)">×</text>
          </view>
          <view class="add-pho" @click="addEditPhotos">+</view>
        </view>
        <u-button type="primary" class="mt" :loading="savingEdit" @click="saveEdit">保存修改</u-button>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, put } from '../../utils/request.js'
import { resolveMediaUrl, uploadWorkOrderImage } from '../../utils/work-order-upload.js'
import { formatDateTime } from '../../utils/datetime.js'
import { useUserStore } from '../../stores/user.js'

const userStore = useUserStore()
const loading = ref(true)
const errMsg = ref('')
const id = ref(0)
const wo = ref(null)
const feePay = ref(null)
const actionBusy = ref(false)
const evalDraft = ref('')
const evalStars = ref(5)
const evalBusy = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const editImageUrls = ref([])
const savingEdit = ref(false)
const uploadingEdit = ref(false)

const canEditBasics = computed(
  () => wo.value && !['评价完成', '已取消'].includes(wo.value.status)
)
const showTenantCancel = computed(
  () => wo.value && ['待派单', '待响应'].includes(wo.value.status)
)
const showPendingEval = computed(() => {
  if (!wo.value || wo.value.status !== '待评价') return false
  const s = (wo.value.source && String(wo.value.source).trim()) || ''
  return s === '租客自建' || s === '租客端'
})

function fmtTime(iso) {
  return formatDateTime(iso)
}

function fmtMoney(v) {
  return Number(v || 0).toFixed(2)
}

function previewImg(urls, index) {
  const u = urls.map((x) => resolveMediaUrl(x))
  uni.previewImage({ urls: u, current: u[index] })
}

async function load() {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  loading.value = true
  errMsg.value = ''
  try {
    const res = await get(`/api/mp/work-orders/${id.value}`)
    if (res.success && res.workOrder) {
      wo.value = {
        ...res.workOrder,
        imageUrls: Array.isArray(res.workOrder.imageUrls) ? res.workOrder.imageUrls : [],
      }
      editTitle.value = res.workOrder.title
      editDescription.value = res.workOrder.description
      editImageUrls.value = [...(res.workOrder.imageUrls || [])]
      if (res.workOrder.status === '待租客确认费用') {
        await prepareFeePay()
      } else {
        feePay.value = null
      }
    } else {
      wo.value = null
      errMsg.value = res.message || '加载失败'
    }
  } catch {
    wo.value = null
    errMsg.value = '网络错误'
  } finally {
    loading.value = false
  }
}

async function prepareFeePay() {
  try {
    const res = await post(`/api/mp/work-orders/${id.value}/fee-payment/prepare`, {})
    if (res.success && res.data && res.data.bill) {
      const b = res.data.bill
      feePay.value = {
        billId: b.id,
        billCode: b.code,
        amountDue: b.amountDue,
        pendingPayment: res.data.pendingPayment || null,
      }
    } else {
      feePay.value = null
    }
  } catch {
    feePay.value = null
  }
}

function runWxLogin() {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        if (res.code) {
          resolve(res.code)
        } else {
          reject(new Error('未获取到微信登录凭证'))
        }
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || '微信登录失败'))
      },
    })
  })
}

function runRequestPayment(payParams) {
  return new Promise((resolve, reject) => {
    uni.requestPayment({
      provider: 'wxpay',
      ...payParams,
      success: resolve,
      fail: reject,
    })
  })
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function refreshAfterPaySuccess() {
  await load()
  if (!wo.value || wo.value.status !== '待租客确认费用') return
  uni.showToast({ title: '支付结果确认中', icon: 'none' })
  for (let i = 0; i < 2; i++) {
    await wait(1200)
    await load()
    if (!wo.value || wo.value.status !== '待租客确认费用') return
  }
}

async function checkoutFee(channel) {
  if (channel !== 'wechat' || !feePay.value || actionBusy.value) return
  actionBusy.value = true
  try {
    const loginCode = await runWxLogin()
    const res = await post(`/api/mp/work-orders/${id.value}/fee-payment/checkout`, {
      billId: feePay.value.billId,
      channel,
      loginCode,
    })
    if (!res.success || !res.data || !res.data.payment || !res.data.wechatPayParams) {
      uni.showToast({ title: res.message || '拉起支付失败', icon: 'none' })
      return
    }
    const p = res.data.payment
    feePay.value = {
      ...feePay.value,
      pendingPayment: {
        id: p.id,
        code: p.code,
        paymentMethod: p.paymentMethod,
        paymentStatus: 'pending',
      },
    }
    await runRequestPayment(res.data.wechatPayParams)
    uni.showToast({ title: '支付成功', icon: 'success' })
    await refreshAfterPaySuccess()
  } catch (e) {
    const msg = (e && e.errMsg) || (e && e.message) || ''
    if (msg.includes('cancel')) {
      uni.showToast({ title: '已取消支付', icon: 'none' })
      return
    }
    uni.showToast({ title: msg || '微信支付失败', icon: 'none', duration: 2500 })
  } finally {
    actionBusy.value = false
  }
}

function refuseFee() {
  uni.showModal({
    title: '拒绝付费',
    content: '确定拒绝？工单可能被取消。',
    success: (r) => {
      if (r.confirm) void doRefuseFee()
    },
  })
}

async function doRefuseFee() {
  actionBusy.value = true
  try {
    const res = await post(`/api/mp/work-orders/${id.value}/refuse-fee`, {})
    if (res.success) {
      uni.showToast({ title: '已操作', icon: 'success' })
      await load()
    } else {
      uni.showToast({ title: res.message || '失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    actionBusy.value = false
  }
}

async function submitEval() {
  if (evalBusy.value) return
  evalBusy.value = true
  try {
    const star = Number(evalStars.value) || 0
    const text = evalDraft.value.trim()
    const starPart = star >= 1 && star <= 5 ? `【${star}星】` : ''
    const evaluationContent = `${starPart}${text}`.trim() || undefined
    const res = await post(`/api/mp/work-orders/${id.value}/advance`, {
      action: 'submit_tenant_evaluation',
      evaluationContent,
    })
    if (res.success) {
      uni.showToast({ title: '已提交', icon: 'success' })
      evalDraft.value = ''
      evalStars.value = 5
      await load()
    } else {
      uni.showToast({ title: res.message || '失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    evalBusy.value = false
  }
}

function confirmCancel() {
  uni.showModal({
    title: '提示',
    content: '确定取消该工单？',
    success: (r) => {
      if (r.confirm) void tenantCancel()
    },
  })
}

async function tenantCancel() {
  actionBusy.value = true
  try {
    const res = await post(`/api/mp/work-orders/${id.value}/advance`, { action: 'cancel' })
    if (res.success) {
      uni.showToast({ title: '已取消', icon: 'success' })
      await load()
    } else {
      uni.showToast({ title: res.message || '失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    actionBusy.value = false
  }
}

async function saveEdit() {
  const t = editTitle.value.trim()
  if (!t) {
    uni.showToast({ title: '标题不能为空', icon: 'none' })
    return
  }
  savingEdit.value = true
  try {
    const res = await put(`/api/mp/work-orders/${id.value}`, {
      title: t,
      description: editDescription.value.trim(),
      images: editImageUrls.value.length > 0 ? JSON.stringify(editImageUrls.value) : null,
    })
    if (res.success) {
      uni.showToast({ title: '已保存', icon: 'success' })
      await load()
    } else {
      uni.showToast({ title: res.message || '失败', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    savingEdit.value = false
  }
}

function addEditPhotos() {
  const remain = 10 - editImageUrls.value.length
  if (remain <= 0) return
  uni.chooseImage({
    count: remain,
    success: (res) => {
      const paths = res.tempFilePaths || []
      void (async () => {
        uploadingEdit.value = true
        try {
          for (const fp of paths) {
            if (editImageUrls.value.length >= 10) break
            const url = await uploadWorkOrderImage(fp)
            editImageUrls.value = [...editImageUrls.value, url]
          }
        } catch (e) {
          uni.showToast({ title: (e && e.message) || '上传失败', icon: 'none' })
        } finally {
          uploadingEdit.value = false
        }
      })()
    },
  })
}

onLoad((query) => {
  const n = parseInt(String(query.id || ''), 10)
  if (!Number.isFinite(n) || n <= 0) {
    errMsg.value = '无效的工单'
    loading.value = false
    return
  }
  id.value = n
  void userStore.fetchUser()
  void load()
})
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
  padding-bottom: 60rpx;
}
.hint {
  text-align: center;
  padding: 80rpx 24rpx;
  color: #909399;
}
.info-card,
.fee-card,
.card {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
  .t {
    font-size: 34rpx;
    font-weight: bold;
    color: #333;
    flex: 1;
    margin-right: 16rpx;
  }
}
.detail-meta {
  margin-bottom: 8rpx;
}
.meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  padding: 20rpx 0;
}
.meta-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  flex-shrink: 0;
}
.meta-value {
  font-size: 30rpx;
  color: #606266;
  text-align: right;
  line-height: 1.5;
}
.desc-box {
  padding: 16rpx 0;
  .label {
    font-size: 26rpx;
    color: #909399;
    margin-bottom: 8rpx;
  }
  .text {
    font-size: 28rpx;
    color: #333;
    line-height: 1.5;
  }
}
.imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  .img {
    width: 200rpx;
    height: 200rpx;
    border-radius: 8rpx;
  }
}
.sub-title {
  font-size: 30rpx;
  font-weight: bold;
  margin-bottom: 16rpx;
}
.fee-card {
  text-align: center;
}
.fee-caption {
  font-size: 24rpx;
  color: #909399;
  margin-bottom: 16rpx;
}
.fee-amount-label {
  font-size: 26rpx;
  color: #606266;
  margin-bottom: 8rpx;
}
.fee-amount {
  font-size: 68rpx;
  line-height: 1.2;
  font-weight: 700;
  color: #e43d33;
  margin-bottom: 12rpx;
}
.fee-meta {
  font-size: 24rpx;
  color: #909399;
  margin-bottom: 12rpx;
}
.fee-pending {
  font-size: 24rpx;
  color: #e6a23c;
  line-height: 1.5;
  margin-bottom: 20rpx;
}
.fee-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.fee-action {
  min-width: 0;
  :deep(.u-button) {
    width: 100%;
  }
}
.fee-action-refuse {
  flex: 1;
}
.fee-action-pay {
  flex: 2;
}
.mt {
  margin-top: 20rpx;
}
.rate-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 20rpx;
  .rate-label {
    font-size: 28rpx;
    color: #606266;
  }
}
.photo-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
  .thumb-wrap {
    width: 140rpx;
    height: 140rpx;
    position: relative;
    .thumb {
      width: 100%;
      height: 100%;
      border-radius: 8rpx;
    }
    .rm {
      position: absolute;
      top: -6rpx;
      right: -6rpx;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      width: 36rpx;
      height: 36rpx;
      border-radius: 18rpx;
      text-align: center;
      line-height: 36rpx;
    }
  }
  .add-pho {
    width: 140rpx;
    height: 140rpx;
    border: 1rpx dashed #ccc;
    border-radius: 8rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    color: #999;
  }
}
</style>
