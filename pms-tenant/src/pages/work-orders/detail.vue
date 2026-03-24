<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, put } from '@/api/request'
import { useUserStore } from '@/store/user'
import { resolveMediaUrl, uploadWorkOrderImage } from '@/api/work-order-upload'

const MAX_EDIT_IMAGES = 10

const userStore = useUserStore()
const loading = ref(true)
const errMsg = ref('')
const id = ref(0)

/** 与 PC `WorkOrderFlowStepBar` 一致 */
const STEP_LABELS = ['创建', '派单', '响应', '处理', '费用确认', '待评价', '完成'] as const

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '编辑',
  assign: '派单',
  cancel: '取消',
  start_processing: '开始处理',
  request_fee_confirmation: '提交费用（待员工确认）',
  no_fee_continue: '未产生任何费用（继续处理）',
  publish_fee_for_tenant: '送租客确认费用',
  fee_confirm_tenant: '确认费用并在线支付（租客）',
  fee_refuse_tenant: '拒绝付费（租客）',
  complete_for_evaluation: '办结（待评价）',
  mark_evaluated: '评价完成',
  tenant_submit_evaluation: '提交评价（租客）',
}

function getFlowState(status: string): { activeIndex: number; cancelled: boolean } {
  if (status === '已取消') {
    return { activeIndex: -1, cancelled: true }
  }
  const map: Record<string, number> = {
    待派单: 1,
    待响应: 2,
    处理中: 3,
    待员工确认费用: 4,
    待租客确认费用: 4,
    待评价: 5,
    评价完成: 6,
  }
  return { activeIndex: map[status] ?? 0, cancelled: false }
}

type ActivityLogItem = {
  id: number
  action: string
  summary: string | null
  changesJson: string | null
  operatorName: string | null
  operatorPhone: string | null
  createdAt: string
}

type WorkOrderDetail = {
  id: number
  code: string
  title: string
  type: string
  description: string
  status: string
  source?: string
  facilityScope?: string | null
  feeRemark?: string | null
  feeTotal?: number | null
  feeNoticeAcknowledged?: boolean
  location?: string | null
  severity?: string | null
  projectId?: number | null
  taskId?: number | null
  tagId?: number | null
  imageUrls: string[]
  building?: { id: number; name: string } | null
  room?: { id: number; name: string; roomNumber: string } | null
  tenant?: { id: number; companyName: string } | null
  assignedEmployee?: { id: number; name: string; phone: string } | null
  reporter?: { role: string; name: string; phone: string } | null
  reporterId?: number | null
  assignedTo?: number | null
  images?: string | null
  assignedAt: string | null
  respondedAt: string | null
  completedAt: string | null
  evaluatedAt: string | null
  feeConfirmedAt: string | null
  createdAt: string
  updatedAt: string
  completionImageUrls?: string[]
  completionRemark?: string | null
  evaluationNote?: string | null
}

const wo = ref<WorkOrderDetail | null>(null)
const activityLogs = ref<ActivityLogItem[]>([])

type FeePayPrepared = {
  billId: number
  billCode: string
  feeType: string
  period: string
  dueDate: string
  accountReceivable: number
  amountDue: number
  paymentStatus: string
  remark: string | null
  pendingPayment: {
    id: number
    code: string
    paymentMethod: string
    paymentStatus: string
  } | null
}

/** 待租客确认费用：在线支付用账单 + 缴费单 */
const feePay = ref<FeePayPrepared | null>(null)

const actionBusy = ref(false)
const evalDraft = ref('')
const evalBusy = ref(false)
const editing = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const editImageUrls = ref<string[]>([])
const savingEdit = ref(false)
const uploadingEditPhotos = ref(false)

const flowState = computed(() => (wo.value ? getFlowState(wo.value.status) : { activeIndex: 0, cancelled: false }))

const canEditBasics = computed(
  () => wo.value != null && !['评价完成', '已取消'].includes(wo.value.status)
)

const showTenantCancel = computed(
  () => wo.value != null && ['待派单', '待响应'].includes(wo.value.status)
)

const showConfirmFee = computed(
  () => wo.value != null && wo.value.status === '待租客确认费用'
)

const showFeeStaffReview = computed(
  () => wo.value != null && wo.value.status === '待员工确认费用'
)

function isTenantSubmittedSource(src: string | null | undefined): boolean {
  if (!src) return false
  const s = String(src).trim()
  return s === '租客自建' || s === '租客端'
}

const showPendingEval = computed(
  () =>
    wo.value != null &&
    wo.value.status === '待评价' &&
    isTenantSubmittedSource(wo.value.source)
)

/** 待租客确认费用可确认/拒绝；待员工确认费用仅提示；未结束可编辑；仅待派单/待响应可取消；待评价且租客单可提交评价 */
const showFooterBar = computed(
  () =>
    showConfirmFee.value ||
    showFeeStaffReview.value ||
    canEditBasics.value ||
    showTenantCancel.value ||
    showPendingEval.value
)

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

/** 与 PC `WorkOrderLogDescriptionCell` 解析的 changesJson 结构一致 */
type LogChangeEntry = { field: string; label: string; from: string; to: string }

