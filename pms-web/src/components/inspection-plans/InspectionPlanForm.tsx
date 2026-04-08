'use client'

import { useState, useEffect, useRef } from 'react'
import { GripVertical, X } from 'lucide-react'
import { planTypeMatchesCategory } from '@/lib/inspection-point-types'
import type { CycleScheduleV1, DailySlot, WeeklySlot, MonthlySlot } from '@/lib/inspection-cycle-schedule'

type InspectionPlan = {
  id: number
  name: string
  inspectionType: string
  cycleType: string
  cycleValue: number
  cycleWeekday?: number | null
  cycleMonthDay?: number | null
  cycleSchedule?: CycleScheduleV1 | null
  requirePhoto?: boolean
  /** 是否参与每日定时自动生成任务 */
  autoGenerateTasks?: boolean
  userIds: number[]
  checkItems: { name: string; nfcTagId?: number }[]
  inspectionPointIds?: number[]
  buildingId?: number | null
  status: string
}

type Employee = { id: number; name: string }
type Building = { id: number; name: string }

type WeekdayOpt = { value: number; label: string }

/** 巡检点列表项（含位置，供计划路线展示） */
type PointOption = { id: number; name: string; inspectionCategory: string; location: string }

const SCHEDULE_V = 1 as const

/** 位置为空时显示两条横线样式 */
function formatPointLocation(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  return s || '--'
}

function defaultSlots(
  cycleType: string,
  count: number,
  legacyWeekday?: number | null,
  legacyMonthDay?: number | null
): DailySlot[] | WeeklySlot[] | MonthlySlot[] {
  const n = Math.max(1, count)
  if (cycleType === '每天') {
    return Array.from({ length: n }, () => ({ time: '09:00' }))
  }
  if (cycleType === '每周') {
    const wd = legacyWeekday && legacyWeekday >= 1 && legacyWeekday <= 7 ? legacyWeekday : 1
    return Array.from({ length: n }, () => ({ weekday: wd, time: '09:00' }))
  }
  const md = legacyMonthDay && legacyMonthDay >= 1 && legacyMonthDay <= 28 ? legacyMonthDay : 1
  return Array.from({ length: n }, () => ({ monthDay: md, time: '09:00' }))
}

function scheduleToSlots(
  cycleType: string,
  sch: CycleScheduleV1 | null | undefined,
  cycleValue: number,
  legacyWeekday?: number | null,
  legacyMonthDay?: number | null
): DailySlot[] | WeeklySlot[] | MonthlySlot[] {
  if (sch && sch.v === SCHEDULE_V && Array.isArray(sch.slots) && sch.slots.length > 0) {
    if (cycleType === '每天' && sch.kind === 'daily') return sch.slots
    if (cycleType === '每周' && sch.kind === 'weekly') return sch.slots
    if (cycleType === '每月' && sch.kind === 'monthly') return sch.slots
  }
  return defaultSlots(cycleType, cycleValue, legacyWeekday, legacyMonthDay)
}

/** 将列表中一项从 fromIndex 移到 toIndex（用于路线拖拽排序） */
function reorderIds<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return list
  }
  const next = [...list]
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed)
  return next
}

