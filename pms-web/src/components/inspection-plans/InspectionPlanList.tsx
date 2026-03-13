'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { InspectionPlanForm } from './InspectionPlanForm'

type InspectionPlan = {
  id: number
  name: string
  inspectionType: string
  cycleType: string
  cycleValue: number
  cycleLabel: string
  userIds: number[]
  checkItems: { name: string }[]
  status: string
  createdAt: string
}

type Employee = { id: number; name: string }

type ApiData = {
  list: InspectionPlan[]
  employees: Employee[]
  inspectionTypes: string[]
  cycleTypes: string[]
}

export function InspectionPlanList() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<InspectionPlan | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

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
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(list, 15)
  const inspectionTypes = data?.inspectionTypes ?? ['工程', '安保', '设备', '绿化']
  const cycleTypes = data?.cycleTypes ?? ['每天', '每周', '每月']

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
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
          <div className="flex-1" />
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
                <th className="text-left p-4 font-medium">巡检类型</th>
                <th className="text-left p-4 font-medium">周期</th>
                <th className="text-left p-4 font-medium">巡检人员</th>
                <th className="text-left p-4 font-medium">状态</th>
                <th className="text-left p-4 font-medium w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : (
                paginatedItems.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="p-4 font-medium">{p.name}</td>
                    <td className="p-4">{p.inspectionType}</td>
                    <td className="p-4">{p.cycleLabel}</td>
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
        {!loading && list.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            暂无巡检计划，点击「新建计划」添加
          </div>
        )}
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
          inspectionTypes={inspectionTypes}
          cycleTypes={cycleTypes}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