function parseLogChanges(json: string | null): LogChangeEntry[] {
  if (!json?.trim()) return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    return arr.map((raw) => {
      const c = raw as { field?: string; label?: string; from?: string; to?: string }
      return {
        field: c.field ?? '',
        label: c.label ?? c.field ?? '变更',
        from: c.from != null ? String(c.from) : '',
        to: c.to != null ? String(c.to) : '',
      }
    })
  } catch {
    return []
  }
}

function truncateLogText(s: string, max = 160): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function normalizeDialNumber(phone: string | null | undefined): string {
  if (!phone?.trim()) return ''
  return phone.trim().replace(/[\s\u00A0\-–—()（）]/g, '')
}

function dialPhone(phone: string | null | undefined) {
  const n = normalizeDialNumber(phone)
  if (!n) {
    uni.showToast({ title: '暂无电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: n })
}

function previewImage(current: string) {
  const urls = (wo.value?.imageUrls ?? []).map((u) => resolveMediaUrl(u))
  if (urls.length === 0) return
  const cur = resolveMediaUrl(current)
  uni.previewImage({ urls, current: urls.includes(cur) ? cur : urls[0] })
}

function previewCompletionImage(current: string) {
  const urls = (wo.value?.completionImageUrls ?? []).map((u) => resolveMediaUrl(u))
  if (urls.length === 0) return
  const cur = resolveMediaUrl(current)
  uni.previewImage({ urls, current: urls.includes(cur) ? cur : urls[0] })
}

async function load() {
  if (!userStore.token) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  loading.value = true
  errMsg.value = ''
  try {
    const res = (await get(`/api/mp/work-orders/${id.value}`)) as {
      success?: boolean
      message?: string
      workOrder?: WorkOrderDetail
      activityLogs?: ActivityLogItem[]
    }
    if (res.success && res.workOrder) {
      wo.value = {
        ...res.workOrder,
        imageUrls: Array.isArray(res.workOrder.imageUrls) ? res.workOrder.imageUrls : [],
      }
      activityLogs.value = Array.isArray(res.activityLogs) ? res.activityLogs : []
      if (!editing.value) {
        editTitle.value = res.workOrder.title
        editDescription.value = res.workOrder.description
        editImageUrls.value = [...(res.workOrder.imageUrls ?? [])]
      }
      if (res.workOrder.status === '待租客确认费用') {
        await prepareFeePay()
      } else {
        feePay.value = null
      }
    } else {
      wo.value = null
      activityLogs.value = []
      feePay.value = null
      errMsg.value = res.message || '加载失败'
    }
  } catch {
    wo.value = null
    activityLogs.value = []
    feePay.value = null
    errMsg.value = '网络错误'
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  const raw = query?.id != null ? String(query.id) : ''
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) {
    errMsg.value = '无效的工单'
    loading.value = false
    return
  }
  id.value = n
  void userStore.fetchUser()
  void load()
})

async function prepareFeePay() {
  if (!id.value) return
  try {
    const res = (await post(`/api/mp/work-orders/${id.value}/fee-payment/prepare`, {})) as {
      success?: boolean
      message?: string
      data?: {
        bill: {
          id: number
          code: string
          feeType: string
          period: string
          dueDate: string
          accountReceivable: number
          amountDue: number
          paymentStatus: string
          remark?: string | null
        }
        pendingPayment: {
          id: number
          code: string
          paymentMethod: string
          paymentStatus: string
        } | null
      }
    }
    if (res.success && res.data?.bill) {
      const b = res.data.bill
      feePay.value = {
        billId: b.id,
        billCode: b.code,
        feeType: b.feeType,
        period: b.period,
        dueDate: b.dueDate,
        accountReceivable: b.accountReceivable,
        amountDue: b.amountDue,
        paymentStatus: b.paymentStatus,
        remark: b.remark ?? null,
        pendingPayment: res.data.pendingPayment ?? null,
      }
    } else {
      feePay.value = null
      if (res.message) {
        uni.showToast({ title: res.message, icon: 'none' })
      }
    }
  } catch {
    feePay.value = null
  }
}

async function checkoutFeePay(channel: 'wechat' | 'alipay') {
  if (!id.value || actionBusy.value || !feePay.value) return
  actionBusy.value = true
  try {
    const res = (await post(`/api/mp/work-orders/${id.value}/fee-payment/checkout`, {
      billId: feePay.value.billId,
      channel,
    })) as {
      success?: boolean
      message?: string
      data?: { payment: { id: number; code: string; paymentMethod: string } }
    }
    if (!res.success || !res.data?.payment) {
      uni.showToast({ title: res.message || '下单失败', icon: 'none' })
      return
    }
    const p = res.data.payment
    if (feePay.value) {
      feePay.value = {
        ...feePay.value,
        pendingPayment: {
          id: p.id,
          code: p.code,
          paymentMethod: p.paymentMethod,
          paymentStatus: 'pending',
        },
      }
    }
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    actionBusy.value = false
  }
}

async function completeFeePay() {
  const pid = feePay.value?.pendingPayment?.id
  if (!id.value || actionBusy.value || pid == null) return
  actionBusy.value = true
  try {
    const res = (await post(`/api/mp/work-orders/${id.value}/fee-payment/complete`, {
      paymentId: pid,
    })) as { success?: boolean; message?: string }
    if (!res.success) {
      uni.showToast({ title: res.message || '确认失败', icon: 'none' })
      return
    }
    uni.showToast({ title: '支付已确认', icon: 'success' })
    await load()
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    actionBusy.value = false
  }
}

function refuseFee() {
  if (!id.value || actionBusy.value) return
  uni.showModal({
    title: '拒绝付费',
    content: '确定拒绝付费？工单将变为「已取消」且无法继续维修。',
    success: (r) => {
      if (!r.confirm) return
      void doRefuseFee()
    },
  })
}

async function doRefuseFee() {
  if (!id.value || actionBusy.value) return
  actionBusy.value = true
  try {
    const res = (await post(`/api/mp/work-orders/${id.value}/refuse-fee`, {})) as {
      success?: boolean
      message?: string
    }
    if (!res.success) {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
      return
    }
    uni.showToast({ title: '已取消', icon: 'success' })
    await load()
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    actionBusy.value = false
  }
}

async function submitTenantEvaluation() {
  if (!id.value || evalBusy.value) return
  evalBusy.value = true
  try {
    const res = (await post(`/api/mp/work-orders/${id.value}/advance`, {
      action: 'submit_tenant_evaluation',
      evaluationContent: evalDraft.value.trim() || undefined,
    })) as { success?: boolean; message?: string }
    if (!res.success) {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
      return
    }
    evalDraft.value = ''
    uni.showToast({ title: '已完结', icon: 'success' })
    await load()
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    evalBusy.value = false
  }
}

function confirmCancelTenant() {
  uni.showModal({
    title: '提示',
    content: '确定取消该工单？',
    success: (r) => {
      if (r.confirm) void tenantCancel()
    },
  })
}

async function tenantCancel() {
  if (!id.value || actionBusy.value) return
  actionBusy.value = true
  try {
    const res = (await post(`/api/mp/work-orders/${id.value}/advance`, {
      action: 'cancel',
    })) as { success?: boolean; message?: string }
    if (!res.success) {
      uni.showToast({ title: res.message || '操作失败', icon: 'none' })
      return
    }
    uni.showToast({ title: '已取消', icon: 'success' })
    await load()
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    actionBusy.value = false
  }
}

function cancelEditMode() {
  const w = wo.value
  if (w) {
    editTitle.value = w.title
    editDescription.value = w.description
    editImageUrls.value = [...(w.imageUrls ?? [])]
  }
  editing.value = false
}

async function saveEdit() {
  if (!id.value || savingEdit.value) return
  const t = editTitle.value.trim()
  if (!t) {
    uni.showToast({ title: '标题不能为空', icon: 'none' })
    return
  }
  savingEdit.value = true
  try {
    const res = (await put(`/api/mp/work-orders/${id.value}`, {
      title: t,
      description: editDescription.value.trim(),
      images: editImageUrls.value.length > 0 ? JSON.stringify(editImageUrls.value) : null,
    })) as { success?: boolean; message?: string }
    if (!res.success) {
      uni.showToast({ title: res.message || '保存失败', icon: 'none' })
      return
    }
    editing.value = false
    uni.showToast({ title: '已保存', icon: 'success' })
    await load()
  } catch {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    savingEdit.value = false
  }
}

function addEditPhotos() {
  const remain = MAX_EDIT_IMAGES - editImageUrls.value.length
  if (remain <= 0) {
    uni.showToast({ title: `最多 ${MAX_EDIT_IMAGES} 张`, icon: 'none' })
    return
  }
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed', 'original'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const paths = res.tempFilePaths || []
      if (paths.length === 0) return
      void (async () => {
        uploadingEditPhotos.value = true
        try {
          for (const fp of paths) {
            if (editImageUrls.value.length >= MAX_EDIT_IMAGES) break
            const url = await uploadWorkOrderImage(fp)
            editImageUrls.value = [...editImageUrls.value, url]
          }
        } catch (e: unknown) {
          uni.showToast({ title: (e as Error)?.message || '上传失败', icon: 'none' })
        } finally {
          uploadingEditPhotos.value = false
        }
      })()
    },
  })
}

