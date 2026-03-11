'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'

type WorkOrder = {
  id: number
  code: string
  title: string
  type: string
  source: string
  description: string
  status: string
  building: { id: number; name: string } | null
  room: { id: number; name: string; roomNumber: string } | null
  tenant: { id: number; companyName: string } | null
  assignedTo: number | null
  assignedEmployee: { id: number; name: string } | null
  assignedAt: string | null
  createdAt: string
  updatedAt: string
}

export function WorkOrderDetail({
  workOrder,
  employees,
}: {
  workOrder: WorkOrder
  employees: { id: number; name: string }[]
}) {
  const router = useRouter()
  const [assigningTo, setAssigningTo] = useState<number | null>(workOrder.assignedTo)
  const [assigning, setAssigning] = useState(false)

  const handleAssign = async () => {
    if (!assigningTo) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: assigningTo }),
      })
      const json = await res.json()
      if (json.success) {
        router.refresh()
      } else {
        alert(json.message || '派单失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">基本信息</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-slate-500">工单编号</dt>
            <dd className="font-medium">{workOrder.code}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">标题</dt>
            <dd className="font-medium">{workOrder.title}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">类型</dt>
            <dd>{workOrder.type}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">来源</dt>
            <dd>{workOrder.source}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">状态</dt>
            <dd>{workOrder.status}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">楼宇</dt>
            <dd>{workOrder.building?.name ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">房源</dt>
            <dd>{workOrder.room?.roomNumber ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">租客</dt>
            <dd>{workOrder.tenant?.companyName ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">处理人</dt>
            <dd>{workOrder.assignedEmployee?.name ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">派单时间</dt>
            <dd>{workOrder.assignedAt ? formatDateTime(workOrder.assignedAt) : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">创建时间</dt>
            <dd>{formatDateTime(workOrder.createdAt)}</dd>
          </div>
        </dl>
        {workOrder.description && (
          <div className="mt-4">
            <dt className="text-sm text-slate-500 mb-1">描述</dt>
            <dd className="text-slate-700 dark:text-slate-300">{workOrder.description}</dd>
          </div>
        )}
      </div>

      {workOrder.status === '待派单' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4">派单</h2>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
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
            <button
              onClick={handleAssign}
              disabled={!assigningTo || assigning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {assigning ? '派单中...' : '确认派单'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
