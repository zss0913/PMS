<template>
  <view class="container">
    <view v-if="loading" class="hint">加载中…</view>
    <view v-else-if="!wo" class="hint">工单不存在</view>
    <template v-else>
      <view class="card">
        <view class="card-title">工单信息</view>
        <view class="kv"><text class="k">标题</text><text class="v">{{ wo.title }}</text></view>
        <view class="kv"><text class="k">编号</text><text class="v">{{ wo.code }}</text></view>
        <view class="kv"><text class="k">状态</text><text class="v status">{{ wo.status }}</text></view>
        <view class="kv"><text class="k">类型</text><text class="v">{{ wo.type }}</text></view>
        <view class="kv"><text class="k">位置</text><text class="v">{{ wo.room ? `${wo.building?.name || ''} ${wo.room.roomNumber || ''}` : (wo.location || wo.building?.name || '—') }}</text></view>
        <view class="kv"><text class="k">租客</text><text class="v">{{ wo.tenant?.companyName || '—' }}</text></view>
        <view class="kv"><text class="k">提交人</text><text class="v">{{ reporterText }}</text></view>
        <view class="kv"><text class="k">处理人</text><text class="v">{{ assigneeText }}</text></view>
        <view class="kv"><text class="k">提交时间</text><text class="v">{{ formatTime(wo.createdAt) }}</text></view>
        <view class="desc-box">
          <view class="label">问题描述</view>
          <view class="text">{{ wo.description || '—' }}</view>
        </view>
        <view v-if="imageUrls.length" class="photos">
          <image v-for="(item, index) in imageUrls" :key="index" :src="item" class="thumb" mode="aspectFill" @click="previewImages(imageUrls, index)" />
        </view>
      </view>

      <view v-if="wo.status === '待派单' || wo.status === '待响应'" class="card">
        <view class="card-title">派单处理</view>
        <picker :range="employeeNames" :value="employeeIndex" @change="selectEmployee">
          <view class="picker">{{ pickedEmployee ? `已选：${pickedEmployee.name}` : '请选择处理人' }}</view>
        </picker>
        <view class="action-row">
          <u-button type="primary" :loading="assigning" @click="submitAssign">{{ wo.status === '待派单' ? '确认派单' : '确认改派' }}</u-button>
        </view>
        <view v-if="wo.status === '待响应'" class="action-row multi">
          <u-button type="primary" plain :loading="submitting" @click="advance('start_processing')">开始处理</u-button>
          <u-button type="error" plain :loading="submitting" @click="advance('cancel')">取消工单</u-button>
        </view>
        <view v-else class="action-row">
          <u-button type="error" plain :loading="submitting" @click="advance('cancel')">取消工单</u-button>
        </view>
      </view>

      <view v-if="wo.status === '处理中'" class="card">
        <view class="card-title">接单处理</view>
        <view class="process-form">
          <view class="form-section">
            <view class="form-item-title">处理记录</view>
            <view class="form-control">
              <u-textarea v-model="completeRemark" placeholder="请填写处理情况说明..." count></u-textarea>
            </view>
          </view>
          <view class="form-section">
            <view class="form-item-title">现场照片</view>
            <view class="form-control">
              <view class="upload-row">
                <u-button size="small" type="primary" plain @click="chooseCompleteImages">上传图片</u-button>
                <text class="upload-tip">至少 1 张，最多 10 张</text>
              </view>
              <view v-if="completeImageUrls.length" class="photos">
                <view v-for="(item, index) in completeImageUrls" :key="index" class="photo-wrap">
                  <image :src="item" class="thumb" mode="aspectFill" @click="previewImages(completeImageUrls, index)" />
                  <view class="remove" @click="removeCompleteImage(index)">×</view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="action-row">
          <u-button type="primary" :loading="submitting" @click="completeWorkOrder">完成工单</u-button>
        </view>
        <view class="fee-box">
          <view class="fee-title">如本次处理产生费用</view>
          <u-input v-model="feeTotal" placeholder="请输入费用合计（元）" type="digit" border="surround"></u-input>
          <view class="spacer"></view>
          <u-textarea v-model="feeRemark" placeholder="请输入费用说明" count></u-textarea>
          <view class="action-row multi">
            <u-button type="warning" plain :loading="submitting" @click="requestFee">提交费用待确认</u-button>
            <u-button type="primary" plain :loading="submitting" @click="advance('no_fee_continue')">无费用继续</u-button>
          </view>
        </view>
      </view>

      <view v-if="wo.status === '待员工确认费用'" class="card">
        <view class="card-title">费用确认</view>
        <view class="desc-box compact">
          <view class="label">费用说明</view>
          <view class="text">{{ wo.feeRemark || '—' }}</view>
          <view class="text total">费用合计：{{ wo.feeTotal != null ? `${wo.feeTotal} 元` : '—' }}</view>
        </view>
        <view class="action-row">
          <u-button type="primary" :loading="submitting" @click="advance('publish_fee_for_tenant')">确认并发给租客</u-button>
        </view>
      </view>

      <view v-if="wo.status === '待评价'" class="card">
        <view class="card-title">评价完成</view>
        <u-textarea v-model="evaluationContent" placeholder="可填写评价说明（选填）" count></u-textarea>
        <view class="action-row">
          <u-button type="primary" :loading="submitting" @click="advance('mark_evaluated', { evaluationContent })">标记评价完成</u-button>
        </view>
      </view>

      <view v-if="completionImageUrlsResolved.length" class="card">
        <view class="card-title">办结照片</view>
        <view class="photos">
          <image v-for="(item, index) in completionImageUrlsResolved" :key="index" :src="item" class="thumb" mode="aspectFill" @click="previewImages(completionImageUrlsResolved, index)" />
        </view>
      </view>

      <view v-if="activityLogs.length" class="card">
        <view class="card-title">处理日志</view>
        <view v-for="item in activityLogs" :key="item.id" class="log-item">
          <view class="log-summary">{{ item.summary || item.action }}</view>
          <view class="log-meta">{{ item.operatorName || '系统' }} · {{ formatTime(item.createdAt) }}</view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { get, post, resolveMediaUrl } from '../../utils/request.js'
