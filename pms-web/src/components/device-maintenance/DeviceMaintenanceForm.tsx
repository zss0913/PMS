'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Search, ListChecks, Trash2, Link2 } from 'lucide-react'
import {
  DeviceMaintenanceImageUpload,
  parseMaintenanceImageUrls,
} from '@/components/device-maintenance/DeviceMaintenanceImageUpload'

export type DeviceOption = {
  id: number
  code: string
  name: string
  type: string
  buildingId: number
  buildingName: string
}

export type MaintainerOption = {
  id: number
  name: string
  phone: string
  departmentName: string
}

type OrphanPreview = {
  deviceCode: string
  deviceName: string
}

function deviceByIdsMap(options: DeviceOption[]): Map<number, DeviceOption> {
  return new Map(options.map((d) => [d.id, d]))
}

/** 维保类型常用项：可点选填入，也可在输入框中自行填写（如「精细保养」） */
const MAINTENANCE_TYPE_PRESETS = ['定期保养', '故障维修'] as const
const MAINTENANCE_TYPE_DATALIST_ID = 'device-maintenance-type-presets'

export type LinkedWorkOrderBrief = { id: number; code: string; title: string }

type WoCandRow = {
  id: number
  code: string
  title: string
  type: string
  status: string
  selectable: boolean
  linkedMaintenanceId: number | null
  linkedMaintenanceCode: string | null
}

