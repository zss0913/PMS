'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'

type CheckItem = { name: string; nfcTagId: number }

type InspectionPlan = {
  id: number
  name: string
  inspectionType: string
  cycleType: string
  cycleValue: number
  cycleWeekday?: number | null
  cycleMonthDay?: number | null
  userIds: number[]
  checkItems: CheckItem[]
  buildingId?: number | null
  status: string
}

type Employee = { id: number; name: string }
type Building = { id: number; name: string }
type NfcOption = { id: number; tagId: string; location: string; buildingName: string }

type WeekdayOpt = { value: number; label: string }

export function InspectionPlanForm({
  plan,
  employees,
  buildings,
  inspectionTypes,
  cycleTypes,
  cycleWeekdayOptions,
  onClose,
}: {
  plan: InspectionPlan | null
  employees: Employee[]
  buildings: Building[]
  inspectionTypes: string[]
  cycleTypes: string[]
  cycleWeekdayOptions: WeekdayOpt[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [inspectionType, setInspectionType] = useState('')
  const [cycleType, setCycleType] = useState('')
  const [cycleValue, setCycleValue] = useState(1)
  const [cycleWeekday, setCycleWeekday] = useState(1)
  const [cycleMonthDay, setCycleMonthDay] = useState(1)
  const [buildingId, setBuildingId] = useState(0)
  const [userIds, setUserIds] = useState<number[]>([])
  const [checkItems, setCheckItems] = useState<CheckItem[]>([{ name: '', nfcTagId: 0 }])
  const [status, setStatus] = useState('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [nfcOptions, setNfcOptions] = useState<NfcOption[]>([])
  const [nfcLoading, setNfcLoading] = useState(false)

  const isEdit = !!plan

  const loadNfc = useCallback(async () => {
    if (!buildingId || !inspectionType) {
      setNfcOptions([])
      return
    }
    setNfcLoading(true)
    try {
      const q = new URLSearchParams({
        buildingId: String(buildingId),
        inspectionType,
        status: 'active',
      })
      const res = await fetch(`/api/nfc-tags?${q}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data?.list) {
        setNfcOptions(
          json.data.list.map((t: { id: number; tagId: string; location: string; buildingName: string }) => ({
            id: t.id,
            tagId: t.tagId,
            location: t.location,
            buildingName: t.buildingName,
          }))
        )
      } else {
        setNfcOptions([])
      }
    } catch {
      setNfcOptions([])
    } finally {
      setNfcLoading(false)
    }
  }, [buildingId, inspectionType])

  useEffect(() => {
    void loadNfc()
  }, [loadNfc])

  useEffect(() => {
    if (plan) {
      setName(plan.name)
      setInspectionType(plan.inspectionType)
      setCycleType(plan.cycleType)
      setCycleValue(plan.cycleValue)
      setCycleWeekday(plan.cycleWeekday ?? 1)
      setCycleMonthDay(plan.cycleMonthDay ?? 1)
      setBuildingId(plan.buildingId ?? 0)
      setUserIds(plan.userIds)
      const items = plan.checkItems?.length
        ? plan.checkItems.map((c) => ({
            name: c.name,
            nfcTagId: typeof c.nfcTagId === 'number' && c.nfcTagId > 0 ? c.nfcTagId : 0,
          }))
        : [{ name: '', nfcTagId: 0 }]
      setCheckItems(items)
      setStatus(plan.status)
    } else {
      setName('')
      setInspectionType(inspectionTypes[0] || '')
      setCycleType(cycleTypes[0] || '')
      setCycleValue(1)
      setCycleWeekday(1)
      setCycleMonthDay(1)
      setBuildingId(buildings[0]?.id ?? 0)
      setUserIds([])
      setCheckItems([{ name: '', nfcTagId: 0 }])
      setStatus('active')
    }
  }, [plan, inspectionTypes, cycleTypes, buildings])

  useEffect(() => {
    if (!isEdit && inspectionTypes.length && !inspectionType) {
      setInspectionType(inspectionTypes[0])
    }
    if (!isEdit && cycleTypes.length && !cycleType) {
      setCycleType(cycleTypes[0])
    }
  }, [isEdit, inspectionTypes, cycleTypes, inspectionType, cycleType])

  const addCheckItem = () => {
    setCheckItems((prev) => [...prev, { name: '', nfcTagId: 0 }])
  }

  const removeCheckItem = (idx: number) => {
    setCheckItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateCheckItem = (idx: number, patch: Partial<CheckItem>) => {
    setCheckItems((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('计划名称必填')
      return
    }
    if (!buildingId) {
      setError('请选择楼宇')
      return
    }
    const validItems = checkItems.filter((c) => c.name?.trim() && c.nfcTagId > 0)
    if (validItems.length === 0) {
      setError('请至少添加一条检查项目并绑定 NFC')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        inspectionType: inspectionType || inspectionTypes[0],
        cycleType: cycleType || cycleTypes[0],
        cycleValue,
        cycleWeekday: cycleType === '每周' ? cycleWeekday : null,
        cycleMonthDay: cycleType === '每月' ? cycleMonthDay : null,
        buildingId,
        userIds,
        checkItems: validItems.map((c) => ({ name: c.name.trim(), nfcTagId: c.nfcTagId })),
        ...(isEdit && { status }),
      }
      const url = isEdit ? `/api/inspection-plans/${plan!.id}` : '/api/inspection-plans'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        onClose()
      } else {
        setError(json.message || '保存失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUserId = (id: number) => {
    setUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const cycleHint =
    cycleType === '每周'
      ? '在下方选择每周的星期；周期值为「每隔几周」执行一次（1=每周）。'
      : cycleType === '每月'
        ? '在下方选择每月几号生成任务（1-28）；周期值为「每隔几个月」一次。'
        : '周期值为「每隔几天」生成一次（1=每天）。'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold">
            {isEdit ? '编辑巡检计划' : '新建巡检计划'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          id="inspection-plan-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">计划名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入计划名称"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">所属楼宇 *</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              required
            >
              <option value={0}>请选择楼宇</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">巡检类型 *</label>
            <select
              value={inspectionType}
              onChange={(e) => setInspectionType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              required
            >
              {inspectionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              检查项目仅可选择该类型、本楼宇下且「启用」的 NFC 点。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">周期类型 *</label>
              <select
                value={cycleType}
                onChange={(e) => setCycleType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              >
                {cycleTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">周期值</label>
              <input
                type="number"
                min={1}
                value={cycleValue}
                onChange={(e) => setCycleValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">{cycleHint}</p>
          {cycleType === '每周' && (
            <div>
              <label className="block text-sm font-medium mb-1">每周星期几</label>
              <select
                value={cycleWeekday}
                onChange={(e) => setCycleWeekday(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                {cycleWeekdayOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {cycleType === '每月' && (
            <div>
              <label className="block text-sm font-medium mb-1">每月几号生成</label>
              <select
                value={cycleMonthDay}
                onChange={(e) => setCycleMonthDay(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d} 号
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">巡检人员</label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 max-h-32 overflow-y-auto space-y-2">
              {employees.length === 0 ? (
                <p className="text-sm text-slate-500">暂无员工</p>
              ) : (
                employees.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userIds.includes(e.id)}
                      onChange={() => toggleUserId(e.id)}
                      className="rounded"
                    />
                    <span>{e.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">检查项目（绑定 NFC）*</label>
              <button
                type="button"
                onClick={addCheckItem}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
            {nfcLoading && (
              <p className="text-xs text-slate-500 mb-2">加载 NFC 列表…</p>
            )}
            {!nfcLoading && buildingId > 0 && nfcOptions.length === 0 && (
              <p className="text-xs text-amber-600 mb-2">
                当前楼宇与类型下没有可用的启用 NFC，请先在「NFC标签」中维护。
              </p>
            )}
            <div className="space-y-2">
              {checkItems.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 items-stretch">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateCheckItem(idx, { name: e.target.value })}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    placeholder="检查项名称"
                  />
                  <select
                    value={item.nfcTagId || ''}
                    onChange={(e) =>
                      updateCheckItem(idx, { nfcTagId: Number(e.target.value) || 0 })
                    }
                    className="sm:w-64 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                  >
                    <option value="">选择 NFC 点</option>
                    {nfcOptions.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.tagId} · {n.location}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCheckItem(idx)}
                    className="p-2 text-slate-500 hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          {isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value="active">启用</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          )}
        </form>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            type="submit"
            form="inspection-plan-form"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