import { uploadWorkOrderImage } from '../../utils/work-order-upload.js'
import { formatDateTime } from '../../utils/datetime.js'

const workOrderId = ref(0)
const loading = ref(true)
const assigning = ref(false)
const submitting = ref(false)
const wo = ref(null)
const employees = ref([])
const activityLogs = ref([])
const pickedEmployeeId = ref(null)
const completeRemark = ref('')
const completeImageRawUrls = ref([])
const feeRemark = ref('')
const feeTotal = ref('')
const evaluationContent = ref('')

const employeeNames = computed(() => employees.value.map((item) => `${item.name}${item.phone ? ` · ${item.phone}` : ''}`))
const employeeIndex = computed(() => {
  if (pickedEmployeeId.value == null) return 0
  const idx = employees.value.findIndex((item) => item.id === pickedEmployeeId.value)
  return idx < 0 ? 0 : idx
})
const pickedEmployee = computed(() => employees.value.find((item) => item.id === pickedEmployeeId.value) || null)
const imageUrls = computed(() => (wo.value?.imageUrls || []).map((item) => resolveMediaUrl(item)).filter(Boolean))
const completionImageUrlsResolved = computed(() => (wo.value?.completionImageUrls || []).map((item) => resolveMediaUrl(item)).filter(Boolean))
const completeImageUrls = computed(() => completeImageRawUrls.value.map((item) => resolveMediaUrl(item)).filter(Boolean))
const reporterText = computed(() => {
  if (!wo.value?.reporter) return '—'
  const row = wo.value.reporter
  return `${row.name || '—'}${row.phone ? ` (${row.phone})` : ''}`
})
const assigneeText = computed(() => {
  if (!wo.value?.assignedEmployee) return '未派单'
  return `${wo.value.assignedEmployee.name}${wo.value.assignedEmployee.phone ? ` (${wo.value.assignedEmployee.phone})` : ''}`
})

/**
 * @param {{ preserveDrafts?: boolean, silent?: boolean }} opts
 * - preserveDrafts: onShow 等场景保留用户未提交的输入（避免选图后 onShow 触发整页重载把表单清空）
 * - silent: 不展示全屏「加载中」，避免闪屏
 */
