'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import {
  Plus,
  Search,
  Banknote,
  RotateCcw,
  X,
  Users,
  Eye,
  FileText,
  Trash2,
  Landmark,
  Columns3,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react'
import {
  splitBillingPeriod,
  computeMonthlyNetRoom,
  computePeriodReceivableFromMonthly,
  formatBillingPeriodDuration,
  buildRoomReceivableFormulaLine,
} from '@/lib/billing-period'
import { DunningExportDrawer } from './DunningExportDrawer'
import { DateRangeField } from '@/components/ui/DateRangeField'

type Bill = {
  id: number
  code: string
  tenant: { id: number; companyName: string }
  building: { id: number; name: string } | null
  room: { id: number; name: string; roomNumber: string } | null
  /** 合并多房源时逗号分隔；与列表接口一致 */
  roomsDisplay?: string
  feeType: string
  period: string
  accountReceivable: number
  amountPaid: number
  amountDue: number
  /** 已开具收据累计金额，不超过已缴 */
  receiptIssuedAmount?: number
  /** 已开具发票累计金额，不超过应收 */
  invoiceIssuedAmount?: number
  status: string
  paymentStatus: string
  dueDate: string
  remark: string | null
  billSource?: string
  quantityTotal?: number | null
  unitPrice?: number | null
}

type BillRule = {
  id: number
  name: string
  code: string
  feeType: string
  status: string
  amount: number
  discountRate: number
  discountAmount: number
  periodStartDate?: string
  periodEndDate?: string
  dueDateOffsetDays?: number
  /** 与生成账单 API 一致：空数组表示该维度不限制；多维度同时非空时为「且」 */
  tenantIds: number[]
  buildingIds: number[]
  roomIds: number[]
}
type TenantWithRooms = {
  id: number
  companyName: string
  building: { id: number; name: string }
  rooms: { roomId: number; roomNumber: string; name: string; leaseArea?: number }[]
}

type ApiData = {
  list: Bill[]
  buildings: { id: number; name: string }[]
  tenants: { id: number; companyName: string }[]
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '未缴纳',
  partial: '部分缴纳',
  paid: '已结清',
}
const STATUS_LABELS: Record<string, string> = {
  open: '开启',
  closed: '关闭',
}

/** 当前日期晚于应收日期，且结清状态为未缴纳或部分缴纳 → 逾期 */
function billIsOverdue(b: { dueDate: string; paymentStatus: string }): boolean {
  if (b.paymentStatus === 'paid') return false
  const due = b.dueDate.slice(0, 10)
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return due < today
}

const BILL_LIST_COLUMNS_STORAGE = 'pms.billList.columns.v1'

const BILL_COLUMN_KEYS = [
  'code',
  'tenant',
  'building',
  'room',
  'overdue',
  'invoiceIssued',
  'feeType',
  'period',
  'accountReceivable',
  'amountPaid',
  'amountDue',
  'receiptIssued',
  'status',
  'paymentStatus',
  'dueDate',
] as const

export type BillColumnKey = (typeof BILL_COLUMN_KEYS)[number]

const BILL_COLUMN_LABELS: Record<BillColumnKey, string> = {
  code: '账单编号',
  tenant: '租客',
  building: '楼宇',
  room: '房源',
  overdue: '逾期状态',
  invoiceIssued: '已开票',
  feeType: '费用类型',
  period: '账期',
  accountReceivable: '应收',
  amountPaid: '已缴',
  amountDue: '待缴',
  receiptIssued: '已开收据',
  status: '状态',
  paymentStatus: '结清状态',
  dueDate: '应收日期',
}

function defaultBillColumnPrefs(): {
  order: BillColumnKey[]
  visible: Record<BillColumnKey, boolean>
} {
  const order = [...BILL_COLUMN_KEYS]
  const visible = Object.fromEntries(BILL_COLUMN_KEYS.map((k) => [k, true])) as Record<
    BillColumnKey,
    boolean
  >
  return { order, visible }
}

function loadBillColumnPrefs(): {
  order: BillColumnKey[]
  visible: Record<BillColumnKey, boolean>
} {
  const defaults = defaultBillColumnPrefs()
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(BILL_LIST_COLUMNS_STORAGE)
    if (!raw) return defaults
    const p = JSON.parse(raw) as { order?: unknown; visible?: unknown }
    let order = Array.isArray(p.order)
      ? p.order.filter((k): k is BillColumnKey => BILL_COLUMN_KEYS.includes(k as BillColumnKey))
      : [...defaults.order]
    for (const k of BILL_COLUMN_KEYS) {
      if (!order.includes(k)) order = [...order, k]
    }
    const visible = { ...defaults.visible }
    if (p.visible && typeof p.visible === 'object' && p.visible !== null) {
      const vis = p.visible as Record<string, unknown>
      for (const k of BILL_COLUMN_KEYS) {
        if (typeof vis[k] === 'boolean') visible[k] = vis[k] as boolean
      }
    }
    if (BILL_COLUMN_KEYS.filter((k) => visible[k]).length < 1) return defaults
    return { order, visible }
  } catch {
    return defaults
  }
}