function buildCycleSchedulePayload(
  cycleType: string,
  slots: DailySlot[] | WeeklySlot[] | MonthlySlot[]
): CycleScheduleV1 {
  if (cycleType === '每天') {
    return { v: SCHEDULE_V, kind: 'daily', slots: slots as DailySlot[] }
  }
  if (cycleType === '每周') {
    return { v: SCHEDULE_V, kind: 'weekly', slots: slots as WeeklySlot[] }
  }
  return { v: SCHEDULE_V, kind: 'monthly', slots: slots as MonthlySlot[] }
}

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
  const [slots, setSlots] = useState<DailySlot[] | WeeklySlot[] | MonthlySlot[]>([{ time: '09:00' }])
  const [buildingId, setBuildingId] = useState(0)
  const [userIds, setUserIds] = useState<number[]>([])
  const [selectedPointIds, setSelectedPointIds] = useState<number[]>([])
  const [requirePhoto, setRequirePhoto] = useState(true)
  const [autoGenerateTasks, setAutoGenerateTasks] = useState(true)
  const [status, setStatus] = useState('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pointOptions, setPointOptions] = useState<PointOption[]>([])
  const [pointsLoading, setPointsLoading] = useState(false)
  const routeDragFrom = useRef<number | null>(null)

  const isEdit = !!plan

  useEffect(() => {
    let cancelled = false
    async function loadPoints() {
      if (!buildingId || !inspectionType) {
        setPointOptions([])
        return
      }
      setPointsLoading(true)
      try {
        const q = new URLSearchParams({
          buildingId: String(buildingId),
          status: 'enabled',
        })
        const res = await fetch(`/api/inspection-points?${q}`, { credentials: 'include' })
        const json = await res.json()
        if (cancelled || !json.success || !json.data?.list) {
          setPointOptions([])
          return
        }
        const list = json.data.list as {
          id: number
          name: string
          inspectionCategory: string
          location?: string | null
        }[]
        setPointOptions(
          list
            .filter((p) => planTypeMatchesCategory(inspectionType, p.inspectionCategory))
            .map((p) => ({
              id: p.id,
              name: p.name,
              inspectionCategory: p.inspectionCategory,
              location: typeof p.location === 'string' ? p.location : '',
            }))
        )
      } catch {
        if (!cancelled) setPointOptions([])
      } finally {
        if (!cancelled) setPointsLoading(false)
      }
    }
    void loadPoints()
    return () => {
      cancelled = true
    }
  }, [buildingId, inspectionType])

  useEffect(() => {
    if (plan) {
      setName(plan.name)
      setInspectionType(plan.inspectionType)
      setCycleType(plan.cycleType)
      setCycleValue(plan.cycleValue)
      setSlots(
        scheduleToSlots(
          plan.cycleType,
          plan.cycleSchedule ?? null,
          plan.cycleValue,
          plan.cycleWeekday,
          plan.cycleMonthDay
        )
      )
      setBuildingId(plan.buildingId ?? 0)
      setUserIds(plan.userIds)
      setSelectedPointIds(plan.inspectionPointIds ?? [])
      setRequirePhoto(plan.requirePhoto !== false)
      setAutoGenerateTasks(plan.autoGenerateTasks !== false)
      setStatus(plan.status)
    } else {
      const ct = cycleTypes[0] || '每天'
      setName('')
      setInspectionType(inspectionTypes[0] || '')
      setCycleType(ct)
      setCycleValue(1)
      setSlots(defaultSlots(ct, 1, null, null))
      setBuildingId(buildings[0]?.id ?? 0)
      setUserIds([])
      setSelectedPointIds([])
      setRequirePhoto(true)
      setAutoGenerateTasks(true)
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

  useEffect(() => {
    setSlots((prev) => {
      const n = Math.max(1, cycleValue)
      if (prev.length === n) return prev
      if (prev.length < n) {
        const extra = n - prev.length
        if (cycleType === '每天') {
          const p = prev as DailySlot[]
          return [...p, ...Array.from({ length: extra }, () => ({ time: p[p.length - 1]?.time ?? '09:00' }))]
        }
        if (cycleType === '每周') {
          const p = prev as WeeklySlot[]
          return [
            ...p,
            ...Array.from({ length: extra }, () => ({
              weekday: p[p.length - 1]?.weekday ?? 1,
              time: p[p.length - 1]?.time ?? '09:00',
            })),
          ]
        }
        const p = prev as MonthlySlot[]
        return [
          ...p,
          ...Array.from({ length: extra }, () => ({
            monthDay: p[p.length - 1]?.monthDay ?? 1,
            time: p[p.length - 1]?.time ?? '09:00',
          })),
        ]
      }
      return prev.slice(0, n)
    })
  }, [cycleValue, cycleType])

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
    if (selectedPointIds.length === 0) {
      setError('请至少选择一个巡检点作为路线')
      return
    }
    const schedulePayload = buildCycleSchedulePayload(cycleType, slots)
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        inspectionType: inspectionType || inspectionTypes[0],
        cycleType: cycleType || cycleTypes[0],
        cycleValue,
        cycleSchedule: schedulePayload,
        requirePhoto,
        autoGenerateTasks,
        buildingId,
        userIds,
        inspectionPointIds: selectedPointIds,
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
    cycleType === '每天'
      ? `周期值为每天生成巡检任务的次数（${cycleValue} 次/天），每次对应下方一个时刻，每次生成一条任务。`
      : cycleType === '每周'
        ? `周期值为每周生成任务的次数（${cycleValue} 次/周），请为每次选择周几与时刻。`
        : `周期值为每月生成任务的次数（${cycleValue} 次/月），请为每次选择日期（1–28）与时刻。`

  const updateDaily = (i: number, time: string) => {
    setSlots((prev) => {
      const next = [...(prev as DailySlot[])]
      next[i] = { ...next[i], time }
      return next
    })
  }

  const updateWeekly = (i: number, patch: Partial<WeeklySlot>) => {
    setSlots((prev) => {
      const next = [...(prev as WeeklySlot[])]
      next[i] = { ...next[i], ...patch }
      return next
    })
  }

  const updateMonthly = (i: number, patch: Partial<MonthlySlot>) => {
    setSlots((prev) => {
      const next = [...(prev as MonthlySlot[])]
      next[i] = { ...next[i], ...patch }
      return next
    })
  }

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
              仅列出与本楼宇、本类型一致且已启用的巡检点；加入路线后可在下方拖动调整先后顺序。
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">选择巡检点（路线）*</label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 max-h-72 overflow-y-auto space-y-3">
              {pointsLoading ? (
                <p className="text-xs text-slate-500">加载巡检点…</p>
              ) : pointOptions.length === 0 ? (
                <p className="text-xs text-amber-600">
                  当前楼宇下没有符合条件的启用巡检点，请先在「巡检点」中维护并绑定 NFC。
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    先勾选要巡检的点；新勾选的点会排在路线末尾。已选点的顺序即为巡检路线，可在下方用鼠标拖动整行调整。
                  </p>
                  <div className="space-y-2">
                    {pointOptions.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 cursor-pointer text-sm w-full min-w-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPointIds.includes(p.id)}
                          onChange={() => {
                            setSelectedPointIds((prev) =>
                              prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                            )
                          }}
                          className="rounded shrink-0"
                        />
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="font-medium text-slate-800 dark:text-slate-100 shrink-0">
                            {p.name}
                          </span>
                          <span
                            className="text-slate-500 dark:text-slate-400 text-right truncate max-w-[55%]"
                            title={formatPointLocation(p.location)}
                          >
                            {formatPointLocation(p.location)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedPointIds.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-600 space-y-2">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        路线顺序（第 1 站 → 第 N 站，拖动行即可调整）
                      </p>
                      <ul className="space-y-1.5">
                        {selectedPointIds.map((pid, index) => {
                          const p = pointOptions.find((x) => x.id === pid)
                          if (!p) return null
                          return (
                            <li
                              key={pid}
                              draggable
                              onDragStart={(e) => {
                                routeDragFrom.current = index
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', String(index))
                              }}
                              onDragEnd={() => {
                                routeDragFrom.current = null
                              }}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                const fromStr =
                                  e.dataTransfer.getData('text/plain') ||
                                  (routeDragFrom.current !== null ? String(routeDragFrom.current) : '')
                                const from = parseInt(fromStr, 10)
                                routeDragFrom.current = null
                                if (Number.isNaN(from)) return
                                setSelectedPointIds((prev) => reorderIds(prev, from, index))
                              }}
                              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-700/40 px-2 py-1.5 text-sm select-none cursor-grab active:cursor-grabbing"
                            >
                              <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2">
                                <GripVertical
                                  className="h-4 w-4 shrink-0 text-slate-400"
                                  aria-hidden
                                />
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                                  {index + 1}
                                </span>
                                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                  <span className="min-w-0 font-medium text-slate-800 dark:text-slate-100 truncate">
                                    {p.name}
                                  </span>
                                  <span className="shrink-0 text-slate-500 dark:text-slate-400 text-xs sm:text-sm truncate max-w-[45%] text-right">
                                    {formatPointLocation(p.location)}
                                  </span>
                                </span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">周期类型 *</label>
              <select
                value={cycleType}
                onChange={(e) => {
                  const next = e.target.value
                  setCycleType(next)
                  setSlots(defaultSlots(next, cycleValue, null, null))
                }}
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
              <label className="block text-sm font-medium mb-1">周期值（次数）*</label>
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

          <div>
            <label className="block text-sm font-medium mb-2">执行时刻（与周期值条数一致）</label>
            <div className="space-y-2">
              {cycleType === '每天' &&
                (slots as DailySlot[]).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500 w-16">第 {i + 1} 次</span>
                    <input
                      type="time"
                      value={s.time.length === 5 ? s.time : '09:00'}
                      onChange={(e) => updateDaily(i, e.target.value)}
                      className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    />
                  </div>
                ))}
              {cycleType === '每周' &&
                (slots as WeeklySlot[]).map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500">第 {i + 1} 次</span>
                    <select
                      value={s.weekday}
                      onChange={(e) => updateWeekly(i, { weekday: Number(e.target.value) })}
                      className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    >
                      {cycleWeekdayOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={s.time}
                      onChange={(e) => updateWeekly(i, { time: e.target.value })}
                      className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    />
                  </div>
                ))}
              {cycleType === '每月' &&
                (slots as MonthlySlot[]).map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500">第 {i + 1} 次</span>
                    <select
                      value={s.monthDay}
                      onChange={(e) => updateMonthly(i, { monthDay: Number(e.target.value) })}
                      className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    >
                      {Array.from({ length: 28 }, (_, j) => j + 1).map((d) => (
                        <option key={d} value={d}>
                          {d} 号
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={s.time}
                      onChange={(e) => updateMonthly(i, { time: e.target.value })}
                      className="px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    />
                  </div>
                ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="requirePhoto"
              type="checkbox"
              checked={requirePhoto}
              onChange={(e) => setRequirePhoto(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="requirePhoto" className="text-sm cursor-pointer">
              必须拍照（每个巡检点 NFC 打卡后须上传照片才能完成）
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">定时自动生成巡检任务</label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              选「是」则每日定时任务会按本计划周期生成任务；选「否」则不会进入定时任务，仍可在「巡检任务」页手动「按周期生成」时勾选本计划。
            </p>
            <select
              value={autoGenerateTasks ? 'yes' : 'no'}
              onChange={(e) => setAutoGenerateTasks(e.target.value === 'yes')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="yes">是（参与每日自动）</option>
              <option value="no">否（不参与每日自动）</option>
            </select>
          </div>

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