function removeEditPhoto(index: number) {
  editImageUrls.value = editImageUrls.value.filter((_, i) => i !== index)
}

function previewEditPhoto(index: number) {
  const urls = editImageUrls.value.map((u) => resolveMediaUrl(u))
  if (urls.length === 0) return
  uni.previewImage({ urls, current: urls[index] ?? urls[0] })
}
</script>

<template>
  <view class="page">
    <view v-if="loading" class="state">加载中…</view>
    <view v-else-if="errMsg && !wo" class="state state--err">{{ errMsg }}</view>
    <view v-else-if="wo" class="body" :class="{ 'body--with-footer': showFooterBar && !editing }">
      <view class="hero">
        <text class="code">{{ wo.code }}</text>
        <text class="title">{{ wo.title }}</text>
        <view class="chips">
          <text class="chip chip--status">{{ wo.status }}</text>
          <text class="chip">{{ wo.type }}</text>
        </view>

        <!-- 节点流程：当前及之前高亮，之后灰色（与 PC 一致） -->
        <view v-if="flowState.cancelled" class="flow-cancel">工单已取消，流程已终止。</view>
        <scroll-view v-else scroll-x class="flow-scroll" :show-scrollbar="false" :enable-flex="true">
          <view class="flow-row">
            <template v-for="(label, i) in STEP_LABELS" :key="label">
              <view class="flow-seg">
                <view class="flow-node-col">
                  <view
                    class="flow-node"
                    :class="{ 'flow-node--on': i <= flowState.activeIndex }"
                  >
                    <text class="flow-node-num">{{ i + 1 }}</text>
                  </view>
                  <text
                    class="flow-label"
                    :class="{ 'flow-label--on': i <= flowState.activeIndex }"
                  >
                    {{ label }}
                  </text>
                </view>
                <view
                  v-if="i < STEP_LABELS.length - 1"
                  class="flow-line"
                  :class="{ 'flow-line--on': i < flowState.activeIndex }"
                />
              </view>
            </template>
          </view>
        </scroll-view>
      </view>

      <view class="card">
        <text class="card-title">基本信息</text>
        <view class="row">
          <text class="k">楼宇</text>
          <text class="v">{{ wo.building?.name ?? '—' }}</text>
        </view>
        <view class="row">
          <text class="k">房源</text>
          <text class="v">{{
            wo.room ? `${wo.room.roomNumber} · ${wo.room.name}` : '—'
          }}</text>
        </view>
        <view class="row">
          <text class="k">位置说明</text>
          <text class="v">{{ wo.location?.trim() ? wo.location : '—' }}</text>
        </view>
        <view class="row">
          <text class="k">设施范围</text>
          <text class="v">{{ wo.facilityScope ?? '—' }}</text>
        </view>
        <view class="row">
          <text class="k">来源</text>
          <text class="v">{{ wo.source ?? '—' }}</text>
        </view>
        <view class="row">
          <text class="k">严重等级</text>
          <text class="v">{{ wo.severity?.trim() ? wo.severity : '—' }}</text>
        </view>
        <view class="row">
          <text class="k">费用知情确认</text>
          <text class="v">{{ wo.feeNoticeAcknowledged ? '已确认' : '—' }}</text>
        </view>
        <view class="row">
          <text class="k">租客</text>
          <text class="v">{{
            wo.tenant?.companyName?.trim() ? wo.tenant.companyName : '—'
          }}</text>
        </view>
        <view class="row">
          <text class="k">提交人</text>
          <view class="row-r">
            <text class="v row-v-main">{{
              wo.reporter
                ? `${wo.reporter.name ?? '—'}（${wo.reporter.role}）`
                : '—'
            }}</text>
            <view
              v-if="normalizeDialNumber(wo.reporter?.phone)"
              class="dial-btn"
              @tap.stop="dialPhone(wo.reporter?.phone)"
            >
              <text class="dial-btn-text">拨号</text>
            </view>
          </view>
        </view>
        <view class="row">
          <text class="k">创建时间</text>
          <text class="v">{{ formatTime(wo.createdAt) }}</text>
        </view>
        <view class="row">
          <text class="k">更新时间</text>
          <text class="v">{{ formatTime(wo.updatedAt) }}</text>
        </view>
        <view class="row">
          <text class="k">派单时间</text>
          <text class="v">{{ formatTime(wo.assignedAt) }}</text>
        </view>
        <view class="row">
          <text class="k">处理人</text>
          <view class="row-r">
            <text class="v row-v-main">{{ wo.assignedEmployee?.name ?? '—' }}</text>
            <view
              v-if="normalizeDialNumber(wo.assignedEmployee?.phone)"
              class="dial-btn"
              @tap.stop="dialPhone(wo.assignedEmployee?.phone)"
            >
              <text class="dial-btn-text">拨号</text>
            </view>
          </view>
        </view>
        <view class="row">
          <text class="k">处理人电话</text>
          <text class="v">{{ wo.assignedEmployee?.phone ?? '—' }}</text>
        </view>
        <view class="row">
          <text class="k">响应时间</text>
          <text class="v">{{ formatTime(wo.respondedAt) }}</text>
        </view>
        <view class="row">
          <text class="k">费用确认时间</text>
          <text class="v">{{ formatTime(wo.feeConfirmedAt) }}</text>
        </view>
        <view class="row">
          <text class="k">完成处理</text>
          <text class="v">{{ formatTime(wo.completedAt) }}</text>
        </view>
        <view class="row">
          <text class="k">评价完成</text>
          <text class="v">{{ formatTime(wo.evaluatedAt) }}</text>
        </view>
      </view>

      <view class="card">
        <text class="card-title">问题描述</text>
        <text class="desc">{{ wo.description?.trim() ? wo.description : '—' }}</text>
      </view>

      <view class="card">
        <text class="card-title">现场照片</text>
        <view v-if="wo.imageUrls.length > 0" class="imgs">
          <view
            v-for="(u, idx) in wo.imageUrls"
            :key="u + idx"
            class="img-wrap"
            @click="previewImage(u)"
          >
            <image class="img" :src="resolveMediaUrl(u)" mode="aspectFill" />
          </view>
        </view>
        <text v-else class="empty-hint">暂无照片</text>
      </view>

      <view
        v-if="wo.feeRemark || (wo.feeTotal != null && Number.isFinite(Number(wo.feeTotal)))"
        class="card card--fee"
      >
        <text class="card-title">费用信息</text>
        <view v-if="wo.feeTotal != null && Number.isFinite(Number(wo.feeTotal))" class="fee-sum-line">
          <text class="fee-sum-lbl">费用合计</text>
          <text class="fee-sum-val">{{ Number(wo.feeTotal).toFixed(2) }} 元</text>
        </view>
        <text v-if="wo.feeRemark" class="desc">{{ wo.feeRemark }}</text>
      </view>

      <view
        v-if="(wo.completionImageUrls?.length ?? 0) > 0"
        class="card card--completion"
      >
        <text class="card-title">办结现场</text>
        <view class="imgs">
          <view
            v-for="(u, cidx) in wo.completionImageUrls ?? []"
            :key="'co' + u + cidx"
            class="img-wrap"
            @click="previewCompletionImage(u)"
          >
            <image class="img" :src="resolveMediaUrl(u)" mode="aspectFill" />
          </view>
        </view>
        <text v-if="wo.completionRemark?.trim()" class="desc">{{ wo.completionRemark }}</text>
      </view>

      <view
        v-if="wo.status === '待评价' && !isTenantSubmittedSource(wo.source)"
        class="card"
      >
        <text class="card-title">待评价</text>
        <text class="desc">本单由物业发起，评价由物业在员工端确认后即可完结。</text>
      </view>

      <view v-if="wo.evaluationNote?.trim() && wo.status === '评价完成'" class="card">
        <text class="card-title">评价说明</text>
        <text class="desc">{{ wo.evaluationNote }}</text>
      </view>

      <view class="card log-card">
        <text class="card-title">操作日志</text>
        <text class="log-auto-tip">以下记录由系统自动生成，与 PC 端一致，不可手动添加。</text>
        <view v-if="activityLogs.length === 0" class="empty-hint">暂无操作记录</view>
        <view v-else class="log-timeline">
          <view
            v-for="(log, logIdx) in activityLogs"
            :key="log.id"
            class="log-tl-item"
          >
            <view class="log-tl-axis">
              <view class="log-tl-dot" />
              <view
                v-if="logIdx < activityLogs.length - 1"
                class="log-tl-stem"
              />
            </view>
            <view class="log-tl-body">
              <view class="log-tl-row log-tl-row--meta">
                <text class="log-tl-time">{{ formatTime(log.createdAt) }}</text>
                <text class="log-tl-type">{{ actionLabel(log.action) }}</text>
              </view>
              <view class="log-tl-row log-tl-row--operator">
                <text class="log-tl-name">{{ log.operatorName?.trim() ? log.operatorName : '—' }}</text>
                <text class="log-tl-sep">·</text>
                <text class="log-tl-account">{{
                  log.operatorPhone?.trim() ? log.operatorPhone : '—'
                }}</text>
              </view>
              <view class="log-tl-detail">
                <text v-if="log.summary?.trim()" class="log-tl-summary">{{ log.summary }}</text>
                <view
                  v-for="(c, ci) in parseLogChanges(log.changesJson)"
                  :key="ci"
                  class="log-tl-change"
                >
                  <text class="log-tl-change-tag">{{ c.label }}</text>
                  <text v-if="c.field === 'images'" class="log-tl-change-body">
                    ：图片附件已变更（物业电脑端可查看对比）
                  </text>
                  <text v-else class="log-tl-change-body">
                    ：{{ truncateLogText(c.from) }} → {{ truncateLogText(c.to) }}
                  </text>
                </view>
                <text
                  v-if="!log.summary?.trim() && parseLogChanges(log.changesJson).length === 0"
                  class="log-tl-summary log-tl-summary--muted"
                >
                  —
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部固定操作栏（与 PC 逻辑一致，样式为底栏） -->
    <view v-if="wo && showFooterBar && !editing" class="footer-bar">
      <text v-if="showFeeStaffReview" class="footer-tip">
        物业正在核对费用，核对完毕后将送您确认。
      </text>
      <text v-if="showConfirmFee" class="footer-tip">
        须在线支付费用账单后方可继续维修；支付成功后工单将自动回到处理中。若有异议可拒绝付费（工单将取消）。
      </text>
      <view v-if="showConfirmFee && feePay" class="footer-fee-actions">
        <text class="footer-tip footer-tip--bill">
          账单 {{ feePay.billCode }}（{{ feePay.feeType }}）账期 {{ feePay.period }}，应付
          {{ feePay.amountDue.toFixed(2) }} 元
        </text>
        <view
          v-if="!feePay.pendingPayment && feePay.paymentStatus !== 'paid'"
          class="footer-pay-row"
        >
          <button
            class="footer-btn footer-btn--wechat flex1"
            :disabled="actionBusy"
            @tap="checkoutFeePay('wechat')"
          >
            微信支付
          </button>
          <button
            class="footer-btn footer-btn--alipay flex1"
            :disabled="actionBusy"
            @tap="checkoutFeePay('alipay')"
          >
            支付宝
          </button>
        </view>
        <view
          v-if="feePay.pendingPayment && feePay.pendingPayment.paymentStatus === 'pending'"
          class="footer-pending-box"
        >
          <text class="footer-tip">
            待支付：{{ feePay.pendingPayment.paymentMethod }} · 缴费单 {{ feePay.pendingPayment.code }}
          </text>
          <text class="footer-tip footer-tip--sub">
            真实环境调起收银台后由服务端验签确认；演示可点下方「我已完成支付」。
          </text>
          <button class="footer-btn footer-btn--fee" :disabled="actionBusy" @tap="completeFeePay">
            {{ actionBusy ? '提交中…' : '我已完成支付' }}
          </button>
        </view>
        <button
          class="footer-btn footer-btn--danger-outline"
          :disabled="actionBusy"
          @tap="refuseFee"
        >
          拒绝付费（取消工单）
        </button>
      </view>
      <text v-if="showConfirmFee && !feePay && !actionBusy" class="footer-tip">
        正在准备账单…
      </text>
      <view v-if="showPendingEval" class="footer-eval">
        <text class="footer-tip">物业已办结，请提交评价（选填）以完结工单。</text>
        <textarea
          v-model="evalDraft"
          class="footer-eval-textarea"
          placeholder="选填：服务感受或建议"
          :maxlength="2000"
          :disabled="evalBusy"
        />
        <button
          class="footer-btn footer-btn--primary"
          :disabled="evalBusy"
          @tap="submitTenantEvaluation"
        >
          {{ evalBusy ? '提交中…' : '提交评价并完结' }}
        </button>
      </view>
      <view v-if="canEditBasics || showTenantCancel" class="footer-row">
        <button
          v-if="canEditBasics"
          class="footer-btn footer-btn--ghost flex1"
          :disabled="savingEdit || actionBusy"
          @tap="editing = true"
        >
          编辑
        </button>
        <button
          v-if="showTenantCancel"
          class="footer-btn footer-btn--danger flex1"
          :disabled="actionBusy || savingEdit"
          @tap="confirmCancelTenant"
        >
          取消工单
        </button>
      </view>
    </view>

    <!-- 全屏编辑（与新建页相同字段：标题、描述、图片） -->
    <view v-if="wo && editing" class="edit-overlay">
      <view class="edit-overlay-head">
        <text class="edit-overlay-back" @tap="cancelEditMode">‹ 返回</text>
        <text class="edit-overlay-title">编辑工单</text>
        <view class="edit-overlay-placeholder" />
      </view>
      <scroll-view
        scroll-y
        class="edit-overlay-scroll"
        :show-scrollbar="false"
        :enable-flex="true"
      >
        <view class="edit-overlay-inner">
          <text class="edit-hint">仅可修改标题、描述与现场图片（与提交报修时一致）。</text>
          <text class="edit-fld-lbl">标题 *</text>
          <input v-model="editTitle" class="edit-input" placeholder="标题" />
          <text class="edit-fld-lbl">描述</text>
          <textarea v-model="editDescription" class="edit-textarea" placeholder="问题描述" />
          <text class="edit-fld-lbl">现场图片</text>
          <view class="edit-imgs">
            <view
              v-for="(u, idx) in editImageUrls"
              :key="u + String(idx)"
              class="edit-img-cell"
              @tap="previewEditPhoto(idx)"
            >
              <image class="edit-img" :src="resolveMediaUrl(u)" mode="aspectFill" />
              <view class="edit-img-del" @tap.stop="removeEditPhoto(idx)">
                <text>×</text>
              </view>
            </view>
            <view
              v-if="editImageUrls.length < MAX_EDIT_IMAGES"
              class="edit-img-add"
              @tap="addEditPhotos"
            >
              <text>{{ uploadingEditPhotos ? '…' : '+' }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="edit-overlay-footer">
        <button class="footer-btn footer-btn--ghost flex1" :disabled="savingEdit" @tap="cancelEditMode">
          取消
        </button>
        <button class="footer-btn footer-btn--primary flex1" :disabled="savingEdit" @tap="saveEdit">
          {{ savingEdit ? '保存中…' : '保存' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  padding-bottom: 0;
  box-sizing: border-box;
  background: $pms-bg-deep;
  position: relative;
}

.body {
  padding-bottom: 32rpx;
}

/** 为底部固定操作栏留出空间，避免最后几块卡片被挡住 */
.body--with-footer {
  padding-bottom: calc(32rpx + 300rpx + env(safe-area-inset-bottom, 0px));
}

.footer-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom, 0px));
  background: $pms-bg-deep;
  border-top: 1rpx solid $pms-border;
  box-shadow: 0 -12rpx 40rpx rgba(0, 0, 0, 0.45);
}