function saveBillColumnPrefs(prefs: { order: BillColumnKey[]; visible: Record<BillColumnKey, boolean> }) {
  try {
    localStorage.setItem(BILL_LIST_COLUMNS_STORAGE, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

function billColumnThClass(key: BillColumnKey): string {
  const right = new Set<BillColumnKey>([
    'accountReceivable',
    'amountPaid',
    'amountDue',
    'receiptIssued',
    'invoiceIssued',
  ])
  const base = 'p-4 font-medium'
  if (key === 'invoiceIssued' || key === 'receiptIssued') return `${base} text-right text-xs whitespace-nowrap`
  if (right.has(key)) return `${base} text-right`
  if (key === 'overdue') return `${base} whitespace-nowrap`
  return `${base} text-left`
}

function renderBillColumnCell(b: Bill, key: BillColumnKey): ReactNode {
  switch (key) {
    case 'code':
      return <span className="font-medium">{b.code}</span>
    case 'tenant':
      return b.tenant?.companyName ?? '-'
    case 'building':
      return b.building?.name ?? '-'
    case 'room':
      return b.roomsDisplay ?? b.room?.roomNumber ?? b.room?.name ?? '-'
    case 'overdue':
      return billIsOverdue(b) ? (
        <span className="inline-flex px-2 py-0.5 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          逾期
        </span>
      ) : (
        <span className="inline-flex px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
          未逾期
        </span>
      )
    case 'invoiceIssued':
      return (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          ¥{(b.invoiceIssuedAmount ?? 0).toFixed(2)}
        </span>
      )
    case 'feeType':
      return b.feeType
    case 'period':
      return <span className="text-sm">{b.period}</span>
    case 'accountReceivable':
      return `¥${b.accountReceivable.toFixed(2)}`
    case 'amountPaid':
      return `¥${b.amountPaid.toFixed(2)}`
    case 'amountDue':
      return `¥${b.amountDue.toFixed(2)}`
    case 'receiptIssued':
      return (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          ¥{(b.receiptIssuedAmount ?? 0).toFixed(2)}
        </span>
      )
    case 'status':
      return (
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs ${
            b.status === 'open'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
          }`}
        >
          {STATUS_LABELS[b.status] ?? b.status}
        </span>
      )
    case 'paymentStatus':
      return (
        <span
          className={`inline-flex px-2 py-0.5 rounded text-xs ${
            b.paymentStatus === 'paid'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : b.paymentStatus === 'partial'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
          }`}
        >
          {PAYMENT_STATUS_LABELS[b.paymentStatus] ?? b.paymentStatus}
        </span>
      )
    case 'dueDate':
      return b.dueDate
    default:
      return null
  }
}

function billColumnTdClass(key: BillColumnKey): string {
  const right = new Set<BillColumnKey>([
    'accountReceivable',
    'amountPaid',
    'amountDue',
    'receiptIssued',
    'invoiceIssued',
  ])
  const base = 'p-4'
  if (right.has(key)) return `${base} text-right`
  return base
}
const PAYMENT_METHODS = ['现金', '转账', '微信支付', '其他'] as const

/** 从「500度」「0.35/度」等混合格式中取前导数字，避免部分环境下 parseFloat 异常 */
function parseOptionalNumberInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '')
  if (!t) return null
  const m = t.match(/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) ? n : null
}

type AccountOption = {
  id: number
  name: string
  bankName: string
  accountNumber: string
}

/** 手工新建账单：不校验与已有账单重复；可选总量、单价；租客可不关联房源 */
function CreateManualBillModal({
  tenants,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  tenants: { id: number; companyName: string }[]
  onClose: () => void
  onSuccess: () => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [tenantId, setTenantId] = useState('')
  const [feeType, setFeeType] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [accountReceivable, setAccountReceivable] = useState('')
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [quantityTotal, setQuantityTotal] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [remark, setRemark] = useState('')
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<AccountOption[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/accounts', { credentials: 'include' })
        const json = await res.json()
        if (!cancelled && json.success && Array.isArray(json.data) && json.data.length > 0) {
          setAccounts(json.data)
          setAccountId(String(json.data[0].id))
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async () => {
    const tid = parseInt(tenantId, 10)
    if (!tid || Number.isNaN(tid)) {
      alert('请选择租客')
      return
    }
    if (!feeType.trim()) {
      alert('请填写费用类型')
      return
    }
    if (!periodStart || !periodEnd) {
      alert('请选择账期起止日期')
      return
    }
    const ar = parseFloat(accountReceivable.replace(/,/g, ''))
    if (Number.isNaN(ar) || ar <= 0) {
      alert('应收金额须大于 0')
      return
    }
    const aid = parseInt(accountId, 10)
    if (!aid || Number.isNaN(aid)) {
      alert('请选择收款账户')
      return
    }
    if (accounts.length === 0) {
      alert('请先在「财务设置」中维护收款账户后再新建账单')
      return
    }

    let qty: number | undefined
    if (quantityTotal.trim()) {
      const q = parseOptionalNumberInput(quantityTotal)
      if (q == null || q <= 0) {
        alert('总量须为正数（可带单位，如 500度），或留空')
        return
      }
      qty = q
    }
    let up: number | undefined
    if (unitPrice.trim()) {
      const u = parseOptionalNumberInput(unitPrice)
      if (u == null || u < 0) {
        alert('单价须为大于等于 0 的数（可带单位，如 0.35/度），或留空')
        return
      }
      up = u
    }

    const period = `${periodStart} ~ ${periodEnd}`
    setSubmitting(true)
    try {
      const res = await fetch('/api/bills/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId: tid,
          feeType: feeType.trim(),
          period,
          accountReceivable: ar,
          dueDate,
          remark: remark.trim() || undefined,
          quantityTotal: qty,
          unitPrice: up,
          accountId: aid,
        }),
      })
      const json = await res.json()
      if (json.success) {
        alert(`创建成功，账单编号：${json.data.code}`)
        onSuccess()
      } else {
        alert(json.message || '创建失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold">新建账单</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-sm">
          <p className="text-xs text-slate-500">
            适用于水电、服务费等手工录入；不校验与已有账单是否重复。租客可从全公司租客中选择。若该租客名下有租赁房源，保存时将自动关联楼宇与主房源（同一楼宇多间时与「生成账单」一致写入合并房源）；无任何租赁关系时楼宇、房源可为空。
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">租客 *</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">请选择租客</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.companyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">费用类型 *</label>
            <input
              type="text"
              value={feeType}
              onChange={(e) => setFeeType(e.target.value)}
              placeholder="如：水电费、服务费、物业费"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">账期开始 *</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">账期结束 *</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">应收金额（元） *</label>
              <input
                type="text"
                inputMode="decimal"
                value={accountReceivable}
                onChange={(e) => setAccountReceivable(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">应收日期 *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">总量（选填）</label>
              <input
                type="text"
                inputMode="decimal"
                value={quantityTotal}
                onChange={(e) => setQuantityTotal(e.target.value)}
                placeholder="如：用电量、用水吨数"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">单价（元，选填）</label>
              <input
                type="text"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="可与总量配合说明计费"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">收款账户 *</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {accounts.length === 0 ? (
                <option value="">暂无账户，请先维护收款账户</option>
              ) : (
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.bankName} {a.accountNumber}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">备注</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              placeholder="选填"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中…' : '创建账单'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function BillList({
  isSuperAdmin,
  initialTenantId = '',
}: {
  isSuperAdmin: boolean
  initialTenantId?: string
}) {
  const [data, setData] = useState<ApiData | null>(null)
  const [rules, setRules] = useState<BillRule[]>([])
  const [tenantsWithRooms, setTenantsWithRooms] = useState<TenantWithRooms[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    buildingId: '',
    tenantKeyword: '',
    status: '',
    paymentStatus: '',
    overdue: '',
    feeTypeKeyword: '',
    dueDateStart: '',
    dueDateEnd: '',
    periodStart: '',
    periodEnd: '',
  })
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const tenantPrefilledRef = useRef(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [createManualOpen, setCreateManualOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  /** 线下缴费：由列表勾选带入的账单 */
  const [paymentBillsForModal, setPaymentBillsForModal] = useState<Bill[]>([])
  const [refundOpen, setRefundOpen] = useState(false)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [dunningDrawerOpen, setDunningDrawerOpen] = useState(false)
  const [columnPrefsOpen, setColumnPrefsOpen] = useState(false)
  const [columnPrefs, setColumnPrefs] = useState(() => defaultBillColumnPrefs())
  const columnSaveSkip = useRef(true)
  const router = useRouter()

  useEffect(() => {
    setColumnPrefs(loadBillColumnPrefs())
  }, [])

  useEffect(() => {
    if (columnSaveSkip.current) {
      columnSaveSkip.current = false
      return
    }
    saveBillColumnPrefs(columnPrefs)
  }, [columnPrefs])

  const visibleOrderedKeys = useMemo(
    () => columnPrefs.order.filter((k) => columnPrefs.visible[k]),
    [columnPrefs]
  )

  const toggleBillColumn = (key: BillColumnKey) => {
    setColumnPrefs((prev) => {
      if (prev.visible[key]) {
        const cnt = BILL_COLUMN_KEYS.filter((k) => k !== key && prev.visible[k]).length
        if (cnt < 1) {
          alert('请至少保留一列数据字段（勾选列与操作列始终显示）')
          return prev
        }
      }
      return { ...prev, visible: { ...prev.visible, [key]: !prev.visible[key] } }
    })
  }

  const reorderBillColumns = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setColumnPrefs((prev) => {
      const order = [...prev.order]
      const [removed] = order.splice(fromIndex, 1)
      order.splice(toIndex, 0, removed)
      return { ...prev, order }
    })
  }

  const resetBillColumns = () => {
    setColumnPrefs(defaultBillColumnPrefs())
  }

  const appendBillListFilters = (params: URLSearchParams) => {
    if (filters.buildingId) params.set('buildingId', filters.buildingId)
    if (filters.tenantKeyword.trim()) params.set('tenantKeyword', filters.tenantKeyword.trim())
    if (filters.status) params.set('status', filters.status)
    if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
    if (filters.overdue === 'true') params.set('overdue', 'true')
    if (filters.feeTypeKeyword.trim()) params.set('feeTypeKeyword', filters.feeTypeKeyword.trim())
    if (filters.dueDateStart) params.set('dueDateStart', filters.dueDateStart)
    if (filters.dueDateEnd) params.set('dueDateEnd', filters.dueDateEnd)
    if (filters.periodStart) params.set('periodStart', filters.periodStart)
    if (filters.periodEnd) params.set('periodEnd', filters.periodEnd)
  }

  const fetchBills = async () => {
    const params = new URLSearchParams()
    appendBillListFilters(params)
    const res = await fetch(`/api/bills?${params}`)
    const json = await res.json()
    if (json.success) setData(json.data)
    else setData(null)
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      appendBillListFilters(params)
      const res = await fetch(`/api/bills/export?${params.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string }
        alert(j.message || '导出失败')
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      let name = `账单导出_${Date.now()}.xlsx`
      const m = cd?.match(/filename\*=UTF-8''(.+)/)
      if (m) {
        try {
          name = decodeURIComponent(m[1].replace(/;$/, '').trim())
        } catch {
          /* ignore */
        }
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      alert('网络错误，导出失败')
    } finally {
      setExporting(false)
    }
  }

  const fetchRules = async () => {
    const res = await fetch('/api/bill-rules')
    const json = await res.json()
    if (json.success) {
      setRules(json.data.list.filter((r: BillRule) => r.status === 'active'))
    }
  }

  const fetchTenantsWithRooms = async () => {
    const res = await fetch('/api/tenants')
    const json = await res.json()
    if (json.success) {
      setTenantsWithRooms(
        json.data.list.map(
          (t: {
            id: number
            companyName: string
            building: { id: number; name: string }
            rooms: { roomId: number; roomNumber: string; name: string; leaseArea?: number }[]
          }) => ({
            id: t.id,
            companyName: t.companyName,
            building: t.building,
            rooms: t.rooms || [],
          })
        )
      )
    }
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchBills()
      .then(() => {})
      .catch(() => setError('网络错误'))
      .finally(() => setLoading(false))
  }, [
    filters.buildingId,
    filters.tenantKeyword,
    filters.status,
    filters.paymentStatus,
    filters.overdue,
    filters.feeTypeKeyword,
    filters.dueDateStart,
    filters.dueDateEnd,
    filters.periodStart,
    filters.periodEnd,
  ])

  useEffect(() => {
    if (!initialTenantId || !data?.tenants?.length || tenantPrefilledRef.current) return
    const t = data.tenants.find((x) => String(x.id) === initialTenantId)
    if (t) {
      tenantPrefilledRef.current = true
      setFilters((p) => ({ ...p, tenantKeyword: t.companyName }))
    }
  }, [initialTenantId, data])

  useEffect(() => {
    if (generateOpen) {
      fetchRules()
      fetchTenantsWithRooms()
    }
  }, [generateOpen])

  const list = data?.list ?? []
  const buildings = data?.buildings ?? []
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(list, 15)

  const dunningInitialFilters = useMemo(
    () => ({
      buildingId: filters.buildingId,
      tenantKeyword: filters.tenantKeyword,
      status: filters.status,
      paymentStatus: filters.paymentStatus,
      overdue: filters.overdue,
      feeTypeKeyword: filters.feeTypeKeyword,
      dueDateStart: filters.dueDateStart,
      dueDateEnd: filters.dueDateEnd,
    }),
    [
      filters.buildingId,
      filters.tenantKeyword,
      filters.status,
      filters.paymentStatus,
      filters.overdue,
      filters.feeTypeKeyword,
      filters.dueDateStart,
      filters.dueDateEnd,
    ]
  )

  const allPageSelected =
    paginatedItems.length > 0 && paginatedItems.every((b) => selectedIds.has(b.id))

  const toggleSelectBill = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleOpenOfflinePayment = () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要缴费的账单')
      return
    }
    const selected = list.filter((b) => selectedIds.has(b.id))
    const totalDue = selected.reduce((s, b) => s + b.amountDue, 0)
    if (totalDue <= 0) {
      alert('当前勾选的账单需缴纳金额为零，无法线下缴费')
      return
    }
    const tenantIds = new Set(selected.map((b) => b.tenant.id))
    if (tenantIds.size > 1) {
      alert('请勾选同一租客的账单后再进行线下缴费')
      return
    }
    setPaymentBillsForModal(selected)
    setPaymentOpen(true)
  }

  const toggleSelectPage = () => {
    const ids = paginatedItems.map((b) => b.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSel = ids.length > 0 && ids.every((id) => next.has(id))
      if (allSel) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  /** 应收 − 已开收据，仍大于 0 时可开具收据 */
  const receiptRemaining = (b: Bill) => {
    const ar = Number(b.accountReceivable)
    const issued = Number(b.receiptIssuedAmount ?? 0)
    return ar - issued
  }

  /** 应收 − 已开票，仍大于 0 时可登记开票 */
  const invoiceRemaining = (b: Bill) => {
    const ar = Number(b.accountReceivable)
    const issued = Number(b.invoiceIssuedAmount ?? 0)
    return ar - issued
  }

  const goToInvoiceIssue = () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要开票的账单')
      return
    }
    const selected = list.filter((b) => selectedIds.has(b.id))
    const issuable = selected.filter((b) => invoiceRemaining(b) > 1e-6)
    const skippedCount = selected.length - issuable.length

    if (issuable.length === 0) {
      if (skippedCount > 0) {
        alert(
          '勾选的账单均已无可开票额度（已开票已达应收），无法进入开票页面。请重新勾选仍有可开票额度的账单。'
        )
      } else {
        alert('没有可进入开票的账单')
      }
      return
    }

    if (skippedCount > 0) {
      alert(
        `勾选中含有 ${skippedCount} 条账单已无可开票额度（已开票已达应收），已自动排除，仅将剩余 ${issuable.length} 条带入开票页面。`
      )
    }

    const q = issuable
      .map((b) => b.id)
      .sort((a, b) => a - b)
      .join(',')
    router.push(`/bills/invoice-issue?ids=${encodeURIComponent(q)}`)
  }

  const goToReceiptIssue = () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要开具收据的账单')
      return
    }
    const selected = list.filter((b) => selectedIds.has(b.id))
    const issuable = selected.filter((b) => receiptRemaining(b) > 1e-6)
    const skippedCount = selected.length - issuable.length

    if (issuable.length === 0) {
      if (skippedCount > 0) {
        alert(
          '勾选的账单均已无可开具金额（已开收据已达应收），无法进入开具收据页面。请重新勾选仍有可开额度的账单。'
        )
      } else {
        alert('没有可进入开具收据的账单')
      }
      return
    }

    if (skippedCount > 0) {
      alert(
        `勾选中含有 ${skippedCount} 条账单已无可开具金额（已开收据已达应收），已自动排除，仅将剩余 ${issuable.length} 条带入开具收据页面。`
      )
    }

    const q = issuable
      .map((b) => b.id)
      .sort((a, b) => a - b)
      .join(',')
    router.push(`/bills/receipt-issue?ids=${encodeURIComponent(q)}`)
  }

  const handleDeleteBills = async () => {
    if (selectedIds.size === 0) {
      alert('请先勾选要删除的账单')
      return
    }
    if (
      !confirm(
        `确定删除选中的 ${selectedIds.size} 条账单？删除后不可恢复，账单关联的缴费分摊、退费记录等将一并删除。`
      )
    ) {
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/bills', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      const json = await res.json()
      if (!json.success) {
        alert((json as { message?: string }).message || '删除失败')
        return
      }
      const deleted = (json as { data?: { deleted?: number } }).data?.deleted ?? 0
      if (deleted < selectedIds.size) {
        alert(`已删除 ${deleted} 条（部分勾选可能不属于当前公司或已被删除）`)
      }
      setSelectedIds(new Set())
      await fetchBills()
    } finally {
      setSubmitting(false)
    }
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理账单</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">楼宇</label>
            <select
              value={filters.buildingId}
              onChange={(e) => setFilters((p) => ({ ...p, buildingId: e.target.value }))}
              className="px-6 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[8rem]"
            >
              <option value="">全部楼宇</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">租客</label>
            <input
              type="search"
              placeholder="名称模糊查询"
              value={filters.tenantKeyword}
              onChange={(e) => setFilters((p) => ({ ...p, tenantKeyword: e.target.value }))}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 w-44 sm:w-52"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">账单状态</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">全部状态</option>
              <option value="open">开启</option>
              <option value="closed">关闭</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600"
          >
            {filtersExpanded ? (
              <>
                收起筛选 <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                展开筛选 <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
          <div className="flex-1 min-w-[1px]" />
        <button
          type="button"
          onClick={() => setColumnPrefsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
          title="自定义列表列显示与顺序"
        >
          <Columns3 className="w-4 h-4" />
          列设置
        </button>
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exporting || loading}
          title="按当前筛选条件导出全部账单为 Excel（含字段明细）"
          className="flex items-center gap-2 px-4 py-2 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-700 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {exporting ? '导出中…' : '导出Excel'}
        </button>
        <button
          type="button"
          onClick={() => setDunningDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
        >
          <FileText className="w-4 h-4" />
          生成催缴单
        </button>
        <button
          type="button"
          onClick={goToReceiptIssue}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          生成收据
        </button>
        <button
          type="button"
          onClick={goToInvoiceIssue}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          <Landmark className="w-4 h-4" />
          开票
        </button>
        <button
          type="button"
          onClick={handleDeleteBills}
          disabled={submitting || selectedIds.size === 0}
          className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 bg-white dark:bg-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          删除账单
        </button>
        <button
          type="button"
          onClick={() => setCreateManualOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30"
        >
          <Plus className="w-4 h-4" />
          新建账单
        </button>
        <button
          onClick={() => setGenerateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          生成账单
        </button>
        <button
          type="button"
          onClick={handleOpenOfflinePayment}
          disabled={selectedIds.size === 0}
          title={selectedIds.size === 0 ? '请先在列表中勾选要缴费的账单' : undefined}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Banknote className="w-4 h-4" />
          线下缴费
        </button>
        </div>
        {filtersExpanded && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <div className="flex flex-col">
                <label className="block text-xs text-slate-500 mb-1 min-h-[1rem] leading-tight">
                  结清状态
                </label>
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => setFilters((p) => ({ ...p, paymentStatus: e.target.value }))}
                  className="min-h-[2.5rem] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  <option value="">全部结清状态</option>
                  <option value="unpaid">未缴纳</option>
                  <option value="partial">部分缴纳</option>
                  <option value="paid">已结清</option>
                </select>
              </div>
              <div className="flex flex-col">
                <span className="block text-xs mb-1 min-h-[1rem] leading-tight invisible" aria-hidden>
                  .
                </span>
                <label className="flex items-center gap-2 min-h-[2.5rem] px-0.5">
                  <input
                    type="checkbox"
                    checked={filters.overdue === 'true'}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, overdue: e.target.checked ? 'true' : '' }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">仅逾期</span>
                </label>
              </div>
              <div className="flex flex-col">
                <label className="block text-xs text-slate-500 mb-1 min-h-[1rem] leading-tight">
                  费用类型
                </label>
                <input
                  type="search"
                  placeholder="模糊查询"
                  value={filters.feeTypeKeyword}
                  onChange={(e) => setFilters((p) => ({ ...p, feeTypeKeyword: e.target.value }))}
                  className="min-h-[2.5rem] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 w-36 sm:w-40"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs text-slate-500 mb-1 min-h-[1rem] leading-tight">
                  应收日期起
                </label>
                <input
                  type="date"
                  value={filters.dueDateStart}
                  onChange={(e) => setFilters((p) => ({ ...p, dueDateStart: e.target.value }))}
                  className="min-h-[2.5rem] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-xs text-slate-500 mb-1 min-h-[1rem] leading-tight">
                  应收日期止
                </label>
                <input
                  type="date"
                  value={filters.dueDateEnd}
                  onChange={(e) => setFilters((p) => ({ ...p, dueDateEnd: e.target.value }))}
                  className="min-h-[2.5rem] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              <DateRangeField
                label="账期（重叠筛选，含起止日）"
                start={filters.periodStart}
                end={filters.periodEnd}
                onChange={({ start, end }) =>
                  setFilters((p) => ({ ...p, periodStart: start, periodEnd: end }))
                }
                hintMode="none"
                className="w-full max-w-md"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              账期筛选：所选区间与账单账期有任意一天重叠即显示；需同时填写起止才生效。
            </p>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectPage}
                  className="rounded"
                  title="全选本页"
                />
              </th>
              {visibleOrderedKeys.map((key) => (
                <th key={key} className={billColumnThClass(key)}>
                  {BILL_COLUMN_LABELS[key]}
                </th>
              ))}
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((b) => (
              <tr
                key={b.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(b.id)}
                    onChange={() => toggleSelectBill(b.id)}
                    className="rounded"
                  />
                </td>
                {visibleOrderedKeys.map((key) => (
                  <td key={key} className={billColumnTdClass(key)}>
                    {renderBillColumnCell(b, key)}
                  </td>
                ))}
                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-1">
                    <Link
                      href={`/bills/${b.id}`}
                      className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 dark:text-blue-400 mr-1"
                    >
                      查看详情
                    </Link>
                    {b.amountPaid > 0 && (
                      <button
                        onClick={() => { setSelectedBill(b); setRefundOpen(true) }}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                        title="退费"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无账单，点击「新建账单」或「生成账单」添加
        </div>
      )}
      {list.length > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {createManualOpen && data && (
        <CreateManualBillModal
          tenants={data.tenants}
          onClose={() => setCreateManualOpen(false)}
          onSuccess={() => {
            setCreateManualOpen(false)
            fetchBills()
          }}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
      {generateOpen && (
        <GenerateBillModal
          rules={rules}
          tenantsWithRooms={tenantsWithRooms}
          onClose={() => setGenerateOpen(false)}
          onSuccess={() => { setGenerateOpen(false); fetchBills() }}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
      {paymentOpen && paymentBillsForModal.length > 0 && (
        <PaymentModal
          key={paymentBillsForModal
            .map((b) => b.id)
            .sort((a, b) => a - b)
            .join(',')}
          selectedBills={paymentBillsForModal}
          onClose={() => {
            setPaymentOpen(false)
            setPaymentBillsForModal([])
          }}
          onSuccess={() => {
            setPaymentOpen(false)
            setPaymentBillsForModal([])
            setSelectedIds(new Set())
            fetchBills()
          }}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
      {refundOpen && selectedBill && (
        <RefundModal
          bill={selectedBill}
          onClose={() => { setRefundOpen(false); setSelectedBill(null) }}
          onSuccess={() => { setRefundOpen(false); setSelectedBill(null); fetchBills() }}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
      {columnPrefsOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bill-column-settings-title"
          onClick={() => setColumnPrefsOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h2 id="bill-column-settings-title" className="text-lg font-semibold">
                列设置
              </h2>
              <button
                type="button"
                onClick={() => setColumnPrefsOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-4 pt-3 text-sm text-slate-500 dark:text-slate-400">
              勾选要显示的列，拖拽左侧手柄排序。左侧勾选列与「操作」列固定显示；数据列至少保留一列。
            </p>
            <div className="p-4 overflow-y-auto flex-1 space-y-2 min-h-0">
              {columnPrefs.order.map((key, index) => (
                <div
                  key={key}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index))
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = Number(e.dataTransfer.getData('text/plain'))
                    if (Number.isNaN(from)) return
                    reorderBillColumns(from, index)
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40"
                >
                  <span className="cursor-grab active:cursor-grabbing text-slate-400 shrink-0" title="拖动排序">
                    <GripVertical className="w-5 h-5" />
                  </span>
                  <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm min-w-0">
                    <input
                      type="checkbox"
                      checked={columnPrefs.visible[key]}
                      onChange={() => toggleBillColumn(key)}
                      className="rounded shrink-0"
                    />
                    <span className="truncate">{BILL_COLUMN_LABELS[key]}</span>
                  </label>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  resetBillColumns()
                }}
                className="text-sm text-slate-600 dark:text-slate-400 hover:underline"
              >
                恢复默认
              </button>
              <button
                type="button"
                onClick={() => setColumnPrefsOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
      <DunningExportDrawer
        open={dunningDrawerOpen}
        onClose={() => setDunningDrawerOpen(false)}
        buildings={buildings}
        tenants={data?.tenants ?? []}
        initialFilters={dunningInitialFilters}
      />
    </div>
  )
}

type TenantRoomPairRow = {
  key: string
  tenantId: number
  companyName: string
  buildingId: number
  buildingName: string
  roomId: number
  roomNumber: string
  roomName: string
  leaseArea: number
}

function flattenTenantRoomPairs(tenants: TenantWithRooms[]): TenantRoomPairRow[] {
  const out: TenantRoomPairRow[] = []
  for (const t of tenants) {
    if (!t.rooms?.length) continue
    for (const r of t.rooms) {
      out.push({
        key: `${t.id}-${r.roomId}`,
        tenantId: t.id,
        companyName: t.companyName,
        buildingId: t.building?.id ?? 0,
        buildingName: t.building?.name ?? '',
        roomId: r.roomId,
        roomNumber: r.roomNumber,
        roomName: r.name,
        leaseArea: Number(r.leaseArea) || 0,
      })
    }
  }
  return out
}

/** 与 /api/bills 生成逻辑一致：适用租客 ∩ 适用楼宇 ∩ 适用房源（空则该维不限制） */
type RuleScope = { tenantIds: number[]; buildingIds: number[]; roomIds: number[] }

function pairAllowedByRule(row: TenantRoomPairRow, scope: RuleScope): boolean {
  const { tenantIds, buildingIds, roomIds } = scope
  if (tenantIds.length > 0 && !tenantIds.includes(row.tenantId)) return false
  if (buildingIds.length > 0 && !buildingIds.includes(row.buildingId)) return false
  if (roomIds.length > 0 && !roomIds.includes(row.roomId)) return false
  return true
}

/** 同一租客在同一楼宇下合并为一行展示；勾选一行即选中该组内全部 tenantId-roomId */
type TenantBuildingGroup = {
  groupKey: string
  tenantId: number
  companyName: string
  buildingId: number
  buildingName: string
  /** 该组下所有房源的 pair key，与生成账单 API 一致 */
  roomKeys: string[]
  /** 展示用房号列表 */
  roomNumbers: string[]
}

function groupByTenantAndBuilding(rows: TenantRoomPairRow[]): TenantBuildingGroup[] {
  const map = new Map<string, TenantRoomPairRow[]>()
  for (const row of rows) {
    const gk = `${row.tenantId}-${row.buildingId}`
    if (!map.has(gk)) map.set(gk, [])
    map.get(gk)!.push(row)
  }
  const out: TenantBuildingGroup[] = []
  for (const [, list] of map) {
    list.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, 'zh-CN'))
    const first = list[0]
    const roomKeys = list.map((r) => r.key)
    const roomNumbers = list.map((r) => r.roomNumber)
    out.push({
      groupKey: `${first.tenantId}-${first.buildingId}`,
      tenantId: first.tenantId,
      companyName: first.companyName,
      buildingId: first.buildingId,
      buildingName: first.buildingName,
      roomKeys,
      roomNumbers,
    })
  }
  out.sort((a, b) => {
    const c = a.companyName.localeCompare(b.companyName, 'zh-CN')
    if (c !== 0) return c
    return a.buildingName.localeCompare(b.buildingName, 'zh-CN')
  })
  return out
}

function TenantRoomPickerModal({
  open,
  onClose,
  tenantsWithRooms,
  ruleScope,
  value,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  tenantsWithRooms: TenantWithRooms[]
  /** 未选规则时为 null，不展示任何可选行 */
  ruleScope: RuleScope | null
  value: Set<string>
  onConfirm: (next: Set<string>) => void
}) {
  const flatScopedRows = useMemo(() => {
    const flat = flattenTenantRoomPairs(tenantsWithRooms)
    if (!ruleScope) return []
    return flat.filter((row) => pairAllowedByRule(row, ruleScope))
  }, [tenantsWithRooms, ruleScope])

  const groupedRows = useMemo(() => groupByTenantAndBuilding(flatScopedRows), [flatScopedRows])

  const buildingOptions = useMemo(() => {
    const m = new Map<number, string>()
    for (const g of groupedRows) {
      if (g.buildingId) m.set(g.buildingId, g.buildingName)
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [groupedRows])

  const [buildingId, setBuildingId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setDraft(new Set(value))
      setBuildingId('')
      setKeyword('')
    }
  }, [open, value])

  const filteredGroups = useMemo(() => {
    return groupedRows.filter((g) => {
      if (buildingId && String(g.buildingId) !== buildingId) return false
      if (!keyword.trim()) return true
      const kw = keyword.trim().toLowerCase()
      if (
        g.companyName.toLowerCase().includes(kw) ||
        g.buildingName.toLowerCase().includes(kw)
      ) {
        return true
      }
      return g.roomNumbers.some((rn) => rn.toLowerCase().includes(kw))
    })
  }, [groupedRows, buildingId, keyword])

  const groupFullySelected = (g: TenantBuildingGroup) =>
    g.roomKeys.length > 0 && g.roomKeys.every((k) => draft.has(k))

  const allFilteredSelected =
    filteredGroups.length > 0 && filteredGroups.every((g) => groupFullySelected(g))

  /** 已完整勾选的租客·楼宇组数 = 将生成的账单条数 */
  const billGroupCount = useMemo(
    () =>
      groupedRows.filter(
        (g) => g.roomKeys.length > 0 && g.roomKeys.every((k) => draft.has(k))
      ).length,
    [groupedRows, draft]
  )

  const toggleGroup = (g: TenantBuildingGroup) => {
    setDraft((prev) => {
      const next = new Set(prev)
      const allOn = g.roomKeys.every((k) => next.has(k))
      if (allOn) {
        g.roomKeys.forEach((k) => next.delete(k))
      } else {
        g.roomKeys.forEach((k) => next.add(k))
      }
      return next
    })
  }

  const selectAllFiltered = (checked: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (checked) {
        filteredGroups.forEach((g) => g.roomKeys.forEach((k) => next.add(k)))
      } else {
        filteredGroups.forEach((g) => g.roomKeys.forEach((k) => next.delete(k)))
      }
      return next
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold">选择租客-房源</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">楼宇</label>
              <select
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              >
                <option value="">全部楼宇</option>
                {buildingOptions.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">搜索</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="租客名称、楼宇、房号、房源名称"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                />
              </div>
            </div>
          </div>
          {filteredGroups.length > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={(e) => selectAllFiltered(e.target.checked)}
              />
              全选当前筛选结果（{filteredGroups.length} 行，共 {filteredGroups.reduce((s, g) => s + g.roomKeys.length, 0)} 间房源）
            </label>
          )}
        </div>
        <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[50vh] p-2">
          {!ruleScope ? (
            <div className="p-6 text-center text-slate-500 text-sm">请先在「生成账单」主窗口中选择一条账单规则</div>
          ) : groupedRows.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              当前规则适用范围内暂无租客-房源（请检查规则中的适用租客、适用楼宇及房源）
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">无匹配记录，请调整楼宇或搜索关键词</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700/80 text-left text-xs text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-2 w-10" />
                  <th className="p-2">租客</th>
                  <th className="p-2">楼宇</th>
                  <th className="p-2">租赁房源</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((g) => (
                  <tr
                    key={g.groupKey}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-700/40"
                  >
                    <td className="p-2 align-top">
                      <input
                        type="checkbox"
                        checked={groupFullySelected(g)}
                        onChange={() => toggleGroup(g)}
                      />
                    </td>
                    <td className="p-2 align-top">{g.companyName}</td>
                    <td className="p-2 align-top">{g.buildingName || '-'}</td>
                    <td className="p-2 align-top text-slate-600 dark:text-slate-400">
                      共 {g.roomKeys.length} 间：{g.roomNumbers.join('、')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
          <span className="text-sm text-slate-500">
            将生成 {billGroupCount} 条账单（同一租客同一楼宇合并为一条，金额按多间房源合计）
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(draft)
                onClose()
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function selectedPairsSummary(
  selected: Set<string>,
  tenantsWithRooms: TenantWithRooms[]
): string {
  if (selected.size === 0) return '未选择，请点击选择租客-房源'
  const rows = flattenTenantRoomPairs(tenantsWithRooms)
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const groupMap = new Map<string, { companyName: string; buildingName: string; count: number }>()
  for (const k of selected) {
    const r = byKey.get(k)
    if (!r) continue
    const gk = `${r.tenantId}-${r.buildingId}`
    const prev = groupMap.get(gk)
    if (prev) prev.count += 1
    else
      groupMap.set(gk, {
        companyName: r.companyName,
        buildingName: r.buildingName,
        count: 1,
      })
  }
  const groups = Array.from(groupMap.values())
  if (groups.length <= 2) {
    return `已选：${groups.map((g) => `${g.companyName} / ${g.buildingName}（${g.count}间）`).join('；')} → 将生成 ${groups.length} 条账单`
  }
  return `已选 ${groups.length} 个租客·楼宇（将生成 ${groups.length} 条账单），共 ${selected.size} 间房源`
}

/** 与 POST /api/bills 逐间金额公式一致，再按租客+楼宇合并 */
type BillPreviewLine = {
  /** 与 API groupAmounts 键一致：`${tenantId}-${buildingId}` */
  groupKey: string
  tenantId: number
  buildingId: number
  tenantName: string
  buildingName: string
  roomDetails: { roomNumber: string; leaseArea: number; receivable: number; formulaLine: string }[]
  groupTotal: number
}

function buildBillPreview(
  selected: Set<string>,
  tenantsWithRooms: TenantWithRooms[],
  rule: BillRule,
  scope: RuleScope
): BillPreviewLine[] {
  const rows = flattenTenantRoomPairs(tenantsWithRooms)
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const amountPerSqm = Number(rule.amount)
  const discountRate = Number(rule.discountRate ?? 0)
  const discountAmount = Number(rule.discountAmount ?? 0)
  const periodStart = rule.periodStartDate ?? ''
  const periodEnd = rule.periodEndDate ?? ''
  const periodSplit = splitBillingPeriod(periodStart, periodEnd)

  type Member = { row: TenantRoomPairRow; receivable: number }
  const groupMap = new Map<string, Member[]>()

  for (const k of selected) {
    const row = byKey.get(k)
    if (!row) continue
    if (!pairAllowedByRule(row, scope)) continue
    const leaseArea = row.leaseArea
    const { monthlyNet } = computeMonthlyNetRoom(amountPerSqm, leaseArea, discountRate, discountAmount)
    const receivable = periodSplit
      ? computePeriodReceivableFromMonthly(monthlyNet, periodSplit, periodStart, periodEnd)
      : 0
    const gk = `${row.tenantId}-${row.buildingId}`
    if (!groupMap.has(gk)) groupMap.set(gk, [])
    groupMap.get(gk)!.push({ row, receivable })
  }

  const lines: BillPreviewLine[] = []
  for (const [, members] of groupMap) {
    members.sort((a, b) => a.row.roomNumber.localeCompare(b.row.roomNumber, 'zh-CN'))
    const first = members[0].row
    const roomDetails = members.map((m) => ({
      roomNumber: m.row.roomNumber,
      leaseArea: m.row.leaseArea,
      receivable: m.receivable,
      formulaLine: buildRoomReceivableFormulaLine({
        amountPerSqm,
        leaseArea: m.row.leaseArea,
        discountRate,
        discountAmount,
        periodStart,
        periodEnd,
        receivable: m.receivable,
      }),
    }))
    const groupTotal = members.reduce((s, m) => s + m.receivable, 0)
    lines.push({
      groupKey: `${first.tenantId}-${first.buildingId}`,
      tenantId: first.tenantId,
      buildingId: first.buildingId,
      tenantName: first.companyName,
      buildingName: first.buildingName,
      roomDetails,
      groupTotal,
    })
  }
  lines.sort((a, b) => {
    const c = a.tenantName.localeCompare(b.tenantName, 'zh-CN')
    if (c !== 0) return c
    return a.buildingName.localeCompare(b.buildingName, 'zh-CN')
  })
  return lines
}

function formatRuleDiscountRateDisplay(rate: number): string {
  const r = Number(rate)
  if (Number.isNaN(r)) return '-'
  if (r >= 0 && r <= 1) return `${(r * 100).toFixed(2)}%`
  return `${r}%`
}

function formatDueDateOffsetLabel(days: number | undefined): string {
  if (days === undefined || days === null) return '-'
  if (days === 0) return '账期开始当日'
  if (days < 0) return `提前 ${Math.abs(days)} 天`
  return `延后 ${days} 天`
}

function formatMoneyInput(n: number): string {
  if (!Number.isFinite(n)) return ''
  return String(Math.round(n * 100) / 100)
}

/** 本单应收：文本输入；输入时同步父状态。勿在 committed 变化时同步 draft，否则会覆盖正在输入的内容。打开预览时用 key 强制重挂载。 */
function BillPreviewAmountCell({
  groupKey,
  trialTotal,
  committed,
  onCommit,
  onSaved,
}: {
  groupKey: string
  trialTotal: number
  committed: number
  onCommit: (gk: string, v: number) => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(() => formatMoneyInput(committed))

  const parseAmount = (raw: string): number | null => {
    const t = raw.trim().replace(/,/g, '')
    if (t === '' || t === '.' || t === '-' || t === '-.') return null
    const n = parseFloat(t)
    if (Number.isNaN(n)) return null
    return n
  }

  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          const n = parseAmount(next)
          if (n != null && n > 0) {
            onCommit(groupKey, n)
          }
        }}
        onBlur={() => {
          const n = parseAmount(draft)
          if (n == null || n <= 0) {
            onCommit(groupKey, trialTotal)
            setDraft(formatMoneyInput(trialTotal))
            onSaved()
            return
          }
          const rounded = Math.round(n * 100) / 100
          onCommit(groupKey, rounded)
          setDraft(formatMoneyInput(rounded))
          onSaved()
        }}
        className="w-full max-w-[11rem] ml-auto block rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-right tabular-nums text-sm font-medium"
      />
      <span className="block text-[10px] text-slate-400 mt-0.5">试算 {trialTotal.toFixed(2)}</span>
    </>
  )
}

/** 关闭弹窗前让当前聚焦的输入先失焦，确保 onBlur 里把本单应收写回父状态（避免卸载导致未提交） */
function blurActiveInputIfAny() {
  const ae = document.activeElement
  if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement) {
    ae.blur()
  }
}

function BillPreviewModal({
  open,
  onClose,
  lines,
  rule,
  dueDate,
  groupAmounts,
  onGroupAmountChange,
  amountCellKey,
  duplicateByGroupKey,
  includedGroupKeys,
  onToggleInclude,
}: {
  open: boolean
  onClose: () => void
  lines: BillPreviewLine[]
  rule: BillRule | null
  dueDate: string
  /** 本单应收（元），键为 groupKey；未设置则按试算 groupTotal */
  groupAmounts: Record<string, number>
  onGroupAmountChange: (groupKey: string, value: number) => void
  /** 每次打开预览递增，用于金额单元重挂载以同步试算初值 */
  amountCellKey: number
  /** 合并组是否已有开启且费用类型/账期/应收日相同的账单：有则为账单编号 */
  duplicateByGroupKey: Record<string, string | null>
  /** 勾选参与本次生成的合并组 */
  includedGroupKeys: Set<string>
  onToggleInclude: (groupKey: string, checked: boolean) => void
}) {
  const [tenantFilter, setTenantFilter] = useState('')
  const [amountToast, setAmountToast] = useState('')

  useEffect(() => {
    if (open) setTenantFilter('')
  }, [open])

  useEffect(() => {
    if (!amountToast) return
    const t = window.setTimeout(() => setAmountToast(''), 2200)
    return () => window.clearTimeout(t)
  }, [amountToast])

  const periodStartDate = rule?.periodStartDate ?? ''
  const periodEndDate = rule?.periodEndDate ?? ''
  const periodLabel =
    periodStartDate && periodEndDate ? `${periodStartDate} ~ ${periodEndDate}` : ''

  const durationLabel = useMemo(
    () => formatBillingPeriodDuration(periodStartDate, periodEndDate),
    [periodStartDate, periodEndDate]
  )

  const filteredLines = useMemo(() => {
    const q = tenantFilter.trim()
    if (!q) return lines
    return lines.filter((l) => l.tenantName.includes(q))
  }, [lines, tenantFilter])

  const filteredTotal = useMemo(
    () =>
      filteredLines.reduce((s, l) => {
        if (!includedGroupKeys.has(l.groupKey)) return s
        const v = groupAmounts[l.groupKey]
        const amt = v !== undefined && !Number.isNaN(v) ? v : l.groupTotal
        return s + amt
      }, 0),
    [filteredLines, groupAmounts, includedGroupKeys]
  )

  const handleClose = () => {
    blurActiveInputIfAny()
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-2 sm:p-3">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-[min(2400px,calc(100vw-16px))] max-h-[92vh] overflow-hidden flex flex-col relative">
        {amountToast ? (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm shadow-lg">
            {amountToast}
          </div>
        ) : null}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">账单预览</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                以下为按当前所选账单规则试算；本弹窗应收日为您在「生成账单」中填写的日期
                {dueDate ? `（${dueDate}）` : ''}
              </p>
              {rule && (
                <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 p-3 text-xs">
                  <div className="font-medium text-slate-700 dark:text-slate-200 mb-2">当前账单生成规则</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-2 text-slate-600 dark:text-slate-400">
                    <span>
                      <span className="text-slate-500 dark:text-slate-500">规则名称：</span>
                      {rule.name}
                    </span>
                    <span>
                      <span className="text-slate-500 dark:text-slate-500">规则编号：</span>
                      {rule.code || '—'}
                    </span>
                    <span>
                      <span className="text-slate-500 dark:text-slate-500">费用类型：</span>
                      {rule.feeType}
                    </span>
                    <span>
                      <span className="text-slate-500 dark:text-slate-500">单价（元/㎡/月）：</span>
                      {Number(rule.amount).toFixed(2)}
                    </span>
                    <span>
                      <span className="text-slate-500 dark:text-slate-500">折扣率：</span>
                      {formatRuleDiscountRateDisplay(rule.discountRate)}
                      <span className="text-slate-400 dark:text-slate-500">（计算用 1−折扣率）</span>
                    </span>
                    <span>
                      <span className="text-slate-500 dark:text-slate-500">减免额（元/间/月）：</span>
                      {Number(rule.discountAmount).toFixed(2)}
                    </span>
                    <span className="sm:col-span-2 xl:col-span-3">
                      <span className="text-slate-500 dark:text-slate-500">账期：</span>
                      {periodLabel || '—'}
                    </span>
                    <span>
                      <span className="text-slate-500 dark:text-slate-500">应收日（规则默认相对账期开始）：</span>
                      {formatDueDateOffsetLabel(rule.dueDateOffsetDays)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500 leading-relaxed border-t border-slate-200 dark:border-slate-600 pt-2">
                    单价为元/㎡/月。月应收 = max(0, 单价×租赁面积×(1−折扣率) − 减免额)。零散天与不足整月段按自然日逐日折算：日单价 =
                    月应收÷该日所在月的实际天数（28/29/30/31），与「账期时长」拆分一致。同一租客同一楼宇多间合并时，金额为各间账期应收之和。
                  </p>
                </div>
              )}
            </div>
            <button type="button" onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs text-slate-500 mb-3">
            金额与正式生成一致：单价为元/㎡/月；先算月应收，再按账期折算（整月×月应收 + 零散天按自然日：日单价=月应收÷当月实际天数）。同一租客同一楼宇合并为一条账单。
            <span className="text-slate-600 dark:text-slate-300">
              「本单应收」可改，须大于 0；输入会实时参与合计，失焦时取两位小数并提示保存成功。
            </span>
            <span className="block mt-2 text-amber-700 dark:text-amber-300/90">
              勾选「生成」的合并账单才会参与本次生成；若与已有「开启」账单在费用类型、账期、应收日期上重复，将显示已有账单编号并默认不勾选，您可只勾选未重复的账单后回到主界面点击「生成」。
            </span>
          </p>
          {lines.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm">暂无可预览数据</div>
          ) : (
            <>
              <div className="relative mb-3 max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={tenantFilter}
                  onChange={(e) => setTenantFilter(e.target.value)}
                  placeholder="按租客名称模糊筛选"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                />
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
                <table className="w-full text-sm min-w-[1480px]">
                  <thead className="bg-slate-50 dark:bg-slate-700/80 text-left text-xs text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2 w-12 whitespace-nowrap text-center">生成</th>
                      <th className="p-2 w-10 whitespace-nowrap">序号</th>
                      <th className="p-2 min-w-[140px] whitespace-nowrap">账单编号</th>
                      <th className="p-2 min-w-[120px] whitespace-nowrap">租客</th>
                      <th className="p-2 min-w-[100px] whitespace-nowrap">楼宇</th>
                      <th className="p-2 min-w-[200px]">房源明细（面积 / 本间应收）</th>
                      <th className="p-2 min-w-[280px]">计算公式（代入数值）</th>
                      <th className="p-2 min-w-[200px] whitespace-nowrap">账单开始 ~ 结束</th>
                      <th className="p-2 min-w-[120px] whitespace-nowrap">账期时长</th>
                      <th className="p-2 text-right whitespace-nowrap min-w-[128px]">本单应收（元）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500">
                          无匹配租客，请调整筛选关键词
                        </td>
                      </tr>
                    ) : (
                      filteredLines.map((line, idx) => {
                        const dupCode = duplicateByGroupKey[line.groupKey] ?? null
                        const included = includedGroupKeys.has(line.groupKey)
                        return (
                        <tr
                          key={line.groupKey}
                          className={`border-t border-slate-100 dark:border-slate-700 ${!included ? 'opacity-60' : ''}`}
                        >
                          <td className="p-2 align-top text-center">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={included}
                              onChange={(e) => onToggleInclude(line.groupKey, e.target.checked)}
                              title={dupCode ? '已存在开启的相同账单，默认不生成；勾选后主界面生成将拦截' : '参与本次生成'}
                            />
                          </td>
                          <td className="p-2 align-top text-slate-500">{idx + 1}</td>
                          <td className="p-2 align-top min-w-[140px]">
                            <div className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                              {dupCode ?? '—'}
                            </div>
                            {dupCode ? (
                              <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 leading-snug">
                                已存在相同账单（费用类型、账期、应收日期一致且状态为开启），请勿重复生成
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400 mt-1">本次将新建账单</p>
                            )}
                          </td>
                          <td className="p-2 align-top">{line.tenantName}</td>
                          <td className="p-2 align-top">{line.buildingName || '-'}</td>
                          <td className="p-2 align-top text-slate-600 dark:text-slate-400">
                            <ul className="space-y-1 list-none m-0 p-0">
                              {line.roomDetails.map((d) => (
                                <li key={d.roomNumber}>
                                  {d.roomNumber}（{d.leaseArea}㎡）→ {d.receivable.toFixed(2)}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="p-2 align-top text-slate-600 dark:text-slate-400">
                            <ul className="space-y-1 list-none m-0 p-0 text-[11px] leading-snug font-mono break-all">
                              {line.roomDetails.map((d) => (
                                <li key={`f-${d.roomNumber}`}>{d.formulaLine}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="p-2 align-top text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {periodLabel || '—'}
                          </td>
                          <td className="p-2 align-top whitespace-nowrap">{durationLabel}</td>
                          <td className="p-2 align-top text-right">
                            {included ? (
                              <BillPreviewAmountCell
                                key={`${line.groupKey}-${amountCellKey}`}
                                groupKey={line.groupKey}
                                trialTotal={line.groupTotal}
                                committed={
                                  groupAmounts[line.groupKey] !== undefined
                                    ? groupAmounts[line.groupKey]
                                    : line.groupTotal
                                }
                                onCommit={onGroupAmountChange}
                                onSaved={() => setAmountToast('保存成功')}
                              />
                            ) : (
                              <span className="text-slate-400 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 font-medium">
                      <td colSpan={9} className="p-2 text-right">
                        合计（仅勾选「生成」的行）{tenantFilter.trim() ? '（当前筛选）' : ''}
                      </td>
                      <td className="p-2 text-right tabular-nums">{filteredTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

function GenerateBillModal({
  rules,
  tenantsWithRooms,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  rules: BillRule[]
  tenantsWithRooms: TenantWithRooms[]
  onClose: () => void
  onSuccess: () => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [ruleId, setRuleId] = useState('')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [remark, setRemark] = useState('')
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  /** 账单预览里编辑的本单应收，键为 groupKey；生成时未覆盖则按试算 */
  const [previewGroupAmounts, setPreviewGroupAmounts] = useState<Record<string, number>>({})
  /** 每次打开预览递增，用于本单应收输入框重挂载 */
  const [previewAmountCellKey, setPreviewAmountCellKey] = useState(0)
  const [previewChecking, setPreviewChecking] = useState(false)
  /** 规则/日期/勾选变化时递增，用于判断预览是否仍对应当前表单 */
  const formGen = useRef(0)
  const previewOpenedAtFormGen = useRef<number | null>(null)
  const [previewDuplicateByGroupKey, setPreviewDuplicateByGroupKey] = useState<
    Record<string, string | null>
  >({})
  const [previewIncludedGroupKeys, setPreviewIncludedGroupKeys] = useState<Set<string>>(new Set())

  const selectedRule = useMemo(
    () => rules.find((r) => String(r.id) === ruleId),
    [rules, ruleId]
  )

  const ruleScope: RuleScope | null = useMemo(() => {
    if (!selectedRule) return null
    return {
      tenantIds: selectedRule.tenantIds ?? [],
      buildingIds: selectedRule.buildingIds ?? [],
      roomIds: selectedRule.roomIds ?? [],
    }
  }, [selectedRule])

  const previewLines = useMemo(() => {
    if (!selectedRule || !ruleScope || selectedPairs.size === 0) return []
    return buildBillPreview(selectedPairs, tenantsWithRooms, selectedRule, ruleScope)
  }, [selectedRule, ruleScope, selectedPairs, tenantsWithRooms])

  const openBillPreview = async () => {
    if (!ruleId || selectedPairs.size === 0) {
      alert('请先选择规则和至少一个租客-房源')
      return
    }
    if (!dueDate) {
      alert('请选择应收日期')
      return
    }
    if (!selectedRule || !ruleScope) return
    const lines = buildBillPreview(selectedPairs, tenantsWithRooms, selectedRule, ruleScope)
    if (lines.length === 0) {
      alert('当前选择无法计算预览，请重新选择租客-房源')
      return
    }
    setPreviewChecking(true)
    try {
      const items = Array.from(selectedPairs).map((k) => {
        const [tid, rid] = k.split('-').map(Number)
        return { tenantId: tid, roomId: rid }
      })
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ruleId: Number(ruleId),
          items,
          dueDate,
          intent: 'duplicate_map',
        }),
      })
      const json = await res.json()
      const map: Record<string, string | null> =
        json.success && json.data?.duplicateByGroupKey
          ? json.data.duplicateByGroupKey
          : {}
      setPreviewDuplicateByGroupKey(map)
      const inc = new Set<string>()
      for (const line of lines) {
        if (!map[line.groupKey]) inc.add(line.groupKey)
      }
      setPreviewIncludedGroupKeys(inc)
      previewOpenedAtFormGen.current = formGen.current
    } catch {
      setPreviewDuplicateByGroupKey({})
      setPreviewIncludedGroupKeys(new Set(lines.map((l) => l.groupKey)))
      previewOpenedAtFormGen.current = formGen.current
    } finally {
      setPreviewChecking(false)
    }
    /** 关闭预览再打开时保留同一 groupKey 下已改过的本单应收，勿每次用试算覆盖 */
    setPreviewGroupAmounts((prev) => {
      const next: Record<string, number> = {}
      for (const line of lines) {
        const saved = prev[line.groupKey]
        if (saved !== undefined && Number.isFinite(saved) && saved > 0) {
          next[line.groupKey] = saved
        } else {
          next[line.groupKey] = line.groupTotal
        }
      }
      return next
    })
    setPreviewAmountCellKey((k) => k + 1)
    setPreviewOpen(true)
  }

  useEffect(() => {
    if (!ruleId) {
      setSelectedPairs(new Set())
      return
    }
    const rule = rules.find((r) => String(r.id) === ruleId)
    if (!rule) return
    const scope: RuleScope = {
      tenantIds: rule.tenantIds ?? [],
      buildingIds: rule.buildingIds ?? [],
      roomIds: rule.roomIds ?? [],
    }
    const allowed = new Set(
      flattenTenantRoomPairs(tenantsWithRooms)
        .filter((row) => pairAllowedByRule(row, scope))
        .map((r) => r.key)
    )
    setSelectedPairs((prev) => {
      const next = new Set<string>()
      for (const k of prev) {
        if (allowed.has(k)) next.add(k)
      }
      return next
    })
  }, [ruleId, rules, tenantsWithRooms])

  useEffect(() => {
    setPreviewGroupAmounts({})
  }, [ruleId])

  useEffect(() => {
    formGen.current += 1
  }, [ruleId, dueDate])

  /** 勾选租客-房源变化后，须重新打开预览才沿用勾选/重复提示 */
  useEffect(() => {
    previewOpenedAtFormGen.current = null
  }, [selectedPairs])

  const handleRuleChange = (newRuleId: string) => {
    setRuleId(newRuleId)
    const rule = rules.find((r) => String(r.id) === newRuleId)
    // 应收日期相对「账期开始日」：当日=0；提前=负天数；延后=正天数（与账单规则存储一致）
    if (rule?.periodStartDate && rule.dueDateOffsetDays != null) {
      const start = new Date(rule.periodStartDate)
      start.setDate(start.getDate() + rule.dueDateOffsetDays)
      setDueDate(start.toISOString().slice(0, 10))
    }
  }

  const handleSubmit = async () => {
    if (!ruleId || selectedPairs.size === 0) {
      alert('请选择规则和至少一个租客-房源')
      return
    }
    if (!dueDate) {
      alert('请选择应收日期')
      return
    }
    if (!selectedRule || !ruleScope) {
      alert('请选择有效规则')
      return
    }
    const previewLinesForSubmit = buildBillPreview(
      selectedPairs,
      tenantsWithRooms,
      selectedRule,
      ruleScope
    )
    if (previewLinesForSubmit.length === 0) {
      alert('当前选择无法生成账单，请重新选择租客-房源')
      return
    }
    const allGroupKeys = new Set(previewLinesForSubmit.map((l) => l.groupKey))
    const usePreviewSelection = previewOpenedAtFormGen.current === formGen.current
    const groupsToUse = usePreviewSelection ? previewIncludedGroupKeys : allGroupKeys

    if (groupsToUse.size === 0) {
      alert('当前没有可生成的账单：请在「账单预览」中至少勾选一条要生成的合并账单')
      return
    }

    for (const gk of groupsToUse) {
      if (usePreviewSelection && previewDuplicateByGroupKey[gk]) {
        alert(
          `账单 ${previewDuplicateByGroupKey[gk]} 已存在（开启状态，费用类型/账期/应收日期相同）。请取消勾选该条或在预览中取消勾选后再生成。`
        )
        return
      }
    }

    const rows = flattenTenantRoomPairs(tenantsWithRooms)
    const byKey = new Map(rows.map((r) => [r.key, r]))
    const filteredPairKeys: string[] = []
    for (const k of selectedPairs) {
      const row = byKey.get(k)
      if (!row) continue
      const gk = `${row.tenantId}-${row.buildingId}`
      if (groupsToUse.has(gk)) filteredPairKeys.push(k)
    }
    if (filteredPairKeys.length === 0) {
      alert('没有可提交的租客-房源，请检查预览中的勾选')
      return
    }

    const groupAmounts: Record<string, number> = {}
    for (const line of previewLinesForSubmit) {
      if (!groupsToUse.has(line.groupKey)) continue
      const raw = previewGroupAmounts[line.groupKey]
      const v = raw !== undefined && !Number.isNaN(raw) ? raw : line.groupTotal
      if (!(v > 0)) {
        alert(`「${line.tenantName} / ${line.buildingName}」本单应收须大于 0`)
        return
      }
      groupAmounts[line.groupKey] = Math.round(v * 100) / 100
    }
    setSubmitting(true)
    try {
      const items = filteredPairKeys.map((k) => {
        const [tid, rid] = k.split('-').map(Number)
        return { tenantId: tid, roomId: rid }
      })
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId: Number(ruleId),
          items,
          dueDate,
          remark: remark || undefined,
          groupAmounts,
        }),
      })
      const json = await res.json()
      if (json.success) {
        alert(`成功生成 ${json.data.count} 条账单`)
        onSuccess()
      } else {
        alert(json.message || '生成失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold">生成账单</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">选择规则 *</label>
            <select
              value={ruleId}
              onChange={(e) => handleRuleChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">请选择</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.feeType})</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              下方可选租客-房源将仅包含：同时满足该规则「适用租客」与「适用楼宇及房源」的租赁关系（与生成账单逻辑一致）
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">应收日期 *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
            <p className="mt-1 text-xs text-slate-500">
              选择规则后默认按「账期开始日」结合规则中的提前/当日/延后计算，可再手动修改
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">选择租客-房源（可多选）</label>
            <div className="flex gap-2 items-start">
              <div className="relative flex-1 min-w-0">
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  readOnly
                  value={
                    !ruleId
                      ? '请先选择账单规则'
                      : selectedPairsSummary(selectedPairs, tenantsWithRooms)
                  }
                  placeholder="点击选择租客-房源"
                  onFocus={() => ruleId && setPickerOpen(true)}
                  onClick={() => ruleId && setPickerOpen(true)}
                  className={`w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm ${
                    ruleId
                      ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600/50'
                      : 'cursor-not-allowed opacity-70'
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={() => void openBillPreview()}
                disabled={!ruleId || selectedPairs.size === 0 || previewChecking}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="w-4 h-4" />
                {previewChecking ? '校验中…' : '账单预览'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              须先选规则；列表仅含规则范围内的租客-房源。弹出层内可按楼宇、关键词再筛选，支持多选与全选当前结果
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">备注</label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="选填"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '生成中...' : '生成'}
          </button>
        </div>
      </div>
    </div>
    <TenantRoomPickerModal
      open={pickerOpen}
      onClose={() => setPickerOpen(false)}
      tenantsWithRooms={tenantsWithRooms}
      ruleScope={ruleScope}
      value={selectedPairs}
      onConfirm={setSelectedPairs}
    />
    <BillPreviewModal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      lines={previewLines}
      rule={selectedRule ?? null}
      dueDate={dueDate}
      groupAmounts={previewGroupAmounts}
      onGroupAmountChange={(groupKey, value) => {
        setPreviewGroupAmounts((prev) => ({ ...prev, [groupKey]: value }))
      }}
      amountCellKey={previewAmountCellKey}
      duplicateByGroupKey={previewDuplicateByGroupKey}
      includedGroupKeys={previewIncludedGroupKeys}
      onToggleInclude={(groupKey, checked) => {
        setPreviewIncludedGroupKeys((prev) => {
          const next = new Set(prev)
          if (checked) next.add(groupKey)
          else next.delete(groupKey)
          return next
        })
      }}
    />
    </>
  )
}

function PaymentModal({
  selectedBills,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  selectedBills: Bill[]
  onClose: () => void
  onSuccess: () => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const tenantId = selectedBills[0]!.tenant.id
  const tenantName = selectedBills[0]!.tenant.companyName
  const sumDue = useMemo(
    () => selectedBills.reduce((s, b) => s + b.amountDue, 0),
    [selectedBills]
  )
  const [totalAmount, setTotalAmount] = useState(() => sumDue.toFixed(2))
  const [paymentMethod, setPaymentMethod] = useState('现金')
  const [payer, setPayer] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16))

  useEffect(() => {
    setTotalAmount(sumDue.toFixed(2))
  }, [selectedBills, sumDue])

  const handleSubmit = async () => {
    if (!totalAmount || !payer?.trim()) {
      alert('请填写完整信息')
      return
    }
    const amt = parseFloat(totalAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('缴纳金额必须大于0')
      return
    }
    if (amt > sumDue + 1e-6) {
      alert('缴纳金额不能大于待缴金额')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          billIds: selectedBills.map((b) => b.id),
          totalAmount: amt,
          paymentMethod,
          payer: payer.trim(),
          paidAt: paidAt || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        alert('缴费成功')
        onSuccess()
      } else {
        alert(json.message || '缴费失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold">线下缴费</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">租客</label>
            <div className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm">
              {tenantName}
            </div>
            <p className="text-xs text-slate-500 mt-1">由列表勾选的账单确定，不可更改</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              已选账单（合计待缴 ¥{sumDue.toFixed(2)}）
            </label>
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-40 overflow-y-auto">
              {selectedBills.map((b) => (
                <div
                  key={b.id}
                  className="flex justify-between gap-2 p-2 border-b border-slate-100 dark:border-slate-700 last:border-0 text-sm"
                >
                  <span className="text-slate-700 dark:text-slate-300">{b.code}</span>
                  <span className="text-slate-600 dark:text-slate-400 shrink-0">
                    待缴 ¥{b.amountDue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">缴纳金额 *</label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
            <p className="text-xs text-slate-500 mt-1">默认等于上述合计待缴，可按实收修改</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">支付方式 *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">缴纳人 *</label>
            <input
              type="text"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              placeholder="缴纳人姓名"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">缴纳时间</label>
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !payer.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '确认缴费'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RefundModal({
  bill,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  bill: Bill
  onClose: () => void
  onSuccess: () => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [amount, setAmount] = useState(bill.amountPaid > 0 ? String(bill.amountPaid) : '')
  const [reason, setReason] = useState('')
  const [refunder, setRefunder] = useState('')

  const handleSubmit = async () => {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      alert('退费金额必须大于0')
      return
    }
    if (amt > bill.amountPaid) {
      alert('退费金额不能大于已缴金额')
      return
    }
    if (!reason.trim()) {
      alert('请填写退费原因')
      return
    }
    if (!refunder.trim()) {
      alert('请填写退费人')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: bill.id,
          amount: amt,
          reason: reason.trim(),
          refunder: refunder.trim(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        alert('退费成功')
        onSuccess()
      } else {
        alert(json.message || '退费失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold">退费</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            账单 {bill.code}，已缴 ¥{bill.amountPaid.toFixed(2)}，可退金额 ¥{bill.amountPaid.toFixed(2)}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">退费金额 *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">退费原因 *</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="退费原因"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">退费人 *</label>
            <input
              type="text"
              value={refunder}
              onChange={(e) => setRefunder(e.target.value)}
              placeholder="退费人姓名"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '确认退费'}
          </button>
        </div>
      </div>
    </div>
  )
}
