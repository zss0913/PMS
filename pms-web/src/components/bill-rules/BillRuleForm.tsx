'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Search } from 'lucide-react'
import type { BillRule } from './BillRuleList'

const FEE_TYPE_SUGGESTIONS = ['物业费', '水电费', '租金', '其他']

type ApiData = {
  tenants: { id: number; companyName: string }[]
  buildings: { id: number; name: string }[]
  rooms: { id: number; name: string; roomNumber: string; buildingId: number; type?: string }[]
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
  const [dueDateOffsetType, setDueDateOffsetType] = useState<'same' | 'advance' | 'postpone'>('same')
  const [dueDateOffsetDays, setDueDateOffsetDays] = useState('0')
  const [accountId, setAccountId] = useState<number>(0)
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tenantKeyword, setTenantKeyword] = useState('')
  const [roomTypeFilter, setRoomTypeFilter] = useState('')

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
      const offset = rule.dueDateOffsetDays ?? 0
      if (offset === 0) {
        setDueDateOffsetType('same')
        setDueDateOffsetDays('0')
      } else if (offset < 0) {
        setDueDateOffsetType('advance')
        setDueDateOffsetDays(String(-offset))
      } else {
        setDueDateOffsetType('postpone')
        setDueDateOffsetDays(String(offset))
      }
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
      setDueDateOffsetType('same')
      setDueDateOffsetDays('0')
      setAccountId(data.accounts[0]?.id ?? 0)
      setStatus('active')
    }
  }, [rule, data])

  useEffect(() => {
    const availableIds = new Set(availableRooms.map((r) => r.id))
    setRoomIds((prev) => prev.filter((id) => availableIds.has(id)))
  }, [buildingIds, roomTypeFilter])

  const availableRooms = useMemo(() => {
    return data.rooms.filter((r) => {
      const matchBuilding = buildingIds.length === 0 || buildingIds.includes(r.buildingId)
      const matchType = !roomTypeFilter || (r.type && r.type === roomTypeFilter)
      return matchBuilding && matchType
    })
  }, [data.rooms, buildingIds, roomTypeFilter])

  const roomTypes = useMemo(() => {
    const types = new Set<string>()
    data.rooms.forEach((r) => {
      if (r.type && (buildingIds.length === 0 || buildingIds.includes(r.buildingId))) {
        types.add(r.type)
      }
    })
    return Array.from(types).sort()
  }, [data.rooms, buildingIds])

  const filteredTenants = useMemo(() => {
    if (!tenantKeyword.trim()) return data.tenants
    const kw = tenantKeyword.trim().toLowerCase()
    return data.tenants.filter((t) => t.companyName.toLowerCase().includes(kw))
  }, [data.tenants, tenantKeyword])

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

  const selectAllTenants = (checked: boolean) => {
    if (checked) {
      setTenantIds(filteredTenants.map((t) => t.id))
    } else {
      setTenantIds((prev) => prev.filter((id) => !filteredTenants.some((t) => t.id === id)))
    }
  }

  const selectAllRooms = (checked: boolean) => {
    if (checked) {
      setRoomIds(availableRooms.map((r) => r.id))
    } else {
      setRoomIds((prev) => prev.filter((id) => !availableRooms.some((r) => r.id === id)))
    }
  }

  const allTenantsSelected =
    filteredTenants.length > 0 && filteredTenants.every((t) => tenantIds.includes(t.id))
  const allRoomsSelected =
    availableRooms.length > 0 && availableRooms.every((r) => roomIds.includes(r.id))

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
        dueDateOffsetDays:
          dueDateOffsetType === 'same'
            ? 0
            : dueDateOffsetType === 'advance'
              ? -(Number(dueDateOffsetDays) || 0)
              : Number(dueDateOffsetDays) || 0,
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
              <input
                type="text"
                list="fee-type-list"
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                placeholder="选择或输入费用类型"
              />
              <datalist id="fee-type-list">
                {FEE_TYPE_SUGGESTIONS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">每平米应收金额(元/㎡)</label>
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
            <label className="block text-sm font-medium mb-1">应收日期</label>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">提前/延后</label>
                <select
                  value={dueDateOffsetType}
                  onChange={(e) => setDueDateOffsetType(e.target.value as 'same' | 'advance' | 'postpone')}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[100px]"
                >
                  <option value="same">当日</option>
                  <option value="advance">提前</option>
                  <option value="postpone">延后</option>
                </select>
              </div>
              {(dueDateOffsetType === 'advance' || dueDateOffsetType === 'postpone') && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">天数</label>
                  <input
                    type="number"
                    min="0"
                    value={dueDateOffsetDays}
                    onChange={(e) => setDueDateOffsetDays(e.target.value)}
                    className="w-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    placeholder="0"
                  />
                  <span className="ml-1 text-sm text-slate-600 dark:text-slate-400">天</span>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              相对账期结束日：当日=当天，提前=提前N天，延后=延后N天
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">适用租客</label>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={tenantKeyword}
                  onChange={(e) => setTenantKeyword(e.target.value)}
                  placeholder="按租客名称筛选"
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              {filteredTenants.length > 0 && (
                <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={allTenantsSelected}
                    onChange={(e) => selectAllTenants(e.target.checked)}
                  />
                  全选
                </label>
              )}
            </div>
            <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1">
              {filteredTenants.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {data.tenants.length === 0 ? '暂无租客数据' : '无匹配租客'}
                </p>
              ) : (
                filteredTenants.map((t) => (
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
            <p className="text-xs text-slate-500 mb-2">根据所选适用楼宇展示，不选楼宇则显示全部</p>
            <div className="flex items-center gap-2 mb-2">
              <select
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 min-w-[100px]"
              >
                <option value="">全部类型</option>
                {roomTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {availableRooms.length > 0 && (
                <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={allRoomsSelected}
                    onChange={(e) => selectAllRooms(e.target.checked)}
                  />
                  全选
                </label>
              )}
            </div>
            <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1">
              {availableRooms.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {buildingIds.length === 0
                    ? '请先选择适用楼宇'
                    : roomTypeFilter
                      ? '该类型下暂无房源'
                      : '暂无房源数据'}
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
                      {r.type ? ` (${r.type})` : ''}
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