.footer-tip {
  font-size: 24rpx;
  color: $pms-text-muted;
  line-height: 1.45;
}

.footer-tip--bill {
  font-size: 22rpx;
  color: $pms-text;
}

.footer-tip--sub {
  font-size: 20rpx;
  opacity: 0.85;
}

.footer-pay-row {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  width: 100%;
}

.footer-pending-box {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  width: 100%;
}

.footer-row {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}

.footer-fee-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  width: 100%;
}

.footer-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
}
.footer-btn::after {
  border: none;
}

.footer-btn--fee {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  color: #fff;
}

.footer-btn--primary {
  background: linear-gradient(135deg, $pms-accent 0%, #0284c7 100%);
  color: #fff;
}

.footer-btn--ghost {
  background: rgba(30, 41, 59, 0.95);
  color: $pms-text-muted;
  border: 1rpx solid $pms-border;
}

.footer-btn--danger {
  background: transparent;
  color: $pms-danger;
  border: 1rpx solid rgba(248, 113, 113, 0.45);
}

.footer-btn--danger-outline {
  background: transparent;
  color: $pms-danger;
  border: 1rpx solid rgba(248, 113, 113, 0.55);
  font-size: 28rpx;
  font-weight: 500;
}

.footer-btn--wechat {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: #fff;
  font-size: 28rpx;
}

.footer-btn--alipay {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: #fff;
  font-size: 28rpx;
}

.footer-btn[disabled] {
  opacity: 0.5;
}

.flex1 {
  flex: 1;
}

.edit-overlay {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 300;
  background: $pms-bg-deep;
  display: flex;
  flex-direction: column;
}

.edit-overlay-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  padding-top: calc(16rpx + env(safe-area-inset-top, 0px));
  border-bottom: 1rpx solid $pms-border;
}

