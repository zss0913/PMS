'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import {
  Plus,
  Search,
  Banknote,
  RotateCcw,
  Bell,
  X,
} from 'lucide-react'

type Bill = {
  id: number
  code: string
  tenant: { id: number; companyName: string }
  building: { id: number; name: string }
  room: { id: number; name: string; roomNumber: string }
  feeType: string
  period: string
  accountReceivable: number
  amountPaid: number
  amountDue: number
  status: string
  paymentStatus: string
  dueDate: string
  remark: string | null
}

type BillRule = {
  id: number
  name: string
  code: string
  feeType: string
  status: string
  periodEndDate?: string
  dueDateOffsetDays?: number
}
type TenantWithRooms = {
  id: number
  companyName: string
  building: { id: number; name: string }
  rooms: { roomId: number; roomNumber: string; name: string }[]
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
const PAYMENT_METHODS = ['现金', '转账', '微信支付', '其他'] as const
const REMINDER_METHODS = ['微信', '短信', '邮件', '线下'] as const

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
    tenantId: initialTenantId,
    status: '',
    paymentStatus: '',
    overdue: '',
  })
  useEffect(() => {
    if (initialTenantId) {
      setFilters((p) => ({ ...p, tenantId: initialTenantId }))
    }
  }, [initialTenantId])
  const [generateOpen, setGenerateOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchBills = async () => {
    const params = new URLSearchParams()
    if (filters.buildingId) params.set('buildingId', filters.buildingId)
    if (filters.tenantId) params.set('tenantId', filters.tenantId)
    if (filters.status) params.set('status', filters.status)
    if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
    if (filters.overdue === 'true') params.set('overdue', 'true')
    const res = await fetch(`/api/bills?${params}`)
    const json = await res.json()
    if (json.success) setData(json.data)
    else setData(null)
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
        json.data.list.map((t: { id: number; companyName: string; building: { id: number; name: string }; rooms: { roomId: number; roomNumber: string; name: string }[] }) => ({
          id: t.id,
          companyName: t.companyName,
          building: t.building,
          rooms: t.rooms || [],
        }))
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
  }, [filters.buildingId, filters.tenantId, filters.status, filters.paymentStatus, filters.overdue])

  useEffect(() => {
    if (generateOpen) {
      fetchRules()
      fetchTenantsWithRooms()
    }
  }, [generateOpen])

  useEffect(() => {
    if (paymentOpen) fetchTenantsWithRooms()
  }, [paymentOpen])

  const list = data?.list ?? []
  const buildings = data?.buildings ?? []
  const tenants = data?.tenants ?? []
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(list, 15)

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
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <select
          value={filters.buildingId}
          onChange={(e) => setFilters((p) => ({ ...p, buildingId: e.target.value }))}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
        >
          <option value="">全部楼宇</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={filters.tenantId}
          onChange={(e) => setFilters((p) => ({ ...p, tenantId: e.target.value }))}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
        >
          <option value="">全部租客</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.companyName}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
        >
          <option value="">全部状态</option>
          <option value="open">开启</option>
          <option value="closed">关闭</option>
        </select>
        <select
          value={filters.paymentStatus}
          onChange={(e) => setFilters((p) => ({ ...p, paymentStatus: e.target.value }))}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
        >
          <option value="">全部结清状态</option>
          <option value="unpaid">未缴纳</option>
          <option value="partial">部分缴纳</option>
          <option value="paid">已结清</option>
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.overdue === 'true'}
            onChange={(e) => setFilters((p) => ({ ...p, overdue: e.target.checked ? 'true' : '' }))}
            className="rounded"
          />
          <span className="text-sm">逾期</span>
        </label>
        <div className="flex-1" />
        <button
          onClick={() => setGenerateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          生成账单
        </button>
        <button
          onClick={() => setPaymentOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500"
        >
          <Banknote className="w-4 h-4" />
          线下缴费
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">账单编号</th>
              <th className="text-left p-4 font-medium">租客</th>
              <th className="text-left p-4 font-medium">楼宇</th>
              <th className="text-left p-4 font-medium">房源</th>
              <th className="text-left p-4 font-medium">费用类型</th>
              <th className="text-left p-4 font-medium">账期</th>
              <th className="text-right p-4 font-medium">应收</th>
              <th className="text-right p-4 font-medium">已缴</th>
              <th className="text-right p-4 font-medium">待缴</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium">结清状态</th>
              <th className="text-left p-4 font-medium">应收日期</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((b) => (
              <tr
                key={b.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{b.code}</td>
                <td className="p-4">{b.tenant?.companyName ?? '-'}</td>
                <td className="p-4">{b.building?.name ?? '-'}</td>
                <td className="p-4">{b.room?.roomNumber ?? b.room?.name ?? '-'}</td>
                <td className="p-4">{b.feeType}</td>
                <td className="p-4 text-sm">{b.period}</td>
                <td className="p-4 text-right">¥{b.accountReceivable.toFixed(2)}</td>
                <td className="p-4 text-right">¥{b.amountPaid.toFixed(2)}</td>
                <td className="p-4 text-right">¥{b.amountDue.toFixed(2)}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs ${b.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {STATUS_LABELS[b.status] ?? b.status}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                    b.paymentStatus === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    b.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {PAYMENT_STATUS_LABELS[b.paymentStatus] ?? b.paymentStatus}
                  </span>
                </td>
                <td className="p-4">{b.dueDate}</td>
                <td className="p-4">
                  <div className="flex gap-1">
                    {b.amountPaid > 0 && (
                      <button
                        onClick={() => { setSelectedBill(b); setRefundOpen(true) }}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                        title="退费"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {b.paymentStatus !== 'paid' && (
                      <button
                        onClick={() => { setSelectedBill(b); setReminderOpen(true) }}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                        title="催缴"
                      >
                        <Bell className="w-4 h-4" />
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
          暂无账单，点击「生成账单」添加
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
      {paymentOpen && (
        <PaymentModal
          tenantsWithRooms={tenantsWithRooms}
          onClose={() => setPaymentOpen(false)}
          onSuccess={() => { setPaymentOpen(false); fetchBills() }}
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
      {reminderOpen && selectedBill && (
        <ReminderModal
          bill={selectedBill}
          onClose={() => { setReminderOpen(false); setSelectedBill(null) }}
          onSuccess={() => { setReminderOpen(false); setSelectedBill(null); fetchBills() }}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
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

  const handleRuleChange = (newRuleId: string) => {
    setRuleId(newRuleId)
    const rule = rules.find((r) => String(r.id) === newRuleId)
    if (rule?.periodEndDate && rule.dueDateOffsetDays != null) {
      const end = new Date(rule.periodEndDate)
      end.setDate(end.getDate() + rule.dueDateOffsetDays)
      setDueDate(end.toISOString().slice(0, 10))
    }
  }

  const togglePair = (tenantId: number, roomId: number) => {
    const key = `${tenantId}-${roomId}`
    setSelectedPairs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
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
    setSubmitting(true)
    try {
      const items = Array.from(selectedPairs).map((k) => {
        const [tid, rid] = k.split('-').map(Number)
        return { tenantId: tid, roomId: rid }
      })
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: Number(ruleId), items, dueDate, remark: remark || undefined }),
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
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">应收日期 *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">选择租客-房源（可多选）</label>
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-48 overflow-y-auto">
              {tenantsWithRooms.filter((t) => t.rooms?.length).map((t) => (
                <div key={t.id} className="p-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="font-medium text-sm">{t.companyName} - {t.building?.name}</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {t.rooms.map((r) => (
                      <label key={r.roomId} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPairs.has(`${t.id}-${r.roomId}`)}
                          onChange={() => togglePair(t.id, r.roomId)}
                        />
                        <span className="text-sm">{r.roomNumber}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {tenantsWithRooms.filter((t) => t.rooms?.length).length === 0 && (
                <div className="p-4 text-slate-500 text-sm">暂无租客-房源数据</div>
              )}
            </div>
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
  )
}

function PaymentModal({
  tenantsWithRooms,
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  tenantsWithRooms: TenantWithRooms[]
  onClose: () => void
  onSuccess: () => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [tenantId, setTenantId] = useState('')
  const [unpaidBills, setUnpaidBills] = useState<Bill[]>([])
  const [billIds, setBillIds] = useState<Set<number>>(new Set())
  const [totalAmount, setTotalAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('现金')
  const [payer, setPayer] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16))

  useEffect(() => {
    if (!tenantId) {
      setUnpaidBills([])
      setBillIds(new Set())
      setTotalAmount('')
      return
    }
    fetch(`/api/bills?tenantId=${tenantId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const unpaid = (json.data.list ?? []).filter((b: Bill) => b.paymentStatus !== 'paid')
          setUnpaidBills(unpaid)
          setBillIds(new Set(unpaid.map((b: Bill) => b.id)))
          setTotalAmount(unpaid.reduce((s: number, b: Bill) => s + b.amountDue, 0).toFixed(2))
        }
      })
  }, [tenantId])

  const toggleBill = (id: number) => {
    setBillIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const sum = unpaidBills.filter((b) => next.has(b.id)).reduce((s, b) => s + b.amountDue, 0)
      setTotalAmount(sum.toFixed(2))
      return next
    })
  }

  const handleSubmit = async () => {
    if (!tenantId || billIds.size === 0 || !totalAmount || !payer) {
      alert('请填写完整信息')
      return
    }
    const amt = parseFloat(totalAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('缴纳金额必须大于0')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: Number(tenantId),
          billIds: Array.from(billIds),
          totalAmount: amt,
          paymentMethod,
          payer,
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

  const tenants = tenantsWithRooms.map((t) => ({ id: t.id, companyName: t.companyName }))

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
            <label className="block text-sm font-medium mb-1">租客 *</label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">请选择</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.companyName}</option>
              ))}
            </select>
          </div>
          {tenantId && unpaidBills.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">选择账单（待缴 ¥{unpaidBills.filter((b) => billIds.has(b.id)).reduce((s, b) => s + b.amountDue, 0).toFixed(2)}）</label>
              <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-32 overflow-y-auto">
                {unpaidBills.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 p-2 border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billIds.has(b.id)}
                      onChange={() => toggleBill(b.id)}
                    />
                    <span className="text-sm">{b.code} 待缴 ¥{b.amountDue.toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {tenantId && unpaidBills.length === 0 && (
            <div className="text-amber-600 text-sm">该租客暂无待缴账单</div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">缴纳金额 *</label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
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
            disabled={submitting || !tenantId || billIds.size === 0}
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

function ReminderModal({
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
  const [method, setMethod] = useState('微信')
  const [content, setContent] = useState('')

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billIds: [bill.id],
          method,
          content: content || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        alert('催缴已发送')
        onSuccess()
      } else {
        alert(json.message || '催缴失败')
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
          <h2 className="text-lg font-semibold">催缴</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            账单 {bill.code}，待缴 ¥{bill.amountDue.toFixed(2)}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">催缴方式 *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {REMINDER_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">催缴内容（选填）</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="选填"
              rows={3}
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
            {submitting ? '发送中...' : '发送催缴'}
          </button>
        </div>
      </div>
    </div>
  )
}
