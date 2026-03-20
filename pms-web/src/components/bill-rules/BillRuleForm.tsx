'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Search, ChevronRight, Building2 } from 'lucide-react'
import type { BillRule } from './BillRuleList'

const FEE_TYPE_SUGGESTIONS = ['物业费', '水电费', '租金', '其他']

type ApiData = {
  tenants: { id: number; companyName: string }[]
  buildings: { id: number; name: string }[]
  rooms: { id: number; name: string; roomNumber: string; buildingId: number; type?: string }[]
  accounts: { id: number; name: string; bankName: string; accountNumber: string }[]
}

function TenantPickerModal({
  open,
  onClose,
  tenants,
  value,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  tenants: ApiData['tenants']
  value: number[]
  onConfirm: (ids: number[]) => void
}) {
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState<number[]>(value)

  useEffect(() => {
    if (open) {
      setDraft(value)
      setKeyword('')
    }
  }, [open, value])

  const filtered = useMemo(() => {
    if (!keyword.trim()) return tenants
    const kw = keyword.trim().toLowerCase()
    return tenants.filter((t) => t.companyName.toLowerCase().includes(kw))
  }, [tenants, keyword])

  const allSelected =
    filtered.length > 0 && filtered.every((t) => draft.includes(t.id))

  const toggle = (id: number) => {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAll = (checked: boolean) => {
    if (checked) {
      setDraft((prev) => [...new Set([...prev, ...filtered.map((t) => t.id)])])
    } else {
      const rm = new Set(filtered.map((t) => t.id))
      setDraft((prev) => prev.filter((id) => !rm.has(id)))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold">选择适用租客</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按租客名称搜索"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              autoFocus
            />
          </div>
          {filtered.length > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={allSelected} onChange={(e) => selectAll(e.target.checked)} />
              全选当前列表
            </label>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[50vh]">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">{tenants.length === 0 ? '暂无租客' : '无匹配租客'}</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((t) => (
                <li key={t.id}>
                  <label className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <input type="checkbox" checked={draft.includes(t.id)} onChange={() => toggle(t.id)} />
                    <span className="text-sm">{t.companyName}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="px-4 text-xs text-slate-500">不勾选任何租客并确定后，表示适用全部租客</p>
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
  )
}

function RoomPickerModal({
  open,
  onClose,
  buildingName,
  rooms,
  initialSelectedIds,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  buildingName: string
  rooms: ApiData['rooms']
  initialSelectedIds: number[]
  onConfirm: (ids: number[]) => void
}) {
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [draft, setDraft] = useState<number[]>(initialSelectedIds)

  useEffect(() => {
    if (open) {
      setDraft(initialSelectedIds)
      setKeyword('')
      setTypeFilter('')
    }
  }, [open, initialSelectedIds])

  const roomTypes = useMemo(() => {
    const s = new Set<string>()
    rooms.forEach((r) => {
      if (r.type) s.add(r.type)
    })
    return Array.from(s).sort()
  }, [rooms])

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false
      if (!keyword.trim()) return true
      const kw = keyword.trim().toLowerCase()
      return (
        r.name.toLowerCase().includes(kw) ||
        r.roomNumber.toLowerCase().includes(kw) ||
        (r.type && r.type.toLowerCase().includes(kw))
      )
    })
  }, [rooms, keyword, typeFilter])

  const allSelected =
    filtered.length > 0 && filtered.every((r) => draft.includes(r.id))

  const toggle = (id: number) => {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllFiltered = (checked: boolean) => {
    if (checked) {
      setDraft((prev) => [...new Set([...prev, ...filtered.map((r) => r.id)])])
    } else {
      const rm = new Set(filtered.map((r) => r.id))
      setDraft((prev) => prev.filter((id) => !rm.has(id)))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">选择房源</h3>
            <p className="text-sm text-slate-500 mt-0.5">{buildingName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索房号或房源名称"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">全部类型</option>
              {roomTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
              </option>
              ))}
            </select>
            {filtered.length > 0 && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => selectAllFiltered(e.target.checked)}
                />
                全选当前列表
              </label>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-[180px] max-h-[45vh]">
          {rooms.length === 0 ? (
            <p className="text-sm text-slate-500">该楼宇暂无房源</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">无匹配房源</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((r) => (
                <li key={r.id}>
                  <label className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <input type="checkbox" checked={draft.includes(r.id)} onChange={() => toggle(r.id)} />
                    <span className="text-sm">
                      {r.roomNumber} - {r.name}
                      {r.type ? ` (${r.type})` : ''}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
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
  )
}

function BuildingRoomScopeModal({
  open,
  onClose,
  buildings,
  rooms,
  buildingIds,
  roomIds,
  setBuildingIds,
  setRoomIds,
}: {
  open: boolean
  onClose: () => void
  buildings: ApiData['buildings']
  rooms: ApiData['rooms']
  buildingIds: number[]
  roomIds: number[]
  setBuildingIds: React.Dispatch<React.SetStateAction<number[]>>
  setRoomIds: React.Dispatch<React.SetStateAction<number[]>>
}) {
  const [roomModalBuildingId, setRoomModalBuildingId] = useState<number | null>(null)

  const roomsByBuilding = useCallback(
    (bid: number) => rooms.filter((r) => r.buildingId === bid),
    [rooms]
  )

  const isWholeBuilding = (bid: number) => {
    if (!buildingIds.includes(bid)) return false
    const inB = roomsByBuilding(bid).map((r) => r.id)
    if (inB.length === 0) return true
    return inB.every((id) => !roomIds.includes(id))
  }

  const toggleWholeBuilding = (bid: number) => {
    setBuildingIds((prev) => {
      if (prev.includes(bid)) {
        return prev.filter((x) => x !== bid)
      }
      setRoomIds((rids) =>
        rids.filter((id) => {
          const r = rooms.find((x) => x.id === id)
          return r?.buildingId !== bid
        })
      )
      return [...prev, bid]
    })
  }

  const openRoomPicker = (bid: number) => {
    setRoomModalBuildingId(bid)
  }

  const buildingRoomSelectedCount = (bid: number) =>
    roomsByBuilding(bid).filter((r) => roomIds.includes(r.id)).length

  const confirmRoomsForBuilding = (bid: number, selected: number[]) => {
    setBuildingIds((prev) => prev.filter((b) => b !== bid))
    setRoomIds((prev) => {
      const others = prev.filter((id) => {
        const r = rooms.find((x) => x.id === id)
        return r?.buildingId !== bid
      })
      return [...others, ...selected]
    })
  }

  const selectAllBuildingsWhole = () => {
    setBuildingIds(buildings.map((b) => b.id))
    setRoomIds((prev) => {
      const covered = new Set(buildings.flatMap((b) => roomsByBuilding(b.id).map((r) => r.id)))
      return prev.filter((id) => !covered.has(id))
    })
  }

  const clearAllBuildings = () => {
    setBuildingIds([])
    setRoomIds([])
  }

  if (!open) return null

  const roomModalBuilding = roomModalBuildingId != null ? buildings.find((b) => b.id === roomModalBuildingId) : null
  const roomModalRooms = roomModalBuildingId != null ? roomsByBuilding(roomModalBuildingId) : []

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">适用楼宇及房源</h3>
              <p className="text-xs text-slate-500 mt-1">楼宇可勾选「整栋」；或点击「选择房源」按间勾选。均不选表示全部适用。</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={selectAllBuildingsWhole}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              全选楼宇（整栋）
            </button>
            <button type="button" onClick={clearAllBuildings} className="text-sm text-slate-600 hover:text-slate-800">
              清空
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 min-h-[200px] max-h-[55vh] space-y-2">
            {buildings.length === 0 ? (
              <p className="text-sm text-slate-500">暂无楼宇数据</p>
            ) : (
              buildings.map((b) => {
                const whole = isWholeBuilding(b.id)
                const partCount = buildingRoomSelectedCount(b.id)
                return (
                  <div
                    key={b.id}
                    className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{b.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {whole && '已选：整栋全部房源'}
                          {!whole && partCount > 0 && `已选：${partCount} 间房源`}
                          {!whole && partCount === 0 && !buildingIds.includes(b.id) && '未限定'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-6">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={whole}
                          onChange={() => toggleWholeBuilding(b.id)}
                        />
                        适用整栋
                      </label>
                      <button
                        type="button"
                        onClick={() => openRoomPicker(b.id)}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
                      >
                        选择房源
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              完成
            </button>
          </div>
        </div>
      </div>

      {roomModalBuilding && (
        <RoomPickerModal
          open={roomModalBuildingId != null}
          onClose={() => setRoomModalBuildingId(null)}
          buildingName={roomModalBuilding.name}
          rooms={roomModalRooms}
          initialSelectedIds={roomsByBuilding(roomModalBuilding.id)
            .filter((r) => roomIds.includes(r.id))
            .map((r) => r.id)}
          onConfirm={(ids) => confirmRoomsForBuilding(roomModalBuilding.id, ids)}
        />
      )}
    </>
  )
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

  const [tenantModalOpen, setTenantModalOpen] = useState(false)
  const [scopeModalOpen, setScopeModalOpen] = useState(false)

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

  const tenantSummary = useMemo(() => {
    if (tenantIds.length === 0) return '全部租客'
    if (tenantIds.length <= 2) {
      const names = tenantIds
        .map((id) => data.tenants.find((t) => t.id === id)?.companyName)
        .filter(Boolean)
      return names.join('、') || `已选 ${tenantIds.length} 个租客`
    }
    return `已选 ${tenantIds.length} 个租客`
  }, [tenantIds, data.tenants])

  const scopeSummary = useMemo(() => {
    if (buildingIds.length === 0 && roomIds.length === 0) return '全部楼宇及房源'
    const parts: string[] = []
    if (buildingIds.length > 0) {
      parts.push(`${buildingIds.length} 个楼宇（整栋）`)
    }
    if (roomIds.length > 0) {
      parts.push(`${roomIds.length} 间房源`)
    }
    return parts.join('，') || '已限定范围'
  }, [buildingIds, roomIds])

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
    <>
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
                <label className="block text-sm font-medium mb-1">每平米每月应收(元/㎡/月)</label>
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
                    onChange={(e) =>
                      setDueDateOffsetType(e.target.value as 'same' | 'advance' | 'postpone')
                    }
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
              相对账期开始日：当日=账期开始当天，提前=早于开始日N天，延后=晚于开始日N天（生成账单时默认应收日期按此计算）
            </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">适用租客</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  readOnly
                  value={tenantSummary}
                  placeholder="点击选择适用租客"
                  onFocus={() => setTenantModalOpen(true)}
                  onClick={() => setTenantModalOpen(true)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600/50"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">点击或聚焦后弹出选择；不选则适用全部租客</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">适用楼宇及房源</label>
              <div className="relative">
                <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  readOnly
                  value={scopeSummary}
                  placeholder="点击设置楼宇及房源"
                  onFocus={() => setScopeModalOpen(true)}
                  onClick={() => setScopeModalOpen(true)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600/50"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                点击或聚焦后设置；楼宇下房源在子窗口中勾选。均不选则适用全部楼宇及房源
              </p>
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

      <TenantPickerModal
        open={tenantModalOpen}
        onClose={() => setTenantModalOpen(false)}
        tenants={data.tenants}
        value={tenantIds}
        onConfirm={setTenantIds}
      />

      <BuildingRoomScopeModal
        open={scopeModalOpen}
        onClose={() => setScopeModalOpen(false)}
        buildings={data.buildings}
        rooms={data.rooms}
        buildingIds={buildingIds}
        roomIds={roomIds}
        setBuildingIds={setBuildingIds}
        setRoomIds={setRoomIds}
      />
    </>
  )
}