.edit-overlay-back {
  font-size: 28rpx;
  color: $pms-accent;
  width: 160rpx;
}

.edit-overlay-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $pms-text;
  flex: 1;
  text-align: center;
}

.edit-overlay-placeholder {
  width: 160rpx;
}

.edit-overlay-scroll {
  flex: 1;
  height: 0;
  width: 100%;
}

.edit-overlay-inner {
  padding: 24rpx;
  padding-bottom: 48rpx;
}

.edit-hint {
  display: block;
  font-size: 24rpx;
  color: $pms-text-dim;
  line-height: 1.5;
  margin-bottom: 24rpx;
}

.edit-fld-lbl {
  display: block;
  font-size: 26rpx;
  color: $pms-text-muted;
  margin: 16rpx 0 12rpx;
  font-weight: 600;
}

.edit-input {
  width: 100%;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: rgba(15, 23, 42, 0.5);
  color: $pms-text;
  font-size: 28rpx;
  box-sizing: border-box;
}

.edit-textarea {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: rgba(15, 23, 42, 0.5);
  color: $pms-text;
  font-size: 28rpx;
  box-sizing: border-box;
}

.edit-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.edit-img-cell {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1rpx solid $pms-border;
}

.edit-img {
  width: 100%;
  height: 100%;
  display: block;
}

