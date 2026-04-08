<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, put, resolveMediaUrl } from '@/api/request'
import { uploadWorkOrderImage } from '@/api/work-order-upload'
import {
  fileNameFromAttachmentUrl,
  isLikelyImageUrl,
  parseUrlArrayFromWorkOrderLogValue,
} from '@/utils/work-order-log-display'

type Reporter = { role: string; name: string; phone: string }

type Wo = {
  id: number
  code: string
  title: string
  type: string
  description: string
  status: string
  source: string
  facilityScope: string | null
  feeRemark: string | null
  /** 费用合计（元） */
  feeTotal: number | null
  feeNoticeAcknowledged: boolean
  location: string | null
  severity: string | null
  projectId: number | null
  taskId: number | null
  tagId: number | string | null
  images: string | null
  imageUrls: string[]
  building: { id: number; name: string } | null
  room: { id: number; roomNumber: string; name: string } | null
  tenant: { id: number; companyName: string } | null
  reporterId: number
  reporter: Reporter | null
  assignedTo: number | null
  assignedEmployee: { name: string; phone: string } | null
  assignedAt: string | null
  respondedAt: string | null
  feeConfirmedAt: string | null
  completedAt: string | null
  evaluatedAt: string | null
  completionImageUrls?: string[]
  completionRemark?: string | null
  evaluationNote?: string | null
  createdAt: string
  updatedAt: string
  /** 是否存在工单费用账单；内部确认费用时为 false */
  hasWorkOrderFeeBill?: boolean
}

const MAX_EDIT_IMAGES = 10

type ActivityLogItem = {
  id: number
  action: string
  summary: string | null
  changesJson: string | null
  operatorName: string | null
  operatorPhone: string | null
  createdAt: string
}

type EmployeeBrief = { id: number; name: string; phone: string }

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '编辑',
  assign: '派单',
  cancel: '取消',
  start_processing: '开始处理',
  request_fee_confirmation: '提交费用（待员工确认）',
  no_fee_continue: '未产生任何费用（继续处理）',
  publish_fee_for_tenant: '送租客确认费用',
  fee_zero_skip_tenant: '零元费用跳过租客确认',
  fee_confirm_internal_pending: '费用内部确认（入待处理）',
  fee_confirm_tenant: '确认费用并在线支付（租客）',
  fee_refuse_tenant: '拒绝付费（租客）',
  complete_for_evaluation: '办结（待评价）',
  mark_evaluated: '评价完成',
  tenant_submit_evaluation: '提交评价（租客）',
  refund_fee_cancel: '退费并取消工单',
}

const woId = ref(0)
const wo = ref<Wo | null>(null)
const loading = ref(true)
const busy = ref(false)
const feeRemark = ref('')
/** 提交费用待确认：弹框内编辑的费用说明 */
const showFeeModal = ref(false)
const feeModalDraft = ref('')
/** 弹框内费用合计，仅允许数字与小数点，最多两位小数 */
const feeModalTotalStr = ref('')
const showCompleteModal = ref(false)
const completeModalUrls = ref<string[]>([])
const completeModalRemark = ref('')
const completeModalUploading = ref(false)
const showEvalModal = ref(false)
const evalModalDraft = ref('')
const errMsg = ref('')

const activityLogs = ref<ActivityLogItem[]>([])
const employees = ref<EmployeeBrief[]>([])
const assigningTo = ref<number | null>(null)
const assignBusy = ref(false)

/** 待员工确认费用且工单无租客：可选指定费用承担租客 */
const feeTenantsBrief = ref<{ id: number; companyName: string }[]>([])
const feeAssignPickerIndex = ref(0)

const editing = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const editImageUrls = ref<string[]>([])
const savingEdit = ref(false)
const uploadingEditPhotos = ref(false)

function displaySource(raw: string | null | undefined): string {
  if (!raw) return '-'
  if (raw === '租客端') return '租客自建'
  if (raw === 'PC端') return 'PC自建'
  return raw
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN')
  } catch {
    return iso
  }
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

const resolvedImageUrls = computed(() =>
  (wo.value?.imageUrls ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean)
)

const resolvedCompletionUrls = computed(() =>
  (wo.value?.completionImageUrls ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean)
)

function isTenantSubmittedWoSource(src: string | null | undefined): boolean {
  if (!src) return false
  const s = String(src).trim()
  return s === '租客自建' || s === '租客端'
}

/** 与 PC 端 WorkOrderFlowStepBar 一致：当前及之前节点高亮，之后置灰 */
const STEP_LABELS = ['创建', '派单', '响应', '处理', '费用确认', '待处理', '待评价', '完成'] as const

function getFlowStepState(status: string): { activeIndex: number; cancelled: boolean } {
  if (status === '已取消') {
    return { activeIndex: -1, cancelled: true }
  }
  const map: Record<string, number> = {
    待派单: 1,
    待响应: 2,
    处理中: 3,
    待员工确认费用: 4,
    待租客确认费用: 4,
    待处理: 5,
    待评价: 6,
    评价完成: 7,
  }
  return { activeIndex: map[status] ?? 0, cancelled: false }
}

const flowState = computed(() => {
  if (!wo.value) return { activeIndex: 0, cancelled: false }
  return getFlowStepState(wo.value.status)
})

const canEditBasics = computed(
  () => wo.value != null && !['评价完成', '已取消'].includes(wo.value.status)
)

const employeePickerLabels = computed(() => [
  '请选择处理人',
  ...employees.value.map((e) => `${e.name}${e.phone ? ` · ${e.phone}` : ''}`),
])

const employeePickerIndex = computed(() => {
  if (assigningTo.value == null) return 0
  const i = employees.value.findIndex((e) => e.id === assigningTo.value)
  return i >= 0 ? i + 1 : 0
})

const feeTenantPickerLabels = computed(() => [
  '请选择费用承担租客',
  ...feeTenantsBrief.value.map((t) => t.companyName),
])

const showFooter = computed(() => {
  const w = wo.value
  if (!w || editing.value) return false
  const s = w.status
  return (
    s === '待派单' ||
    s === '待响应' ||
    s === '处理中' ||
    s === '待员工确认费用' ||
    s === '待租客确认费用' ||
    s === '待处理' ||
    s === '待评价'
  )
})

