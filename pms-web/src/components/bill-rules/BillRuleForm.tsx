'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { BillRule } from './BillRuleList'

const FEE_TYPE_OPTIONS = [
  { value: '物业费', label: '物业费' },
  { value: '水电费', label: '水电费' },
  { value: '租金', label: '租金' },
  { value: '其他', label: '其他' },
]

type ApiData = {
  tenants: { id: number; companyName: string }[]
  buildings: { id: number; name: string }[]
  rooms: { id: number; name: string; roomNumber: string; buildingId: number }[]
  accounts: { id: number; name: string; bankName: string; accountNumber: string }[]
}

export function BillRuleForm({
  rule,
  data,
  onClose,
}: {
  rule: BillRule | null
  data: ApiData
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [feeType, setFeeType] = useState('物业费')
  const [amount, setAmount] = useState('')
  const [discountRate, setDiscountRate] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [tenantIds, setTenantIds] = useState<number[]>([])
  const [buildingIds, setBuildingIds] = useState<number[]>([])
  const [roomIds, setRoomIds] = useState<number[]>([])
  const [periodStartDate, setPeriodStartDate] = useState('')
  const [periodEndDate, setPeriodEndDate] = useState('')
  const [accountId, setAccountId] = useState<number>(0)
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!rule

  useEffect(() => {
    if (rule) {
      setName(rule.name)
      setFeeType(rule.feeType)
      setAmount(String(rule.amount))
      setDiscountRate(String(rule.discountRate))
      setDiscountAmount(String(rule.discountAmount))
      setTenantIds(rule.tenantIds ?? [])
      setBuildingIds(rule.buildingIds ?? [])
      setRoomIds(rule.roomIds ?? [])
      setPeriodStartDate(rule.periodStartDate)
      setPeriodEndDate(rule.periodEndDate)
      setAccountId(rule.accountId)
      setStatus((rule.status as 'active' | 'inactive') || 'active')
    } else {
      setName('')
      setFeeType('物业费')
      setAmount('')
      setDiscountRate('0')
      setDiscountAmount('0')
      setTenantIds([])
      setBuildingIds([])
      setRoomIds([])
      const today = new Date().toISOString().slice(0, 10)
      setPeriodStartDate(today)
      setPeriodEndDate(today)
      setAccountId(data.accounts[0]?.id ?? 0)
      setStatus('active')
    }
  }, [rule, data])

  const availableRooms = data.rooms.filter(
    (r) => buildingIds.length === 0 || buildingIds.includes(r.buildingId)
  )

  const toggleTenant = (id: number) => {
    setTenantIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleBuilding = (id: number) => {
    setBuildingIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      const stillAvailableIds = new Set(
        data.rooms
          .filter((r) => next.length === 0 || next.includes(r.buildingId))
          .map((r) => r.id)
      )
      setRoomIds((rIds) => rIds.filter((rid) => stillAvailableIds.has(rid)))
      return next
    })
  }

  const toggleRoom = (id: number) => {
    setRoomIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name,
        feeType,
        amount: Number(amount) || 0,
        discountRate: Number(discountRate) || 0,
        discountAmount: Number(discountAmount) || 0,
        tenantIds,
        buildingIds,
        roomIds,
        periodStartDate,
        periodEndDate,
        accountId: accountId || data.accounts[0]?.id,
        status,
      }

      const url = isEdit ? `/api/bill-rules/${rule!.id}` : '/api/bill-rules'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        onClose()
      } else {
        setError(json.message || '操作失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? '编辑账单规则' : '新增账单规则'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          id="bill-rule-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">规则名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                placeholder="请输入规则名称"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">费用类型</label>
              <select
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                {FEE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">应收金额</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">折扣率(%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discountRate}
                onChange={(e) => setDiscountRate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">减免金额</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">适用租客</label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1">
              {data.tenants.length === 0 ? (
                <p className="text-sm text-slate-500">暂无租客数据</p>
              ) : (
                data.tenants.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={tenantIds.includes(t.id)}
                      onChange={() => toggleTenant(t.id)}
                    />
                    <span className="text-sm">{t.companyName}</span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">不选则适用全部租客</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">适用楼宇</label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1">
              {data.buildings.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={buildingIds.includes(b.id)}
                    onChange={() => toggleBuilding(b.id)}
                  />
                  <span className="text-sm">{b.name}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">不选则适用全部楼宇</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">适用房源</label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1">
              {availableRooms.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {buildingIds.length ? '请先选择楼宇' : '暂无房源数据'}
                </p>
              ) : (
                availableRooms.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={roomIds.includes(r.id)}
                      onChange={() => toggleRoom(r.id)}
                    />
                    <span className="text-sm">
                      {r.roomNumber} - {r.name}
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">不选则适用全部房源</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">账期开始</label>
              <input
                type="date"
                value={periodStartDate}
                onChange={(e) => setPeriodStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">账期结束</label>
              <input
                type="date"
                value={periodEndDate}
                onChange={(e) => setPeriodEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">收款账户</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              required
            >
              <option value={0}>请选择收款账户</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} - {a.bankName} {a.accountNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </div>
        </form>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            type="submit"
            form="bill-rule-form"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
