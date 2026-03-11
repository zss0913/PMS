'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Eye, UserPlus } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

type WorkOrder = {
  id: number
  code: string
  title: string
  type: string
  building: { id: number; name: string } | null
  room: { id: number; name: string; roomNumber: string } | null
  tenant: { id: number; companyName: string } | null
  status: string
  assignedTo: number | null
  assignedEmployee: { id: number; name: string } | null
  createdAt: string
}

type ApiData = {
  list: WorkOrder[]
  buildings: { id: number; name: string }[]
  employees: { id: number; name: string }[]
  workOrderTypes: { id: number; name: string }[]
  statusOptions: string[]
}

export function WorkOrderList() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [assignModal, setAssignModal] = useState<WorkOrder | null>(null)
  const [assigningTo, setAssigningTo] = useState<number | null>(null)
  const [assigning, setAssigning] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/work-orders?${params}`)
      const json = await res.json()
      if (json.success) {
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
  }, [statusFilter])

  const handleAssign = async () => {
    if (!assignModal || !assigningTo) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/work-orders/${assignModal.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: assigningTo }),
      })
      const json = await res.json()
      if (json.success) {
        setAssignModal(null)
        setAssigningTo(null)
        loadData()
      } else {
        alert(json.message || '派单失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setAssigning(false)
    }
  }

  const list = data?.list ?? []
  const employees = data?.employees ?? []
  const statusOptions = data?.statusOptions ?? []

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value="">全部状态</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Link
            href="/work-orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            新建工单
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <th className="text-left p-4 font-medium">工单编号</th>
                <th className="text-left p-4 font-medium">标题</th>
                <th className="text-left p-4 font-medium">类型</th>
                <th className="text-left p-4 font-medium">楼宇</th>
                <th className="text-left p-4 font-medium">房源</th>
                <th className="text-left p-4 font-medium">租客</th>
                <th className="text-left p-4 font-medium">状态</th>
                <th className="text-left p-4 font-medium">处理人</th>
                <th className="text-left p-4 font-medium">创建时间</th>
                <th className="text-left p-4 font-medium w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-500">
                    加载中...
                  </td>
                </tr>
              ) : (
                list.map((wo) => (
                  <tr
                    key={wo.id}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="p-4">
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {wo.code}
                      </Link>
                    </td>
                    <td className="p-4">{wo.title}</td>
                    <td className="p-4">{wo.type}</td>
                    <td className="p-4">{wo.building?.name ?? '-'}</td>
                    <td className="p-4">{wo.room?.roomNumber ?? '-'}</td>
                    <td className="p-4">{wo.tenant?.companyName ?? '-'}</td>
                    <td className="p-4">{wo.status}</td>
                    <td className="p-4">{wo.assignedEmployee?.name ?? '-'}</td>
                    <td className="p-4">{formatDateTime(wo.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Link
                          href={`/work-orders/${wo.id}`}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {wo.status === '待派单' && (
                          <button
                            onClick={() => {
                              setAssignModal(wo)
                              setAssigningTo(null)
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded"
                            title="派单"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        )}
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
            暂无工单，点击「新建工单」添加
          </div>
        )}
      </div>

      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">派单 - {assignModal.code}</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{assignModal.title}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">选择处理人</label>
              <select
                value={assigningTo ?? ''}
                onChange={(e) => setAssigningTo(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value="">请选择</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setAssignModal(null)
                  setAssigningTo(null)
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={handleAssign}
                disabled={!assigningTo || assigning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {assigning ? '派单中...' : '确认派单'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
