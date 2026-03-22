<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { get, post, resolveMediaUrl } from '@/api/request'

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
  feeNoticeAcknowledged: boolean
  location: string | null
  severity: string | null
  projectId: number | null
  taskId: number | null
  tagId: string | null
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
  createdAt: string
  updatedAt: string
}

const woId = ref(0)
const wo = ref<Wo | null>(null)
const loading = ref(true)
const busy = ref(false)
const feeRemark = ref('')
const showFee = ref(false)
const errMsg = ref('')

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

const resolvedImageUrls = computed(() =>
  (wo.value?.imageUrls ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean)
)

const showFooter = computed(() => {
  const w = wo.value
  if (!w) return false
  const s = w.status
  return (
    s === '待派单' ||
    s === '待响应' ||
    s === '处理中' ||
    s === '待确认费用' ||
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
    }
    wo.value = res.workOrder ?? null
    if (!res.success || !res.workOrder) {
      errMsg.value = res.message || '加载失败'
    }
    if (res.workOrder?.feeRemark) {
      feeRemark.value = res.workOrder.feeRemark
    }
  } catch {
    wo.value = null
    errMsg.value = '网络错误'
  } finally {
    loading.value = false
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
  | 'complete_for_evaluation'
  | 'mark_evaluated'
  | 'cancel'

async function advance(action: AdvanceAction) {
  if (!woId.value || busy.value) return
  busy.value = true
  errMsg.value = ''
  try {
    const body: { action: AdvanceAction; feeRemark?: string } = { action }
    if (action === 'request_fee_confirmation') {
      body.feeRemark = feeRemark.value.trim() || undefined
    }
    const res = (await post(`/api/work-orders/${woId.value}/advance`, body)) as {
      success?: boolean
      message?: string
    }
    if (!res.success) {
      errMsg.value = res.message || '操作失败'
      uni.showToast({ title: errMsg.value, icon: 'none' })
      return
    }
    showFee.value = false
    uni.showToast({ title: '已更新', icon: 'success' })
    await load()
  } catch (e: unknown) {
    errMsg.value = (e as Error)?.message || '网络错误'
    uni.showToast({ title: errMsg.value, icon: 'none' })
  } finally {
    busy.value = false
  }
}

function previewImgs(urls: string[], current: string) {
  if (!urls?.length) return
  uni.previewImage({ urls, current })
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

function boolLabel(v: boolean | undefined | null): string {
  if (v === true) return '是'
  if (v === false) return '否'
  return '-'
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
          <view v-if="wo.tenant" class="kv">
            <text class="k">租客</text>
            <text class="v">{{ wo.tenant.companyName }}</text>
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
            <text class="v">{{ wo.reporter.role }} · {{ wo.reporter.name }} {{ wo.reporter.phone }}</text>
          </view>
          <view v-else class="kv">
            <text class="k">报单人 ID</text>
            <text class="v">{{ wo.reporterId }}</text>
          </view>
          <view class="kv">
            <text class="k">处理人</text>
            <text class="v">
              {{
                wo.assignedEmployee
                  ? `${wo.assignedEmployee.name} ${wo.assignedEmployee.phone}`
                  : wo.assignedTo
                    ? `已派单（员工 #${wo.assignedTo}）`
                    : '未派单'
              }}
            </text>
          </view>
        </view>

        <view v-if="wo.feeRemark || wo.status === '待确认费用'" class="card">
          <text class="sec-title">费用说明</text>
          <text class="block-text muted">{{ wo.feeRemark || '暂无' }}</text>
        </view>

        <view class="card">
          <text class="sec-title">时间节点</text>
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
            <image
              v-for="(url, i) in resolvedImageUrls"
              :key="i"
              class="img"
              :src="url"
              mode="aspectFill"
              show-menu-by-longpress
              @tap.stop="previewImgs(resolvedImageUrls, url)"
            />
          </view>
        </view>

        <view v-if="wo.status === '处理中' && showFee" class="card fee-card">
          <text class="sec-title">费用说明（选填）</text>
          <textarea
            v-model="feeRemark"
            class="fee-input"
            placeholder="填写后提交，将进入「待确认费用」"
          />
        </view>

        <text v-if="errMsg" class="err">{{ errMsg }}</text>
        <view class="content-tail" />
      </view>

      <view v-if="showFooter" class="footer">
        <view class="footer-inner">
          <template v-if="wo.status === '待响应' || wo.status === '待派单'">
            <button
              v-if="wo.status === '待响应'"
              class="btn primary"
              :disabled="busy"
              @tap="advance('start_processing')"
            >
              开始处理
            </button>
            <button
              class="btn danger"
              :disabled="busy"
              @tap="confirmCancel"
            >
              取消工单
            </button>
          </template>

          <template v-else-if="wo.status === '处理中'">
            <view v-if="!showFee" class="row-2">
              <button class="btn warn flex1" :disabled="busy" @tap="showFee = true">
                提交费用待确认
              </button>
              <button class="btn ok flex1" :disabled="busy" @tap="advance('complete_for_evaluation')">
                办结待评价
              </button>
            </view>
            <view v-else class="row-2">
              <button
                class="btn warn flex1"
                :disabled="busy"
                @tap="advance('request_fee_confirmation')"
              >
                确认提交费用
              </button>
              <button class="btn ghost flex1" :disabled="busy" @tap="showFee = false">
                返回
              </button>
            </view>
            <button class="btn danger mt" :disabled="busy" @tap="confirmCancel">取消工单</button>
          </template>

          <template v-else-if="wo.status === '待评价'">
            <button class="btn primary" :disabled="busy" @tap="advance('mark_evaluated')">
              标记评价完成
            </button>
          </template>

          <view v-else-if="wo.status === '待确认费用'" class="footer-tip">
            等待租客在租客端确认费用后可继续处理。
          </view>
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
  height: calc(200rpx + env(safe-area-inset-bottom));
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
.v.mono {
  font-family: ui-monospace, monospace;
  font-size: 24rpx;
}

.imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.img {
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
}

.fee-card .fee-input {
  width: 100%;
  min-height: 180rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  border: 1rpx solid $pms-border;
  background: $pms-bg-deep;
  color: $pms-text;
  font-size: 28rpx;
  box-sizing: border-box;
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
</style>