async function load() {
  if (!woId.value) return
  loading.value = true
  errMsg.value = ''
  try {
    const res = (await get(`/api/mp/work-orders/${woId.value}`)) as {
      success?: boolean
      workOrder?: Wo
      message?: string
      activityLogs?: ActivityLogItem[]
      employees?: EmployeeBrief[]
    }
    wo.value = res.workOrder ?? null
    activityLogs.value = Array.isArray(res.activityLogs) ? res.activityLogs : []
    employees.value = Array.isArray(res.employees) ? res.employees : []
    if (!res.success || !res.workOrder) {
      errMsg.value = res.message || '加载失败'
    }
    if (res.workOrder?.feeRemark) {
      feeRemark.value = res.workOrder.feeRemark
    }
    if (res.workOrder) {
      assigningTo.value = res.workOrder.assignedTo ?? null
      if (!editing.value) {
        editTitle.value = res.workOrder.title
        editDescription.value = res.workOrder.description
        editImageUrls.value = [...(res.workOrder.imageUrls ?? [])]
      }
    }
    await loadFeeTenantsForAssign()
  } catch {
    wo.value = null
    feeTenantsBrief.value = []
    feeAssignPickerIndex.value = 0
    errMsg.value = '网络错误'
  } finally {
    loading.value = false
  }
}

async function loadFeeTenantsForAssign() {
  const w = wo.value
  if (!w || w.status !== '待员工确认费用' || w.tenant != null) {
    feeTenantsBrief.value = []
    feeAssignPickerIndex.value = 0
    return
  }
  try {
    const bid = w.building?.id
    const q = bid != null ? `?buildingId=${bid}` : ''
    const res = (await get(`/api/mp/tenants-brief${q}`)) as {
      success?: boolean
      data?: { list?: { id: number; companyName: string }[] }
    }
    feeTenantsBrief.value = res.data?.list ?? []
    feeAssignPickerIndex.value = 0
  } catch {
    feeTenantsBrief.value = []
  }
}

onLoad((options) => {
  const id = parseInt(String(options.id || ''), 10)
  if (!id) {
    uni.showToast({ title: '无效工单', icon: 'none' })
    return
  }
  woId.value = id
  void load()
})

type AdvanceAction =
  | 'start_processing'
  | 'request_fee_confirmation'
  | 'no_fee_continue'
  | 'publish_fee_for_tenant'
  | 'confirm_fee_internal_pending'
  | 'complete_for_evaluation'
  | 'mark_evaluated'
  | 'refund_fee_cancel'
  | 'cancel'

function sanitizeFeeTotalInput(raw: string): string {
  const v = raw.replace(/[^\d.]/g, '')
  const parts = v.split('.')
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
}

function onFeeModalTotalInput(e: { detail?: { value?: string } }) {
  const val = e.detail?.value ?? ''
  feeModalTotalStr.value = sanitizeFeeTotalInput(val)
}

function openFeeModal() {
  feeModalDraft.value =
    (wo.value?.feeRemark != null && String(wo.value.feeRemark).trim() !== ''
      ? String(wo.value.feeRemark).trim()
      : '') ||
    feeRemark.value.trim() ||
    ''
  const ft = wo.value?.feeTotal
  feeModalTotalStr.value =
    ft != null && Number.isFinite(Number(ft)) ? String(Number(ft)) : ''
  showFeeModal.value = true
}

function closeFeeModal() {
  showFeeModal.value = false
}

async function confirmSubmitFeeFromModal() {
  const raw = feeModalTotalStr.value.trim().replace(/,/g, '')
  const y = raw === '' ? 0 : parseFloat(raw)
  if (!Number.isFinite(y) || y < 0) {
    uni.showToast({ title: '费用合计须为有效数字', icon: 'none' })
    return
  }
  const yuan = Math.round(y * 100) / 100
  if (yuan === 0) {
    await advance('no_fee_continue')
    return
  }
  const text = feeModalDraft.value.trim()
  if (!text) {
    uni.showToast({ title: '产生费用时请填写费用说明', icon: 'none' })
    return
  }
  await advance('request_fee_confirmation', { feeRemark: text, feeTotal: yuan })
}

async function advance(
  action: AdvanceAction,
  opts?: {
    feeRemark?: string
    feeTotal?: number
    assignTenantId?: number
    completionImages?: string[]
    completionRemark?: string
    evaluationContent?: string
    refundReason?: string
  }
) {
  if (!woId.value || busy.value) return
  busy.value = true
  errMsg.value = ''
  try {
    const body: Record<string, unknown> = { action }
    if (action === 'request_fee_confirmation') {
      const r = (opts?.feeRemark ?? feeRemark.value).trim()
      if (!r) {
        busy.value = false
        uni.showToast({ title: '请填写费用说明', icon: 'none' })
        return
      }
      const ft = opts?.feeTotal
      if (ft == null || !Number.isFinite(ft) || ft <= 0) {
        busy.value = false
        uni.showToast({ title: '费用合计须为大于 0 的数字', icon: 'none' })
        return
      }
      body.feeRemark = r
      body.feeTotal = ft
    }
    if (action === 'complete_for_evaluation') {
      const imgs = opts?.completionImages
      if (!imgs || imgs.length < 1) {
        busy.value = false
        uni.showToast({ title: '请至少上传 1 张办结照片', icon: 'none' })
        return
      }
      body.completionImages = imgs
      const cr = opts?.completionRemark?.trim()
      if (cr) body.completionRemark = cr
    }
    if (action === 'mark_evaluated') {
      const ev = opts?.evaluationContent?.trim()
      if (ev) body.evaluationContent = ev
    }
    if (action === 'refund_fee_cancel') {
      const rr = opts?.refundReason?.trim()
      if (rr) body.refundReason = rr
    }
    if (action === 'publish_fee_for_tenant') {
      const aid = opts?.assignTenantId
      if (aid != null && Number.isInteger(aid) && aid > 0) {
        body.assignTenantId = aid
      }
    }
    const res = (await post(`/api/mp/work-orders/${woId.value}/advance`, body)) as {
      success?: boolean
      message?: string
    }
    if (!res.success) {
      errMsg.value = res.message || '操作失败'
      uni.showToast({ title: errMsg.value, icon: 'none' })
      return
    }
    showFeeModal.value = false
    showCompleteModal.value = false
    showEvalModal.value = false
    uni.showToast({ title: '已更新', icon: 'success' })
    await load()
  } catch (e: unknown) {
    errMsg.value = (e as Error)?.message || '网络错误'
    uni.showToast({ title: errMsg.value, icon: 'none' })
  } finally {
    busy.value = false
  }
}

function onFeeTenantPickerChange(e: { detail?: { value?: string | number } }) {
  const raw = e.detail?.value
  feeAssignPickerIndex.value = raw === undefined || raw === '' ? 0 : Number(raw)
}