/** 关联工单多选：默认可选列表不含已被其他维保占用的工单；勾选「显示已被占用」可查看并见标识 */
function WorkOrderPickerModal({
  open,
  maintenanceRecordId,
  knownWorkOrders,
  initialSelectedIds,
  onClose,
  onConfirm,
}: {
  open: boolean
  maintenanceRecordId: number | null
  knownWorkOrders: LinkedWorkOrderBrief[]
  initialSelectedIds: number[]
  onClose: () => void
  onConfirm: (selected: LinkedWorkOrderBrief[]) => void
}) {
  const [q, setQ] = useState('')
  const [includeTaken, setIncludeTaken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<WoCandRow[]>([])
  const [draft, setDraft] = useState<number[]>([])

  const knownMap = useMemo(
    () => new Map(knownWorkOrders.map((w) => [w.id, w])),
    [knownWorkOrders]
  )

  useEffect(() => {
    if (open) {
      setDraft([...initialSelectedIds])
      setQ('')
      setIncludeTaken(false)
    }
  }, [open, initialSelectedIds])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const params = new URLSearchParams()
          if (q.trim()) params.set('q', q.trim())
          if (maintenanceRecordId != null) params.set('recordId', String(maintenanceRecordId))
          if (includeTaken) params.set('includeTaken', '1')
          const res = await fetch(
            `/api/device-maintenance-records/work-order-candidates?${params.toString()}`
          )
          const json = await res.json()
          if (!cancelled && json.success) setRows(json.data.results as WoCandRow[])
        } catch {
          if (!cancelled) setRows([])
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, q, includeTaken, maintenanceRecordId])

  const draftSet = useMemo(() => new Set(draft), [draft])

  const toggleRow = (row: WoCandRow) => {
    if (!row.selectable) return
    setDraft((prev) => (prev.includes(row.id) ? prev.filter((x) => x !== row.id) : [...prev, row.id]))
  }

  const handleConfirm = () => {
    const selected: LinkedWorkOrderBrief[] = draft.map((id) => {
      const hit = rows.find((r) => r.id === id)
      if (hit) return { id: hit.id, code: hit.code, title: hit.title }
      const k = knownMap.get(id)
      if (k) return k
      return { id, code: `#${id}`, title: '工单' }
    })
    onConfirm(selected)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-600">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-600" />
              选择关联工单
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              每条工单仅能关联一条维保记录；已被占用的工单默认不出现在列表中。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索工单号、标题、类型"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTaken}
              onChange={(e) => setIncludeTaken(e.target.checked)}
              className="rounded border-slate-300"
            />
            显示已被其他维保记录占用的工单（仅可查看标识，不可勾选）
          </label>
        </div>

        <div className="flex-1 min-h-[200px] max-h-[min(420px,50vh)] overflow-y-auto border-b border-slate-200 dark:border-slate-700">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">无匹配工单，试试其他关键词或勾选上方选项</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="w-12 p-3 text-left font-medium text-slate-600 dark:text-slate-300">选</th>
                  <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">单号</th>
                  <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">标题</th>
                  <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">类型</th>
                  <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 dark:border-slate-700/80 ${
                      row.selectable ? 'hover:bg-slate-50/80 dark:hover:bg-slate-700/30' : 'opacity-70'
                    }`}
                  >
                    <td className="p-3 align-top">
                      <input
                        type="checkbox"
                        checked={draftSet.has(row.id)}
                        disabled={!row.selectable}
                        onChange={() => toggleRow(row)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="p-3 align-top font-mono text-xs">{row.code}</td>
                    <td className="p-3 align-top">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{row.title}</div>
                      {!row.selectable && row.linkedMaintenanceCode && (
                        <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                          已被维保记录 {row.linkedMaintenanceCode} 关联
                        </div>
                      )}
                    </td>
                    <td className="p-3 align-top text-slate-600 dark:text-slate-400">{row.type}</td>
                    <td className="p-3 align-top text-slate-600 dark:text-slate-400">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 flex justify-between items-center gap-2 shrink-0 bg-slate-50/80 dark:bg-slate-900/40">
          <span className="text-sm text-slate-600 dark:text-slate-400">已勾选 {draft.length} 条</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 大号设备多选弹层：搜索、楼宇筛选、当前结果全选/取消 */
function DevicePickerModal({
  open,
  deviceOptions,
  initialIds,
  onClose,
  onConfirm,
}: {
  open: boolean
  deviceOptions: DeviceOption[]
  initialIds: number[]
  onClose: () => void
  onConfirm: (ids: number[]) => void
}) {
  const [draft, setDraft] = useState<number[]>([])
  const [keyword, setKeyword] = useState('')
  const [buildingId, setBuildingId] = useState<string>('')

  useEffect(() => {
    if (open) {
      setDraft([...initialIds])
      setKeyword('')
      setBuildingId('')
    }
  }, [open, initialIds])

  const buildingChoices = useMemo(() => {
    const m = new Map<number, string>()
    for (const d of deviceOptions) {
      if (!m.has(d.buildingId)) m.set(d.buildingId, d.buildingName)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
  }, [deviceOptions])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const bid = buildingId === '' ? null : parseInt(buildingId, 10)
    return deviceOptions.filter((d) => {
      if (bid != null && !Number.isNaN(bid) && d.buildingId !== bid) return false
      if (!kw) return true
      return (
        d.code.toLowerCase().includes(kw) ||
        d.name.toLowerCase().includes(kw) ||
        d.type.toLowerCase().includes(kw) ||
        d.buildingName.toLowerCase().includes(kw)
      )
    })
  }, [deviceOptions, keyword, buildingId])

  const draftSet = useMemo(() => new Set(draft), [draft])

  const toggle = (id: number) => {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllFiltered = () => {
    const ids = filtered.map((d) => d.id)
    setDraft((prev) => Array.from(new Set([...prev, ...ids])))
  }

  const clearFilteredFromDraft = () => {
    const remove = new Set(filtered.map((d) => d.id))
    setDraft((prev) => prev.filter((id) => !remove.has(id)))
  }

  const filteredAllSelected =
    filtered.length > 0 && filtered.every((d) => draftSet.has(d.id))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-600">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">选择维保设备</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              支持搜索与按楼宇筛选；可多选。当前已勾选 {draft.length} 台
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索编号、名称、类型、楼宇"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="min-w-[180px] px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
          >
            <option value="">全部楼宇</option>
            {buildingChoices.map(([id, name]) => (
              <option key={id} value={String(id)}>
                {name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={selectAllFiltered}
              disabled={filtered.length === 0}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              全选当前列表
            </button>
            <button
              type="button"
              onClick={clearFilteredFromDraft}
              disabled={filtered.length === 0 || !filtered.some((d) => draftSet.has(d.id))}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"
            >
              取消当前列表已选
            </button>
            {filteredAllSelected && filtered.length > 0 && (
              <span className="text-xs text-green-600 dark:text-green-400">当前列表已全选</span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-[min(420px,50vh)] max-h-[min(560px,58vh)] overflow-y-auto border-b border-slate-200 dark:border-slate-700">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">没有符合条件的设备</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80 backdrop-blur z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="w-12 p-3 text-left font-medium text-slate-600 dark:text-slate-300">选</th>
                  <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">编号</th>
                  <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">名称</th>
                  <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">类型</th>
                  <th className="p-3 text-left font-medium text-slate-600 dark:text-slate-300">楼宇</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-slate-100 dark:border-slate-700/80 hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
                  >
                    <td className="p-3 align-top">
                      <input
                        type="checkbox"
                        checked={draftSet.has(d.id)}
                        onChange={() => toggle(d.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="p-3 align-top font-mono text-xs">{d.code}</td>
                    <td className="p-3 align-top font-medium text-slate-800 dark:text-slate-100">{d.name}</td>
                    <td className="p-3 align-top text-slate-600 dark:text-slate-400">{d.type}</td>
                    <td className="p-3 align-top text-slate-600 dark:text-slate-400">{d.buildingName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 flex justify-end gap-2 shrink-0 bg-slate-50/80 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(draft)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
          >
            确定（已选 {draft.length} 台）
          </button>
        </div>
      </div>
    </div>
  )
}

/** 查看已选设备列表（可单项移除） */
function SelectedDevicesDetailModal({
  open,
  deviceMap,
  selectedIds,
  onClose,
  onRemove,
}: {
  open: boolean
  deviceMap: Map<number, DeviceOption>
  selectedIds: number[]
  onClose: () => void
  onRemove: (id: number) => void
}) {
  if (!open) return null
  const rows = selectedIds.map((id) => deviceMap.get(id)).filter(Boolean) as DeviceOption[]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-blue-600" />
            已选设备（{selectedIds.length} 台）
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-slate-500 text-sm">暂无台账内设备（可能已从台账移除）</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {d.code} {d.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {d.type} · {d.buildingName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(d.id)}
                    className="shrink-0 p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="从已选列表移除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white dark:bg-slate-600 hover:opacity-90"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeviceMaintenanceForm({
  recordId,
  deviceOptions,
  maintainerOptions,
  onClose,
}: {
  recordId: number | null
  deviceOptions: DeviceOption[]
  maintainerOptions: MaintainerOption[]
  onClose: () => void
}) {
  const [type, setType] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [maintainerId, setMaintainerId] = useState<number | ''>('')
  const [cost, setCost] = useState('0')
  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [remark, setRemark] = useState('')
  const [deviceIds, setDeviceIds] = useState<number[]>([])
  const [orphans, setOrphans] = useState<OrphanPreview[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedDetailOpen, setSelectedDetailOpen] = useState(false)
  const [woPickerOpen, setWoPickerOpen] = useState(false)
  const [linkedWorkOrders, setLinkedWorkOrders] = useState<LinkedWorkOrderBrief[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const deviceMap = useMemo(() => deviceByIdsMap(deviceOptions), [deviceOptions])

  const isEdit = recordId != null

  useEffect(() => {
    if (!recordId) return
    let cancelled = false
    ;(async () => {
      setLoadingDetail(true)
      setError('')
      try {
        const res = await fetch(`/api/device-maintenance-records/${recordId}`)
        const json = await res.json()
        if (cancelled) return
        if (!json.success) {
          setError(json.message || '加载失败')
          return
        }
        const d = json.data
        setType(d.type)
        setDate(d.date)
        setMaintainerId(d.maintainerId ?? '')
        setCost(String(d.cost))
        setContent(d.content)
        setImageUrls(parseMaintenanceImageUrls(d.images))
        const lw = (d.linkedWorkOrders ?? []) as LinkedWorkOrderBrief[]
        setLinkedWorkOrders(
          lw.map((w) => ({ id: w.id, code: w.code, title: w.title ?? '' }))
        )
        setRemark(d.remark ?? '')
        const linked = (d.items as { deviceId: number | null }[])
          .filter((i) => i.deviceId != null)
          .map((i) => i.deviceId as number)
        setDeviceIds(linked)
        setOrphans(
          (d.items as { deviceId: number | null; deviceCode: string; deviceName: string }[])
            .filter((i) => i.deviceId === null)
            .map((i) => ({ deviceCode: i.deviceCode, deviceName: i.deviceName }))
        )
      } catch {
        if (!cancelled) setError('网络错误')
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [recordId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const mid = maintainerId === '' ? 0 : maintainerId
    if (!mid) {
      setError('请选择维保人员')
      return
    }
    const costNum = parseFloat(cost)
    if (Number.isNaN(costNum) || costNum < 0) {
      setError('费用须为非负数字')
      return
    }
    if (!type.trim()) {
      setError('请填写或选择维保类型')
      return
    }
    if (!content.trim()) {
      setError('请填写维保内容')
      return
    }
    if (!isEdit && deviceIds.length < 1) {
      setError('至少选择一台当前台账中的设备')
      return
    }
    if (isEdit && orphans.length + deviceIds.length < 1) {
      setError('至少保留一台设备（含已删除台账的设备）')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        type: type.trim(),
        date,
        maintainerId: mid,
        cost: costNum,
        content: content.trim(),
        remark: remark.trim() || null,
        images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        deviceIds,
        workOrderIds: linkedWorkOrders.map((w) => w.id),
      }
      const url = isEdit
        ? `/api/device-maintenance-records/${recordId}`
        : '/api/device-maintenance-records'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const openPicker = () => setPickerOpen(true)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold">{isEdit ? '编辑维保记录' : '新增维保记录'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingDetail && (
            <div className="text-sm text-slate-500 text-center py-8">加载记录中…</div>
          )}
          {!loadingDetail && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    维保类型 <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    可点选常用类型，或在输入框中直接填写其他描述（如「精细保养」）。
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {MAINTENANCE_TYPE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setType(preset)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          type === preset
                            ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-500'
                            : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    list={MAINTENANCE_TYPE_DATALIST_ID}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    placeholder="选择或输入维保类型，如：精细保养"
                    autoComplete="off"
                  />
                  <datalist id={MAINTENANCE_TYPE_DATALIST_ID}>
                    {MAINTENANCE_TYPE_PRESETS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    维保日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    维保人员 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={maintainerId === '' ? '' : String(maintainerId)}
                    onChange={(e) =>
                      setMaintainerId(e.target.value ? parseInt(e.target.value, 10) : '')
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="">请选择</option>
                    {maintainerOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.departmentName ? `（${m.departmentName}）` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    费用（元）
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  维保内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  placeholder="维保工作描述"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  维保图片<span className="text-slate-400 font-normal">（选填）</span>
                </label>
                <DeviceMaintenanceImageUpload
                  urls={imageUrls}
                  onChange={setImageUrls}
                  disabled={loadingDetail}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  关联工单<span className="text-slate-400 font-normal">（选填）</span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  可关联多条工单；每条工单仅能关联一条维保记录。已被其他维保占用的工单默认不会出现在可选列表中。
                </p>
                <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
                  {linkedWorkOrders.map((w) => (
                    <span
                      key={w.id}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/80 text-sm text-slate-800 dark:text-slate-100"
                    >
                      <span className="font-mono text-xs">{w.code}</span>
                      <span className="max-w-[180px] truncate">{w.title}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setLinkedWorkOrders((prev) => prev.filter((x) => x.id !== w.id))
                        }
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500"
                        aria-label="移除"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setWoPickerOpen(true)}
                  disabled={loadingDetail}
                  className="px-4 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/40 disabled:opacity-50"
                >
                  {linkedWorkOrders.length ? '调整关联工单' : '选择关联工单'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  备注
                </label>
                <input
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  维保设备（台账） {!isEdit && <span className="text-red-500">*</span>}
                </label>
                {orphans.length > 0 && (
                  <div className="mb-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200">
                    <p className="font-medium mb-1">以下设备已从台账删除，快照仍保留在本记录中：</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {orphans.map((o, i) => (
                        <li key={`${o.deviceCode}-${i}`}>
                          {o.deviceCode} {o.deviceName}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/20">
                  <button
                    type="button"
                    onClick={openPicker}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500"
                  >
                    选择设备
                  </button>
                  {deviceIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDetailOpen(true)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      已选 {deviceIds.length} 台，点击查看列表
                    </button>
                  ) : (
                    <span className="text-sm text-slate-500">已选 0 台</span>
                  )}
                  <span className="text-xs text-slate-400">
                    共 {deviceOptions.length} 台设备在台账中
                  </span>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting || loadingDetail}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {submitting ? '保存中…' : '保存'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      <DevicePickerModal
        open={pickerOpen}
        deviceOptions={deviceOptions}
        initialIds={deviceIds}
        onClose={() => setPickerOpen(false)}
        onConfirm={(ids) => {
          setDeviceIds(ids)
          setPickerOpen(false)
        }}
      />

      <SelectedDevicesDetailModal
        open={selectedDetailOpen}
        deviceMap={deviceMap}
        selectedIds={deviceIds}
        onClose={() => setSelectedDetailOpen(false)}
        onRemove={(id) => {
          setDeviceIds((prev) => prev.filter((x) => x !== id))
        }}
      />

      <WorkOrderPickerModal
        open={woPickerOpen}
        maintenanceRecordId={recordId}
        knownWorkOrders={linkedWorkOrders}
        initialSelectedIds={linkedWorkOrders.map((w) => w.id)}
        onClose={() => setWoPickerOpen(false)}
        onConfirm={setLinkedWorkOrders}
      />
    </div>
  )
}
