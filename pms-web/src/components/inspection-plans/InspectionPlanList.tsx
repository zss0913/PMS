'use client'

import { useState, useEffect, useMemo } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Search, Trash2 } from 'lucide-react'
import { InspectionPlanForm } from './InspectionPlanForm'

type InspectionPlan = {
  id: number
  name: string
  inspectionType: string
  cycleType: string
  cycleValue: number
  cycleWeekday?: number | null
  cycleMonthDay?: number | null
  cycleLabel: string
  requirePhoto?: boolean
  userIds: number[]
  checkItems: { name: string; nfcTagId?: number }[]
  inspectionPointIds?: number[]
  buildingId?: number | null
  status: string
  createdAt: string
}

type Employee = { id: number; name: string }

type Building = { id: number; name: string }

type ApiData = {
  list: InspectionPlan[]
  employees: Employee[]
  buildings: Building[]
  inspectionTypes: string[]
  cycleTypes: string[]
  cycleWeekdayOptions: { value: number; label: string }[]
}

export function InspectionPlanList() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<InspectionPlan | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [nameQuery, setNameQuery] = useState('')
  /** 空字符串表示全部类型 */
  const [typeFilter, setTypeFilter] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inspection-plans')
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      } else {
        setData(null)
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDelete = async (plan: InspectionPlan) => {
    if (!confirm(`确定删除巡检计划「${plan.name}」？`)) return
    setDeleting(plan.id)
    try {
      const res = await fetch(`/api/inspection-plans/${plan.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        loadData()
      } else {
        alert(json.message || '删除失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setDeleting(null)
    }
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingPlan(null)
    loadData()
  }

  const list = data?.list ?? []
  const employees = data?.employees ?? []
  const buildings = data?.buildings ?? []
  const cycleWeekdayOptions = data?.cycleWeekdayOptions ?? []
  const inspectionTypes = data?.inspectionTypes ?? ['工程', '安保', '设备', '绿化']

  const filteredList = useMemo(() => {
    const q = nameQuery.trim()
    return list.filter((p) => {
      const nameOk =
        !q ||
        p.name.includes(q) ||
        p.name.toLowerCase().includes(q.toLowerCase())
      const typeOk = !typeFilter || p.inspectionType === typeFilter
      return nameOk && typeOk
    })
  }, [list, nameQuery, typeFilter])

  const {
    page,
    pageSize,
    total,
    paginatedItems,
    handlePageChange,
    handlePageSizeChange,
    setPage,
  } = usePagination(filteredList, 15)
  const cycleTypes = data?.cycleTypes ?? ['每天', '每周', '每月']

  const buildingName = (id: number | null | undefined) =>
    !id ? '-' : buildings.find((b) => b.id === id)?.name ?? `#${id}`

  const getPersonnelNames = (userIds: number[]) => {
    if (!userIds.length || !data?.employees) return '-'
    return userIds
      .map((id) => data.employees.find((e) => e.id === id)?.name)
      .filter(Boolean)
      .join('、') || '-'
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={nameQuery}
              onChange={(e) => {
                setNameQuery(e.target.value)
                setPage(1)
              }}
              placeholder="按计划名称搜索"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm min-w-[140px]"
            aria-label="巡检类型筛选"
          >
            <option value="">全部类型</option>
            {inspectionTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="flex-1 min-w-[8px]" />
          <button
            onClick={() => {
              setEditingPlan(null)
              setFormOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            新建计划
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <th className="text-left p-4 font-medium">计划名称</th>
                <th className="text-left p-4 font-medium">楼宇</th>
                <th className="text-left p-4 font-medium">巡检类型</th>
                <th className="text-left p-4 font-medium">周期</th>
                <th className="text-left p-4 font-medium">须拍照</th>
                <th className="text-left p-4 font-medium">巡检人员</th>
                <th className="text-left p-4 font-medium">状态</th>
                <th className="text-left p-4 font-medium w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    {list.length === 0
                      ? '暂无巡检计划，点击「新建计划」添加'
                      : '无符合条件的计划，请调整名称搜索或巡检类型'}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="p-4 font-medium">{p.name}</td>
                    <td className="p-4">{buildingName(p.buildingId)}</td>
                    <td className="p-4">{p.inspectionType}</td>
                    <td className="p-4">{p.cycleLabel}</td>
                    <td className="p-4">{p.requirePhoto !== false ? '是' : '否'}</td>
                    <td className="p-4">{getPersonnelNames(p.userIds)}</td>
                    <td className="p-4">{p.status === 'active' ? '启用' : '停用'}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingPlan(p)
                            setFormOpen(true)
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                          title="编辑"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={deleting === p.id}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && list.length > 0 && (
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {formOpen && (
        <InspectionPlanForm
          plan={editingPlan}
          employees={employees}
          buildings={buildings}
          inspectionTypes={inspectionTypes}
          cycleTypes={cycleTypes}
          cycleWeekdayOptions={cycleWeekdayOptions}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