function publishFeeForTenantTap() {
  const w = wo.value
  if (!w) return
  if (w.tenant == null) {
    const i = feeAssignPickerIndex.value
    if (i < 1 || i > feeTenantsBrief.value.length) {
      uni.showToast({ title: '请先选择费用承担租客', icon: 'none' })
      return
    }
    const t = feeTenantsBrief.value[i - 1]
    if (!t) return
    void advance('publish_fee_for_tenant', { assignTenantId: t.id })
  } else {
    void advance('publish_fee_for_tenant')
  }
}

function confirmFeeInternalPending() {
  uni.showModal({
    title: '内部确认费用',
    content: '不产生账单、无需租客在线支付，工单将进入「待处理」。确定？',
    success: (r) => {
      if (r.confirm) void advance('confirm_fee_internal_pending')
    },
  })
}

function openCompleteModal() {
  completeModalUrls.value = []
  completeModalRemark.value = ''
  showCompleteModal.value = true
}

function closeCompleteModal() {
  showCompleteModal.value = false
}

async function addCompletionModalPhotos() {
  if (completeModalUploading.value || busy.value) return
  const remain = 10 - completeModalUrls.value.length
  if (remain <= 0) {
    uni.showToast({ title: '最多 10 张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: Math.min(remain, 9),
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const paths = res.tempFilePaths as string[]
      completeModalUploading.value = true
      try {
        for (const fp of paths) {
          if (completeModalUrls.value.length >= 10) break
          const url = await uploadWorkOrderImage(fp)
          completeModalUrls.value = [...completeModalUrls.value, url]
        }
      } catch (e: unknown) {
        uni.showToast({ title: (e as Error)?.message || '上传失败', icon: 'none' })
      } finally {
        completeModalUploading.value = false
      }
    },
  })
}

function removeCompletionModalPhoto(idx: number) {
  completeModalUrls.value = completeModalUrls.value.filter((_, i) => i !== idx)
}

async function confirmCompleteFromModal() {
  if (completeModalUrls.value.length < 1) {
    uni.showToast({ title: '请至少上传 1 张', icon: 'none' })
    return
  }
  await advance('complete_for_evaluation', {
    completionImages: completeModalUrls.value,
    completionRemark: completeModalRemark.value.trim() || undefined,
  })
}

function openEvalModal() {
  evalModalDraft.value = ''
  showEvalModal.value = true
}

function closeEvalModal() {
  showEvalModal.value = false
}

async function confirmEvalFromModal() {
  await advance('mark_evaluated', {
    evaluationContent: evalModalDraft.value.trim() || undefined,
  })
}

function previewImgs(urls: string[], index: number) {
  if (!urls?.length) return
  const list = urls.map((u) => String(u))
  const i = Math.max(0, Math.min(index, list.length - 1))
  uni.previewImage({ urls: list, current: list[i] })
}

/** 办结弹窗内已选照片：点击放大，系统预览支持左右滑动 */
function previewCompletionModalPhotos(index: number) {
  if (!completeModalUrls.value.length) return
  const list = completeModalUrls.value.map((u) => resolveMediaUrl(u)).filter(Boolean)
  if (!list.length) return
  const i = Math.max(0, Math.min(index, list.length - 1))
  uni.previewImage({ urls: list, current: list[i] })
}

function confirmCancel() {
  uni.showModal({
    title: '提示',
    content: '确定取消该工单？',
    success: (r) => {
      if (r.confirm) void advance('cancel')
    },
  })
}

function confirmNoFeeContinue() {
  uni.showModal({
    title: '未产生任何费用',
    content: '确认后费用合计将记为 0 元，无需租客确认与支付，可继续处理直至办结。',
    success: (r) => {
      if (r.confirm) void advance('no_fee_continue')
    },
  })
}

function confirmRefundCancel() {
  if (wo.value?.hasWorkOrderFeeBill !== true) {
    uni.showToast({ title: '本单无租客费用账单，无需退费', icon: 'none' })
    return
  }
  uni.showModal({
    title: '退费并取消',
    content: '确定退费冲账并取消工单？账单将回退已缴金额。',
    success: (r) => {
      if (r.confirm) void advance('refund_fee_cancel')
    },
  })
}