.edit-img-del {
  position: absolute;
  right: 6rpx;
  top: 6rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  line-height: 1;
}

.edit-img-add {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  border: 2rpx dashed $pms-border;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: $pms-text-dim;
  background: rgba(15, 23, 42, 0.4);
}

.edit-overlay-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom, 0px));
  border-top: 1rpx solid $pms-border;
  background: $pms-bg-deep;
}

.state {
  text-align: center;
  padding: 120rpx 32rpx;
  font-size: 28rpx;
  color: $pms-text-muted;
}

.state--err {
  color: $pms-danger;
}

.hero {
  @include pms-card;
  padding: 32rpx 28rpx 36rpx;
  margin-bottom: 24rpx;
}

.code {
  display: block;
  font-size: 24rpx;
  color: $pms-accent;
  font-family: ui-monospace, monospace;
  margin-bottom: 12rpx;
}

.title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: $pms-text;
  line-height: 1.4;
  margin-bottom: 20rpx;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 28rpx;
}

.chip {
  font-size: 24rpx;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid $pms-border;
  color: $pms-text-muted;
  background: rgba(15, 23, 42, 0.4);
}

.chip--status {
  color: $pms-accent;
  border-color: rgba(56, 189, 248, 0.45);
  background: rgba(14, 165, 233, 0.1);
}