async function loadDetail(opts = {}) {
  if (!workOrderId.value) return
  const preserveDrafts = opts.preserveDrafts === true
  const silent = opts.silent === true
  const prevStatus = wo.value?.status
  if (!silent) {
    loading.value = true
  }
  try {
    const res = await get(`/api/mp/work-orders/${workOrderId.value}`)
    if (!res.success || !res.workOrder) {
      throw new Error(res.message || '加载失败')
    }
    const next = res.workOrder
    wo.value = next
    employees.value = Array.isArray(res.employees) ? res.employees : []
    activityLogs.value = Array.isArray(res.activityLogs) ? res.activityLogs : []
    pickedEmployeeId.value = next.assignedTo || null

    const preserveProcessing =
      preserveDrafts && prevStatus === '处理中' && next.status === '处理中'
    const preserveEval =
      preserveDrafts && prevStatus === '待评价' && next.status === '待评价'

    if (!preserveProcessing) {
      feeRemark.value = next.feeRemark || ''
      feeTotal.value = next.feeTotal != null ? String(next.feeTotal) : ''
      completeRemark.value = next.completionRemark || ''
      completeImageRawUrls.value = []
    }

    if (!preserveEval) {
      evaluationContent.value = next.evaluationNote || ''
    }
  } catch (e) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' })
    wo.value = null
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

onLoad((options) => {
  const id = parseInt(String(options.id || ''), 10)
  if (!id) {
    uni.showToast({ title: '无效工单', icon: 'none' })
    return
  }
  workOrderId.value = id
  void loadDetail()
})

onShow(() => {
  if (workOrderId.value) {
    void loadDetail({ preserveDrafts: true, silent: true })
  }
})

function selectEmployee(e) {
  const index = Number(e.detail.value)
  const row = employees.value[index]
  if (row) pickedEmployeeId.value = row.id
}

async function submitAssign() {
  if (!pickedEmployeeId.value) {
    uni.showToast({ title: '请选择处理人', icon: 'none' })
    return
  }
  assigning.value = true
  try {
    const res = await post(`/api/mp/work-orders/${workOrderId.value}/assign`, { assignedTo: pickedEmployeeId.value })
    if (!res.success) throw new Error(res.message || '派单失败')
    uni.showToast({ title: '已更新', icon: 'success' })
    await loadDetail()
  } catch (e) {
    uni.showToast({ title: e?.message || '派单失败', icon: 'none' })
  } finally {
    assigning.value = false
  }
}

async function advance(action, extra = {}) {
  if (submitting.value) return
  submitting.value = true
  try {
    const res = await post(`/api/mp/work-orders/${workOrderId.value}/advance`, { action, ...extra })
    if (!res.success) throw new Error(res.message || '操作失败')
    uni.showToast({ title: '已更新', icon: 'success' })
    await loadDetail()
  } catch (e) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function chooseCompleteImages() {
  const remain = 10 - completeImageRawUrls.value.length
  if (remain <= 0) {
    uni.showToast({ title: '最多 10 张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: Math.min(remain, 9),
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const files = res.tempFilePaths || []
      try {
        uni.showLoading({ title: '上传中' })
        for (const filePath of files) {
          const url = await uploadWorkOrderImage(filePath)
          completeImageRawUrls.value = [...completeImageRawUrls.value, url]
        }
      } catch (e) {
        uni.showToast({ title: e?.message || '上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
  })
}

function removeCompleteImage(index) {
  completeImageRawUrls.value.splice(index, 1)
}

async function completeWorkOrder() {
  if (!completeRemark.value.trim()) {
    uni.showToast({ title: '请填写处理记录', icon: 'none' })
    return
  }
  if (completeImageRawUrls.value.length < 1) {
    uni.showToast({ title: '请至少上传 1 张现场照片', icon: 'none' })
    return
  }
  await advance('complete_for_evaluation', {
    completionRemark: completeRemark.value.trim(),
    completionImages: completeImageRawUrls.value,
  })
}

async function requestFee() {
  if (!feeRemark.value.trim()) {
    uni.showToast({ title: '请填写费用说明', icon: 'none' })
    return
  }
  if (!feeTotal.value.trim()) {
    uni.showToast({ title: '请填写费用合计', icon: 'none' })
    return
  }
  await advance('request_fee_confirmation', {
    feeRemark: feeRemark.value.trim(),
    feeTotal: feeTotal.value.trim(),
  })
}

function previewImages(urls, index) {
  uni.previewImage({ current: urls[index], urls })
}

function formatTime(v) {
  return formatDateTime(v, '')
}
</script>

<style lang="scss" scoped>
.container {
  padding: 24rpx;
}
.hint {
  text-align: center;
  padding: 60rpx 24rpx;
  color: #909399;
}
.card {
  background-color: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.card-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}
.kv {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14rpx;
  gap: 20rpx;
}
.k {
  width: 150rpx;
  font-size: 26rpx;
  color: #666;
}
.v {
  flex: 1;
  text-align: right;
  font-size: 26rpx;
  color: #333;
  word-break: break-all;
}
.v.status {
  color: #2979ff;
}
.desc-box {
  margin-top: 20rpx;
}
.desc-box.compact {
  margin-top: 0;
}
.label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 10rpx;
}
.text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
}
.text.total {
  margin-top: 16rpx;
  color: #e43d33;
}
.photos {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 20rpx;
}
.thumb {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f5f6f7;
}
.photo-wrap {
  position: relative;
}
.remove {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 26rpx;
}
.picker {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  background: #f8f8f8;
  color: #333;
}
.action-row {
  margin-top: 24rpx;
}
.action-row.multi {
  display: flex;
  gap: 16rpx;
}
.process-form {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  width: 100%;
}

.form-section {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.form-control {
  width: 100%;
  min-width: 0;
}

.upload-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
  width: 100%;
}
.form-item-title {
  font-size: 26rpx;
  color: #666;
  line-height: 1.4;
  margin-bottom: 12rpx;
  white-space: nowrap;
}
.upload-tip {
  font-size: 24rpx;
  color: #999;
  line-height: 1.4;
}
.fee-box {
  margin-top: 30rpx;
  padding-top: 24rpx;
  border-top: 1rpx dashed #eee;
}
.fee-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 16rpx;
}
.spacer {
  height: 16rpx;
}
.log-item {
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f2f2f2;
}
.log-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.log-summary {
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}
.log-meta {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999;
}
</style>