function boolLabel(v: boolean | undefined | null): string {
  if (v === true) return '是'
  if (v === false) return '否'
  return '-'
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

/** 与租客端 / PC `WorkOrderLogDescriptionCell` 的 changesJson 结构一致 */
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

function logSideImageUrls(side: string): string[] | null {
  return parseUrlArrayFromWorkOrderLogValue(side)
}

function previewLogImages(urls: string[], index: number) {
  if (!urls?.length) return
  const resolved = urls.map((u) => resolveMediaUrl(u))
  const i = Math.max(0, Math.min(index, resolved.length - 1))
  uni.previewImage({ urls: resolved, current: resolved[i] })
}

/** 操作日志里「图片附件」一条变更的 from/to URL 列表；无法解析时返回 null */
function logImageChangeSides(c: LogChangeEntry): { from: string[]; to: string[] } | null {
  if (c.field !== 'images') return null
  const from = parseUrlArrayFromWorkOrderLogValue(c.from)
  const to = parseUrlArrayFromWorkOrderLogValue(c.to)
  if (from === null || to === null) return null
  return { from, to }
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
  if (!woId.value || savingEdit.value) return
  const t = editTitle.value.trim()
  if (!t) {
    uni.showToast({ title: '标题不能为空', icon: 'none' })
    return
  }
  savingEdit.value = true
  errMsg.value = ''
  try {
    const res = (await put(`/api/mp/work-orders/${woId.value}`, {
      title: t,
      description: editDescription.value.trim(),
      images: editImageUrls.value.length > 0 ? JSON.stringify(editImageUrls.value) : null,
    })) as { success?: boolean; message?: string }
    if (!res.success) {
      errMsg.value = res.message || '保存失败'
      uni.showToast({ title: errMsg.value, icon: 'none' })
      return
    }
    editing.value = false
    uni.showToast({ title: '已保存', icon: 'success' })
    await load()
  } catch (e: unknown) {
    errMsg.value = (e as Error)?.message || '网络错误'
    uni.showToast({ title: errMsg.value, icon: 'none' })
  } finally {
    savingEdit.value = false
  }
}

function onPickEmployee(e: { detail: { value: string | number } }) {
  const idx = Number(e.detail.value)
  if (idx <= 0) {
    assigningTo.value = null
    return
  }
  const emp = employees.value[idx - 1]
  if (emp) assigningTo.value = emp.id
}

async function submitAssign() {
  if (!woId.value || assignBusy.value) return
  if (!assigningTo.value) {
    uni.showToast({ title: '请选择处理人', icon: 'none' })
    return
  }
  assignBusy.value = true
  errMsg.value = ''
  try {
    const res = (await post(`/api/mp/work-orders/${woId.value}/assign`, {
      assignedTo: assigningTo.value,
    })) as { success?: boolean; message?: string }
    if (!res.success) {
      errMsg.value = res.message || '派单失败'
      uni.showToast({ title: errMsg.value, icon: 'none' })
      return
    }
    uni.showToast({ title: '已派单', icon: 'success' })
    await load()
  } catch (e: unknown) {
    errMsg.value = (e as Error)?.message || '网络错误'
    uni.showToast({ title: errMsg.value, icon: 'none' })
  } finally {
    assignBusy.value = false
  }
}

function addEditPhotos() {
  if (!canEditBasics.value) return
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
    <view v-if="loading" class="loading">加载中…</view>
    <view v-else-if="!wo" class="empty">
      <text>{{ errMsg || '工单不存在' }}</text>
    </view>
    <view v-else class="shell" :class="{ 'shell--footer': showFooter }">
      <view class="content">
        <view class="hero">
          <view class="hero-top">
            <text class="hero-code">{{ wo.code }}</text>
            <view class="hero-status">{{ wo.status }}</view>
          </view>
          <text class="hero-title">{{ wo.title }}</text>
        </view>

        <view class="card flow-card">
          <text class="sec-title">流程进度</text>
          <view v-if="flowState.cancelled" class="flow-cancel">
            <text>工单已取消，流程已终止。</text>
          </view>
          <scroll-view v-else scroll-x class="flow-scroll" :show-scrollbar="false" enable-flex>
            <view class="flow-row">
              <template v-for="(label, i) in STEP_LABELS" :key="label">
                <view class="flow-col">
                  <view
                    :class="['flow-dot', i <= flowState.activeIndex ? 'flow-dot--on' : 'flow-dot--off']"
                  >
                    <text class="flow-num">{{ i + 1 }}</text>
                  </view>
                  <text
                    :class="['flow-lbl', i <= flowState.activeIndex ? 'flow-lbl--on' : 'flow-lbl--off']"
                  >
                    {{ label }}
                  </text>
                </view>
                <view
                  v-if="i < STEP_LABELS.length - 1"
                  :class="[
                    'flow-bridge',
                    i < flowState.activeIndex ? 'flow-bridge--on' : 'flow-bridge--off',
                  ]"
                />
              </template>
            </view>
          </scroll-view>
          <text v-if="!flowState.cancelled" class="flow-tip">
            当前及之前节点为高亮；未到达的步骤为灰色。租客支付费用后进入「待处理」；未走收费流程则保持「处理中」直至办结。
          </text>
          <text class="sub-sec-title">时间记录</text>
          <view class="kv">
            <text class="k">创建时间</text>
            <text class="v mono">{{ formatDateTime(wo.createdAt) }}</text>
          </view>
          <view class="kv">
            <text class="k">最近更新</text>
            <text class="v mono">{{ formatDateTime(wo.updatedAt) }}</text>
          </view>
          <view class="kv">
            <text class="k">派单时间</text>
            <text class="v mono">{{ formatDateTime(wo.assignedAt) }}</text>
          </view>
          <view class="kv">
            <text class="k">开始响应</text>
            <text class="v mono">{{ formatDateTime(wo.respondedAt) }}</text>
          </view>
          <view class="kv">
            <text class="k">费用确认时间</text>
            <text class="v mono">{{ formatDateTime(wo.feeConfirmedAt) }}</text>
          </view>
          <view class="kv">
            <text class="k">办结时间</text>
            <text class="v mono">{{ formatDateTime(wo.completedAt) }}</text>
          </view>
          <view class="kv">
            <text class="k">评价完成时间</text>
            <text class="v mono">{{ formatDateTime(wo.evaluatedAt) }}</text>
          </view>
        </view>

        <view class="card">
          <text class="sec-title">问题描述</text>
          <text class="block-text">{{ wo.description || '—' }}</text>
        </view>

        <view class="card">
          <text class="sec-title">分类与来源</text>
          <view class="kv">
            <text class="k">工单类型</text>
            <text class="v">{{ wo.type }}</text>
          </view>
          <view class="kv">
            <text class="k">来源</text>
            <text class="v">{{ displaySource(wo.source) }}</text>
          </view>
          <view v-if="wo.facilityScope" class="kv">
            <text class="k">设施范围</text>
            <text class="v">{{ wo.facilityScope }}</text>
          </view>
          <view v-if="wo.severity" class="kv">
            <text class="k">紧急程度</text>
            <text class="v">{{ wo.severity }}</text>
          </view>
          <view class="kv">
            <text class="k">费用知情确认</text>
            <text class="v">{{ boolLabel(wo.feeNoticeAcknowledged) }}</text>
          </view>
        </view>

        <view class="card">
          <text class="sec-title">位置与关联</text>
          <view v-if="wo.building" class="kv">
            <text class="k">楼宇</text>
            <text class="v">{{ wo.building.name }}</text>
          </view>
          <view v-if="wo.room" class="kv">
            <text class="k">房源</text>
            <text class="v">{{ wo.room.roomNumber }} · {{ wo.room.name }}</text>
          </view>
          <view class="kv">
            <text class="k">租客</text>
            <text class="v">{{ wo.tenant?.companyName?.trim() ? wo.tenant.companyName : '—' }}</text>
          </view>
          <view class="kv">
            <text class="k">详细位置</text>
            <text class="v">{{ wo.location || '—' }}</text>
          </view>
        </view>

        <view class="card">
          <text class="sec-title">人员</text>
          <view v-if="wo.reporter" class="kv">
            <text class="k">报单人</text>
            <view class="kv-r">
              <text class="v kv-v-main"
                >{{ wo.reporter.role }} · {{ wo.reporter.name }} {{ wo.reporter.phone }}</text
              >
              <view
                v-if="normalizeDialNumber(wo.reporter.phone)"
                class="dial-btn"
                @tap.stop="dialPhone(wo.reporter.phone)"
              >
                <text class="dial-btn-text">拨号</text>
              </view>
            </view>
          </view>
          <view v-else class="kv">
            <text class="k">报单人 ID</text>
            <text class="v">{{ wo.reporterId }}</text>
          </view>
          <view class="kv">
            <text class="k">处理人</text>
            <view class="kv-r">
              <text class="v kv-v-main">
                {{
                  wo.assignedEmployee
                    ? `${wo.assignedEmployee.name} ${wo.assignedEmployee.phone}`
                    : wo.assignedTo
                      ? `已派单（员工 #${wo.assignedTo}）`
                      : '未派单'
                }}
              </text>
              <view
                v-if="normalizeDialNumber(wo.assignedEmployee?.phone)"
                class="dial-btn"
                @tap.stop="dialPhone(wo.assignedEmployee?.phone)"
              >
                <text class="dial-btn-text">拨号</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="canEditBasics" class="card">
          <text class="sec-title">编辑工单</text>
          <view v-if="!editing" class="edit-intro">
            <text class="hint">工单未结束前可修改标题、描述与现场图片。</text>
            <button class="btn ghost mt" :disabled="savingEdit" @tap="editing = true">编辑</button>
          </view>
          <view v-else class="edit-form">
            <text class="fld-lbl">标题 *</text>
            <input v-model="editTitle" class="fld-input" placeholder="标题" />
            <text class="fld-lbl">描述</text>
            <textarea v-model="editDescription" class="fld-textarea" placeholder="问题描述" />
            <text class="fld-lbl">现场图片（最多 {{ MAX_EDIT_IMAGES }} 张）</text>
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
            <view class="row-2 mt">
              <button class="btn ghost flex1" :disabled="savingEdit" @tap="cancelEditMode">取消</button>
              <button class="btn primary flex1" :disabled="savingEdit" @tap="saveEdit">
                {{ savingEdit ? '保存中…' : '保存' }}
              </button>
            </view>
          </view>
        </view>

        <view v-if="wo.projectId != null || wo.taskId != null || wo.tagId" class="card">
          <text class="sec-title">系统字段</text>
          <view v-if="wo.projectId != null" class="kv">
            <text class="k">项目 ID</text>
            <text class="v mono">{{ wo.projectId }}</text>
          </view>
          <view v-if="wo.taskId != null" class="kv">
            <text class="k">关联任务 ID</text>
            <text class="v mono">{{ wo.taskId }}</text>
          </view>
          <view v-if="wo.tagId" class="kv">
            <text class="k">标签 ID</text>
            <text class="v mono">{{ wo.tagId }}</text>
          </view>
        </view>

        <view v-if="resolvedImageUrls.length" class="card">
          <text class="sec-title">现场图片（点击查看大图）</text>
          <view class="imgs">
            <view
              v-for="(url, i) in resolvedImageUrls"
              :key="i"
              class="img-cell"
              hover-class="img-cell--hover"
              @tap.stop="previewImgs(resolvedImageUrls, i)"
            >
              <image
                class="img"
                :src="url"
                mode="aspectFill"
                show-menu-by-longpress
              />
            </view>
          </view>
        </view>

        <view
          v-if="
            (wo.feeRemark != null && String(wo.feeRemark).trim() !== '') ||
            (wo.feeTotal != null && Number.isFinite(Number(wo.feeTotal))) ||
            wo.status === '待员工确认费用' ||
            wo.status === '待租客确认费用'
          "
          class="card card--fee-remark"
        >
          <text class="sec-title">费用信息</text>
          <view
            v-if="wo.feeTotal != null && Number.isFinite(Number(wo.feeTotal))"
            class="kv fee-info-row"
          >
            <text class="k">费用合计</text>
            <text class="v fee-total-num">{{ Number(wo.feeTotal).toFixed(2) }} 元</text>
          </view>
          <view class="kv fee-info-row fee-info-row--last">
            <text class="k">费用说明</text>
            <text class="v fee-remark-body">{{
              wo.feeRemark != null && String(wo.feeRemark).trim() !== ''
                ? String(wo.feeRemark)
                : '—'
            }}</text>
          </view>
        </view>

        <view v-if="resolvedCompletionUrls.length" class="card card--completion">
          <text class="sec-title">办结现场</text>
          <view class="imgs">
            <view
              v-for="(url, i) in resolvedCompletionUrls"
              :key="'c' + i"
              class="img-cell"
              hover-class="img-cell--hover"
              @tap.stop="previewImgs(resolvedCompletionUrls, i)"
            >
              <image class="img" :src="url" mode="aspectFill" show-menu-by-longpress />
            </view>
          </view>
          <view v-if="wo.completionRemark?.trim()" class="kv fee-info-row fee-info-row--last">
            <text class="k">办结说明</text>
            <text class="v fee-remark-body">{{ wo.completionRemark }}</text>
          </view>
        </view>

        <view v-if="wo.evaluationNote?.trim()" class="card">
          <text class="sec-title">评价说明</text>
          <text class="fee-remark-body">{{ wo.evaluationNote }}</text>
        </view>

        <view class="card log-card">
          <text class="sec-title">操作日志</text>
          <text class="log-auto-tip">以下记录由系统自动生成，与租客端、PC 端一致，不可手动添加。</text>
          <view v-if="activityLogs.length === 0" class="hint">暂无操作记录</view>
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
                  <text class="log-tl-time">{{ formatDateTime(log.createdAt) }}</text>
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
                  <template v-for="(c, ci) in parseLogChanges(log.changesJson)" :key="ci">
                    <view
                      v-if="c.field === 'images'"
                      class="log-tl-change log-tl-change--imgs"
                    >
                      <text class="log-tl-change-tag">{{ c.label }}</text>
                      <view v-if="logImageChangeSides(c) === null" class="log-img-fallback">
                        <text class="log-img-fallback-line">变更前：{{ truncateLogText(c.from, 240) }}</text>
                        <text class="log-img-fallback-line">变更后：{{ truncateLogText(c.to, 240) }}</text>
                      </view>
                      <view v-else class="log-img-diff">
                        <view class="log-img-col">
                          <text class="log-img-lbl">变更前</text>
                          <text v-if="logImageChangeSides(c)!.from.length === 0" class="log-img-empty">（无）</text>
                          <view v-else class="log-img-thumb-row">
                            <view
                              v-for="(u, ui) in logImageChangeSides(c)!.from"
                              :key="'bf' + ui"
                              class="log-thumb-wrap"
                              @tap.stop="previewLogImages(logImageChangeSides(c)!.from, ui)"
                            >
                              <image
                                v-if="isLikelyImageUrl(u)"
                                class="log-thumb"
                                :src="resolveMediaUrl(u)"
                                mode="aspectFill"
                              />
                              <text v-else class="log-file-name">{{ fileNameFromAttachmentUrl(u) }}</text>
                            </view>
                          </view>
                        </view>
                        <view class="log-img-col">
                          <text class="log-img-lbl">变更后</text>
                          <text v-if="logImageChangeSides(c)!.to.length === 0" class="log-img-empty">（无）</text>
                          <view v-else class="log-img-thumb-row">
                            <view
                              v-for="(u, ui) in logImageChangeSides(c)!.to"
                              :key="'af' + ui"
                              class="log-thumb-wrap"
                              @tap.stop="previewLogImages(logImageChangeSides(c)!.to, ui)"
                            >
                              <image
                                v-if="isLikelyImageUrl(u)"
                                class="log-thumb"
                                :src="resolveMediaUrl(u)"
                                mode="aspectFill"
                              />
                              <text v-else class="log-file-name">{{ fileNameFromAttachmentUrl(u) }}</text>
                            </view>
                          </view>
                        </view>
                      </view>
                    </view>
                    <view v-else class="log-tl-change">
                      <text class="log-tl-change-tag">{{ c.label }}</text>
                      <text class="log-tl-change-body">
                        ：{{ truncateLogText(c.from) }} → {{ truncateLogText(c.to) }}
                      </text>
                    </view>
                  </template>
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

        <text v-if="errMsg" class="err">{{ errMsg }}</text>
        <view class="content-tail" />
      </view>

      <view v-if="showFooter" class="footer">
        <view class="footer-inner footer-inner--stack">
          <template v-if="wo.status === '待派单'">
            <text class="footer-sec-lbl">派单 · 选择处理人</text>
            <picker
              mode="selector"
              :range="employeePickerLabels"
              :value="employeePickerIndex"
              @change="onPickEmployee"
            >
              <view class="pick-row pick-row--footer">
                <text class="k">处理人</text>
                <text class="pick-val">{{ employeePickerLabels[employeePickerIndex] }}</text>
              </view>
            </picker>
            <button
              class="btn primary"
              :disabled="assignBusy || assigningTo == null || busy"
              @tap="submitAssign"
            >
              {{ assignBusy ? '提交中…' : '确认派单' }}
            </button>
            <button class="btn danger" :disabled="busy || assignBusy" @tap="confirmCancel">
              取消工单
            </button>
          </template>

          <template v-else-if="wo.status === '待响应'">
            <button
              class="btn primary"
              :disabled="busy"
              @tap="advance('start_processing')"
            >
              开始处理
            </button>
            <text class="footer-sec-lbl">改派（可选）</text>
            <picker
              mode="selector"
              :range="employeePickerLabels"
              :value="employeePickerIndex"
              @change="onPickEmployee"
            >
              <view class="pick-row pick-row--footer">
                <text class="k">处理人</text>
                <text class="pick-val">{{ employeePickerLabels[employeePickerIndex] }}</text>
              </view>
            </picker>
            <button
              class="btn ghost"
              :disabled="assignBusy || assigningTo == null || busy"
              @tap="submitAssign"
            >
              {{ assignBusy ? '提交中…' : '确认改派' }}
            </button>
            <button class="btn danger" :disabled="busy || assignBusy" @tap="confirmCancel">
              取消工单
            </button>
          </template>

          <template v-else-if="wo.status === '处理中'">
            <view class="row-2">
              <button class="btn warn flex1" :disabled="busy" @tap="openFeeModal">
                登记费用
              </button>
              <button class="btn ok flex1" :disabled="busy" @tap="openCompleteModal">
                办结待评价
              </button>
            </view>
            <button class="btn ghost mt" :disabled="busy" @tap="confirmNoFeeContinue">
              未产生任何费用
            </button>
          </template>

          <template v-else-if="wo.status === '待处理'">
            <text class="footer-tip">
              {{
                wo.hasWorkOrderFeeBill === true
                  ? '租客已在线付费，请继续维修。办结进入待评价；不可再登记费用。需关单并冲账请点「退费并取消工单」。'
                  : '已通过内部确认费用（无租客费用账单），请继续维修。办结进入待评价；不可再登记费用。'
              }}
            </text>
            <button class="btn ok" :disabled="busy" @tap="openCompleteModal">办结待评价</button>
            <button
              v-if="wo.hasWorkOrderFeeBill === true"
              class="btn danger mt"
              :disabled="busy"
              @tap="confirmRefundCancel"
            >
              退费并取消工单
            </button>
          </template>

          <template v-else-if="wo.status === '待评价'">
            <text v-if="isTenantSubmittedWoSource(wo.source)" class="footer-tip">
              本单为租客报修，须租客在租客端评价后才会完结。
            </text>
            <button v-else class="btn primary" :disabled="busy" @tap="openEvalModal">
              标记评价完成
            </button>
          </template>

          <template v-else-if="wo.status === '待员工确认费用'">
            <text v-if="wo.tenant" class="footer-tip">请核对费用无误后送租客确认。</text>
            <text v-else class="footer-tip">
              本单未关联租客：可指定「费用承担租客」后送租客在线支付；或「仅内部确认」不产生账单，直接进入待处理。
            </text>
            <picker
              v-if="!wo.tenant && feeTenantsBrief.length > 0"
              mode="selector"
              :range="feeTenantPickerLabels"
              :value="feeAssignPickerIndex"
              @change="onFeeTenantPickerChange"
            >
              <view class="fee-tenant-picker">
                {{ feeTenantPickerLabels[feeAssignPickerIndex] }}
              </view>
            </picker>
            <text
              v-else-if="!wo.tenant && feeTenantsBrief.length === 0"
              class="footer-tip muted"
            >
              当前筛选下无租客档案，请使用「仅内部确认」或先在后台维护该楼宇租客。
            </text>
            <button class="btn warn" :disabled="busy" @tap="publishFeeForTenantTap">
              确认并送租客核对
            </button>
            <button
              v-if="!wo.tenant"
              class="btn ghost mt"
              :disabled="busy"
              @tap="confirmFeeInternalPending"
            >
              仅内部确认（不产生账单）
            </button>
          </template>
          <view v-else-if="wo.status === '待租客确认费用'" class="footer-tip">
            等待租客在租客端支付费用；支付成功后进入「待处理」。若拒绝付费，工单将取消。
          </view>
        </view>
      </view>
    </view>

    <view
      v-if="showFeeModal"
      class="fee-modal-mask"
      @touchmove.stop.prevent
      @tap="closeFeeModal"
    >
      <view class="fee-modal-panel" @tap.stop>
        <text class="fee-modal-title">提交费用</text>
        <text class="fee-modal-desc">
          有费用：填写合计（大于 0）与费用说明，进入「待员工确认费用」→ 送租客核对与支付。无费用：合计填 0 或留空，点确认即可继续「处理中」，无需租客确认。
        </text>
        <text class="fee-modal-fld-lbl">费用合计（元）</text>
        <input
          class="fee-modal-input"
          type="text"
          inputmode="decimal"
          :value="feeModalTotalStr"
          placeholder="无费用填 0 或留空；有费用须大于 0"
          @input="onFeeModalTotalInput"
        />
        <text class="fee-modal-fld-lbl">费用说明（有费用时必填）</text>
        <textarea
          v-model="feeModalDraft"
          class="fee-modal-textarea"
          placeholder="无费用可不填；有费用请说明预估或计价方式"
          :maxlength="2000"
        />
        <view class="fee-modal-actions">
          <button class="btn ghost flex1" :disabled="busy" @tap="closeFeeModal">取消</button>
          <button class="btn warn flex1" :disabled="busy" @tap="confirmSubmitFeeFromModal">
            {{ busy ? '提交中…' : '确认' }}
          </button>
        </view>
      </view>
    </view>

    <view
      v-if="showCompleteModal"
      class="fee-modal-mask"
      @touchmove.stop.prevent
      @tap="closeCompleteModal"
    >
      <view class="fee-modal-panel" @tap.stop>
        <text class="fee-modal-title">办结并进入待评价</text>
        <text class="fee-modal-desc">
          须上传至少 1 张、最多 10 张现场照片（jpg / jpeg / png）。点击缩略图可放大，多张时可左右滑动查看。办结说明选填。
        </text>
        <view class="complete-thumb-row">
          <view v-for="(u, ci) in completeModalUrls" :key="u + ci" class="complete-thumb-wrap">
            <image
              class="complete-thumb"
              :src="resolveMediaUrl(u)"
              mode="aspectFill"
              @tap.stop="previewCompletionModalPhotos(ci)"
            />
            <view class="complete-thumb-del" @tap.stop="removeCompletionModalPhoto(ci)">
              <text>×</text>
            </view>
          </view>
        </view>
        <button
          class="btn ghost complete-add-btn"
          :disabled="busy || completeModalUploading || completeModalUrls.length >= 10"
          @tap="addCompletionModalPhotos"
        >
          {{ completeModalUploading ? '上传中…' : '选择照片' }}
        </button>
        <text class="fee-modal-fld-lbl">办结说明（选填）</text>
        <textarea
          v-model="completeModalRemark"
          class="fee-modal-textarea"
          placeholder="可填写处理结果摘要等"
          :maxlength="2000"
        />
        <view class="fee-modal-actions">
          <button class="btn ghost flex1" :disabled="busy" @tap="closeCompleteModal">取消</button>
          <button
            class="btn ok flex1"
            :disabled="busy || completeModalUrls.length < 1 || completeModalUploading"
            @tap="confirmCompleteFromModal"
          >
            {{ busy ? '提交中…' : '确认办结' }}
          </button>
        </view>
      </view>
    </view>

    <view
      v-if="showEvalModal"
      class="fee-modal-mask"
      @touchmove.stop.prevent
      @tap="closeEvalModal"
    >
      <view class="fee-modal-panel" @tap.stop>
        <text class="fee-modal-title">标记评价完成</text>
        <text class="fee-modal-desc">评价内容选填，可不填直接确认。</text>
        <textarea
          v-model="evalModalDraft"
          class="fee-modal-textarea"
          placeholder="选填：服务评价或备注"
          :maxlength="2000"
        />
        <view class="fee-modal-actions">
          <button class="btn ghost flex1" :disabled="busy" @tap="closeEvalModal">取消</button>
          <button class="btn primary flex1" :disabled="busy" @tap="confirmEvalFromModal">
            {{ busy ? '提交中…' : '确认' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: $pms-bg;
  box-sizing: border-box;
}

.loading,
.empty {
  text-align: center;
  padding: 100rpx 40rpx;
  color: $pms-text-muted;
  font-size: 28rpx;
}

.shell {
  min-height: 100vh;
  box-sizing: border-box;
}

.shell--footer .content {
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.content {
  padding: 24rpx 24rpx 0;
}

.content-tail {
  height: 24rpx;
}

.shell--footer .content-tail {
  /** 底部含派单/改派多行操作，预留足够空间避免遮挡操作日志等 */
  height: calc(420rpx + env(safe-area-inset-bottom));
}

.hero {
  margin-bottom: 24rpx;
}
.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.hero-code {
  font-size: 22rpx;
  font-family: ui-monospace, monospace;
  color: $pms-text-dim;
}
.hero-status {
  font-size: 24rpx;
  font-weight: 700;
  color: $pms-accent;
  background: $pms-accent-soft;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
}
.hero-title {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: $pms-text;
  line-height: 1.35;
}

.flow-card {
  overflow: hidden;
}

.flow-cancel {
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: rgba(248, 113, 113, 0.12);
  border: 1rpx solid rgba(248, 113, 113, 0.35);
  margin-bottom: 8rpx;
  font-size: 26rpx;
  color: $pms-danger;
}

.flow-scroll {
  width: 100%;
  margin-bottom: 4rpx;
}

.flow-row {
  display: inline-flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 12rpx 4rpx 16rpx;
}

.flow-col {
  width: 100rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.flow-dot {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border-width: 3rpx;
  border-style: solid;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.flow-dot--on {
  border-color: $pms-accent;
  background: $pms-accent;
}

.flow-dot--off {
  border-color: rgba(148, 163, 184, 0.35);
  background: $pms-bg-deep;
}

.flow-num {
  font-size: 24rpx;
  font-weight: 700;
}

.flow-dot--on .flow-num {
  color: #fff;
}

.flow-dot--off .flow-num {
  color: $pms-text-dim;
}

.flow-lbl {
  margin-top: 12rpx;
  font-size: 20rpx;
  line-height: 1.3;
  text-align: center;
  width: 100%;
}

.flow-lbl--on {
  color: $pms-accent;
  font-weight: 600;
}

.flow-lbl--off {
  color: $pms-text-dim;
}

.flow-bridge {
  width: 28rpx;
  height: 6rpx;
  border-radius: 3rpx;
  flex-shrink: 0;
  margin-top: 28rpx;
}

.flow-bridge--on {
  background: $pms-accent;
}

.flow-bridge--off {
  background: rgba(148, 163, 184, 0.22);
}

.flow-tip {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  line-height: 1.5;
  margin-bottom: 20rpx;
}

.sub-sec-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
  margin-top: 4rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid $pms-border;
}

.card {
  @include pms-card;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
}

.sec-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-text;
  margin-bottom: 20rpx;
  padding-left: 16rpx;
  border-left: 6rpx solid $pms-accent;
}

.block-text {
  display: block;
  font-size: 28rpx;
  color: $pms-text-muted;
  line-height: 1.65;
  white-space: pre-wrap;
}
.block-text.muted {
  color: $pms-text-dim;
}

.kv {
  display: flex;
  gap: 20rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $pms-border;
  font-size: 26rpx;
  align-items: flex-start;
}
.kv:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.kv:first-of-type {
  padding-top: 0;
}
.k {
  width: 200rpx;
  flex-shrink: 0;
  color: $pms-text-dim;
}
.v {
  flex: 1;
  color: $pms-text-muted;
  text-align: right;
  word-break: break-all;
}

.kv-r {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 16rpx;
}

.kv-v-main {
  text-align: right;
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

.v.mono {
  font-family: ui-monospace, monospace;
  font-size: 24rpx;
}

.imgs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.img-cell {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 100%;
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
}

.img-cell--hover {
  opacity: 0.88;
}

.img {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.card--fee-remark {
  border-color: rgba(251, 191, 36, 0.35);
}

.fee-remark-body {
  color: $pms-text-muted;
}

.card--completion {
  border-color: rgba(16, 185, 129, 0.35);
}

.complete-thumb-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin: 20rpx 0;
}

.complete-thumb-wrap {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1rpx solid $pms-border;
}

.complete-thumb {
  width: 100%;
  height: 100%;
  display: block;
}

.complete-thumb-del {
  position: absolute;
  right: 0;
  top: 0;
  width: 44rpx;
  height: 44rpx;
  background: rgba(220, 38, 38, 0.92);
  color: #fff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.complete-add-btn {
  width: 100%;
  margin-bottom: 16rpx;
}

.fee-modal-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.fee-modal-panel {
  width: 100%;
  max-width: 680rpx;
  max-height: 75vh;
  background: $pms-bg-deep;
  border-radius: 24rpx 24rpx 16rpx 16rpx;
  border: 1rpx solid $pms-border;
  padding: 32rpx 28rpx 28rpx;
  box-shadow: 0 -16rpx 48rpx rgba(0, 0, 0, 0.45);
}

.fee-modal-title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: $pms-text;
  margin-bottom: 16rpx;
}

.fee-modal-desc {
  display: block;
  font-size: 24rpx;
  color: $pms-text-dim;
  line-height: 1.5;
  margin-bottom: 20rpx;
}

.fee-modal-fld-lbl {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: $pms-text-muted;
  margin-bottom: 12rpx;
}

.fee-modal-input {
  width: 100%;
  height: 88rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: rgba(15, 23, 42, 0.6);
  color: $pms-text;
  font-size: 30rpx;
  box-sizing: border-box;
  margin-bottom: 20rpx;
}

.fee-info-row {
  border-bottom: 1rpx solid $pms-border;
  padding: 14rpx 0;
  align-items: flex-start;
}

.fee-info-row--last {
  border-bottom: none;
  padding-bottom: 0;
}

.fee-total-num {
  font-weight: 700;
  color: #fbbf24;
}

.fee-modal-textarea {
  width: 100%;
  min-height: 220rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: rgba(15, 23, 42, 0.6);
  color: $pms-text;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}

.fee-modal-actions {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}

.err {
  display: block;
  font-size: 24rpx;
  color: $pms-danger;
  padding: 0 8rpx 16rpx;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, $pms-bg 28%);
  padding-top: 32rpx;
}

.footer-inner {
  background: $pms-bg-deep;
  border-top: 1rpx solid $pms-border;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -8rpx 32rpx rgba(0, 0, 0, 0.35);
}

.footer-inner--stack {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.footer-sec-lbl {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: $pms-text-muted;
  margin-top: 4rpx;
}

.pick-row--footer {
  margin-bottom: 0;
}

.row-2 {
  display: flex;
  gap: 16rpx;
}
.flex1 {
  flex: 1;
}
.mt {
  margin-top: 16rpx;
}

.btn {
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 18rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  width: 100%;
}
.btn::after {
  border: none;
}
.btn.primary {
  background: linear-gradient(135deg, $pms-accent 0%, #16a34a 100%);
  color: #fff;
}
.btn.ok {
  background: #059669;
  color: #fff;
}
.btn.warn {
  background: #d97706;
  color: #fff;
}
.btn.ghost {
  background: $pms-surface;
  color: $pms-text-muted;
  border: 1rpx solid $pms-border;
}
.btn.danger {
  background: transparent;
  color: $pms-danger;
  border: 1rpx solid rgba(248, 113, 113, 0.5);
}
.btn[disabled] {
  opacity: 0.45;
}

.footer-tip {
  font-size: 26rpx;
  line-height: 1.55;
  color: #fbbf24;
  text-align: center;
  padding: 16rpx 8rpx;
}
.footer-tip.muted {
  color: $pms-text-dim;
}
.fee-tenant-picker {
  width: 100%;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
  color: $pms-text;
  font-size: 28rpx;
  text-align: center;
  box-sizing: border-box;
}

.hint {
  display: block;
  font-size: 26rpx;
  color: $pms-text-dim;
  line-height: 1.5;
}

.edit-intro .btn {
  width: 100%;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.fld-lbl {
  font-size: 26rpx;
  color: $pms-text-muted;
  font-weight: 600;
}

.fld-input {
  width: 100%;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
  color: $pms-text;
  font-size: 28rpx;
  box-sizing: border-box;
}

.fld-textarea {
  width: 100%;
  min-height: 200rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
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
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
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
  right: 8rpx;
  top: 8rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  line-height: 1;
}

.edit-img-add {
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  border: 2rpx dashed $pms-border;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  color: $pms-text-dim;
  background: $pms-bg-deep;
}

.pick-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
  margin-bottom: 16rpx;
}

.pick-val {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
  color: $pms-accent;
}

.log-card .sec-title {
  margin-bottom: 12rpx;
}

.log-auto-tip {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  line-height: 1.45;
  margin-bottom: 24rpx;
}

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

.log-tl-change--imgs {
  flex-direction: column;
  align-items: stretch;
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

.log-img-fallback {
  margin-top: 8rpx;
  padding: 16rpx;
  border-radius: 12rpx;
  background: rgba(251, 191, 36, 0.08);
  border: 1rpx solid rgba(251, 191, 36, 0.35);
}

.log-img-fallback-line {
  display: block;
  font-size: 22rpx;
  color: $pms-text-muted;
  line-height: 1.45;
  margin-bottom: 8rpx;
  word-break: break-all;
}

.log-img-fallback-line:last-child {
  margin-bottom: 0;
}

.log-img-diff {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  margin-top: 12rpx;
  flex-wrap: wrap;
}

.log-img-col {
  flex: 1;
  min-width: 240rpx;
}

.log-img-lbl {
  display: block;
  font-size: 22rpx;
  color: $pms-text-dim;
  margin-bottom: 10rpx;
}

.log-img-empty {
  font-size: 22rpx;
  color: $pms-text-dim;
}

.log-img-thumb-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.log-thumb-wrap {
  width: 112rpx;
  height: 112rpx;
  border-radius: 12rpx;
  overflow: hidden;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-thumb {
  width: 100%;
  height: 100%;
  display: block;
}

.log-file-name {
  font-size: 18rpx;
  color: $pms-accent;
  padding: 8rpx;
  text-align: center;
  word-break: break-all;
  line-height: 1.2;
}
</style>