.flow-cancel {
  font-size: 26rpx;
  color: $pms-danger;
  padding: 20rpx;
  border-radius: 16rpx;
  background: rgba(248, 113, 113, 0.12);
  border: 1rpx solid rgba(248, 113, 113, 0.35);
}

.flow-scroll {
  width: 100%;
  margin-top: 8rpx;
}

.flow-row {
  display: inline-flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 8rpx 4rpx 12rpx;
}

.flow-seg {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.flow-node-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 112rpx;
  flex-shrink: 0;
}

.flow-node {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(148, 163, 184, 0.35);
  background: rgba(30, 41, 59, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.flow-node--on {
  border-color: rgba(56, 189, 248, 0.85);
  background: rgba(56, 189, 248, 0.25);
}

.flow-node-num {
  font-size: 24rpx;
  font-weight: 700;
  color: $pms-text-dim;
}

.flow-node--on .flow-node-num {
  color: $pms-accent;
}

.flow-label {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: $pms-text-dim;
  text-align: center;
  line-height: 1.25;
  max-width: 112rpx;
}

.flow-label--on {
  color: $pms-accent;
  font-weight: 600;
}

.flow-line {
  width: 32rpx;
  height: 4rpx;
  border-radius: 4rpx;
  background: rgba(148, 163, 184, 0.25);
  margin-top: 28rpx;
  flex-shrink: 0;
}

.flow-line--on {
  background: rgba(56, 189, 248, 0.65);
}

.card {
  @include pms-card;
  padding: 28rpx;
  margin-bottom: 24rpx;
}

.card--fee {
  border-color: rgba(251, 191, 36, 0.35);
}

.card--completion {
  border-color: rgba(16, 185, 129, 0.35);
}

.footer-eval {
  width: 100%;
  padding: 16rpx 0 8rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.footer-eval-textarea {
  width: 100%;
  min-height: 140rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
  color: $pms-text;
  font-size: 26rpx;
  box-sizing: border-box;
}

.fee-sum-line {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding: 12rpx 0;
  border-bottom: 1rpx solid $pms-border;
}

.fee-sum-lbl {
  font-size: 26rpx;
  color: $pms-text-muted;
}

.fee-sum-val {
  font-size: 30rpx;
  font-weight: 700;
  color: #fbbf24;
}

.card-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-text-muted;
  margin-bottom: 20rpx;
  padding-left: 16rpx;
  border-left: 6rpx solid $pms-accent;
}

.row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $pms-border;
  font-size: 26rpx;
}

.row:last-of-type {
  border-bottom: none;
}

.k {
  color: $pms-text-dim;
  flex-shrink: 0;
}

.v {
  color: $pms-text;
  text-align: right;
  flex: 1;
  line-height: 1.45;
}

.row-r {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 16rpx;
}

.row-v-main {
  text-align: right;
  word-break: break-word;
}

.dial-btn {
  flex-shrink: 0;
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(56, 189, 248, 0.55);
  background: rgba(56, 189, 248, 0.12);
}

.dial-btn-text {
  font-size: 22rpx;
  color: $pms-accent;
  font-weight: 500;
}

.desc {
  font-size: 28rpx;
  color: $pms-text-muted;
  line-height: 1.6;
  white-space: pre-wrap;
}

.empty-hint {
  font-size: 26rpx;
  color: $pms-text-dim;
}

.imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.img-wrap {
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid $pms-border;
  @include pms-tap;
}

.img {
  width: 100%;
  height: 100%;
}

.log-card .card-title {
  margin-bottom: 12rpx;
}

.log-auto-tip {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  line-height: 1.45;
  margin-bottom: 24rpx;
}

/** 操作日志：纵向时间轴，压缩行数 */
.log-timeline {
  display: flex;
  flex-direction: column;
}

.log-tl-item {
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.log-tl-axis {
  width: 36rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 8rpx;
}

.log-tl-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: $pms-accent;
  border: 2rpx solid rgba(56, 189, 248, 0.35);
  flex-shrink: 0;
}

.log-tl-stem {
  flex: 1;
  width: 2rpx;
  min-height: 32rpx;
  margin-top: 8rpx;
  background: rgba(148, 163, 184, 0.28);
}

.log-tl-body {
  flex: 1;
  min-width: 0;
  padding-left: 16rpx;
  padding-bottom: 28rpx;
}

.log-tl-item:last-child .log-tl-body {
  padding-bottom: 4rpx;
}

.log-tl-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.log-tl-row--meta {
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.log-tl-time {
  font-size: 22rpx;
  color: $pms-text-dim;
  flex: 1;
  min-width: 0;
}

.log-tl-type {
  font-size: 24rpx;
  font-weight: 600;
  color: $pms-accent;
  flex-shrink: 0;
}

.log-tl-row--operator {
  margin-bottom: 10rpx;
}

.log-tl-name {
  font-size: 24rpx;
  color: $pms-text-muted;
}

.log-tl-sep {
  font-size: 24rpx;
  color: $pms-text-dim;
  padding: 0 4rpx;
}

.log-tl-account {
  font-size: 22rpx;
  font-family: ui-monospace, monospace;
  color: $pms-text-dim;
  word-break: break-all;
}

.log-tl-detail {
  font-size: 24rpx;
  line-height: 1.5;
  color: $pms-text-muted;
}

.log-tl-summary {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 6rpx;
}

.log-tl-summary:last-child {
  margin-bottom: 0;
}

.log-tl-summary--muted {
  color: $pms-text-dim;
}

.log-tl-change {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  margin-top: 6rpx;
  word-break: break-word;
}

.log-tl-change-tag {
  font-weight: 600;
  color: $pms-text-muted;
  flex-shrink: 0;
}

.log-tl-change-body {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  line-height: 1.5;
  color: $pms-text-muted;
}
</style>
