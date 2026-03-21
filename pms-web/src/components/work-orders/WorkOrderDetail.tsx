'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { displayWorkOrderSource, parseWorkOrderImageUrls } from '@/lib/work-order'
import { WorkOrderImageUpload } from '@/components/work-orders/WorkOrderImageUpload'
import type { WorkOrderActivityLogDTO } from '@/lib/work-order-activity-log-db'
import { WORK_ORDER_ACTION_LABELS } from '@/lib/work-order-activity-log'
import { WorkOrderLogDescriptionCell } from '@/components/work-orders/WorkOrderLogDescriptionCell'
import { WorkOrderFlowStepBar } from '@/components/work-orders/WorkOrderFlowStepBar'
import { EmployeeAssigneeSelect } from '@/components/work-orders/EmployeeAssigneeSelect'

type WorkOrder = {
  id: number
  code: string
  title: string
  type: string
  source: string
  description: string
  images: string | null
  location: string | null
  status: string
  facilityScope: string | null
  feeNoticeAcknowledged: boolean
  feeRemark: string | null
  feeConfirmedAt: string | null
  building: { id: number; name: string } | null
  room: { id: number; name: string; roomNumber: string } | null
  tenant: { id: number; companyName: string } | null
  assignedTo: number | null
  assignedEmployee: { id: number; name: string } | null
  assignedAt: string | null
  respondedAt: string | null
  completedAt: string | null
  evaluatedAt: string | null
  createdAt: string
  updatedAt: string
}

export function WorkOrderDetail({
  workOrder,
  employees,
  activityLogs,
}: {
  workOrder: WorkOrder
  employees: { id: number; name: string; phone: string }[]
  activityLogs: WorkOrderActivityLogDTO[]
}) {
  const router = useRouter()
  const [assigningTo, setAssigningTo] = useState<number | null>(workOrder.assignedTo)
  const [assigning, setAssigning] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [feeModal, setFeeModal] = useState(false)
  const [feeRemarkInput, setFeeRemarkInput] = useState(workOrder.feeRemark ?? '')
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(workOrder.title)
  const [editDescription, setEditDescription] = useState(workOrder.description)
  const [editImageUrls, setEditImageUrls] = useState<string[]>(() =>
    parseWorkOrderImageUrls(workOrder.images)
  )
  const [savingEdit, setSavingEdit] = useState(false)

  const imageUrls = parseWorkOrderImageUrls(workOrder.images)
  const canEditBasics = !['评价完成', '已取消'].includes(workOrder.status)

  useEffect(() => {
    if (!editing) {
      setEditTitle(workOrder.title)
      setEditDescription(workOrder.description)
      setEditImageUrls(parseWorkOrderImageUrls(workOrder.images))
    }
  }, [
    editing,
    workOrder.id,
    workOrder.updatedAt,
    workOrder.title,
    workOrder.description,
    workOrder.images,
  ])

  const cancelEdit = () => {
    setEditTitle(workOrder.title)
    setEditDescription(workOrder.description)
    setEditImageUrls(parseWorkOrderImageUrls(workOrder.images))
    setEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      alert('标题不能为空')
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          images: editImageUrls.length > 0 ? JSON.stringify(editImageUrls) : null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setEditing(false)
        router.refresh()
      } else {
        alert(json.message || '保存失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSavingEdit(false)
    }
  }

  const callAdvance = async (action: string, extra?: { feeRemark?: string }) => {
    setAdvancing(true)
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...extra }),
      })
      const json = await res.json()
      if (json.success) {
        setFeeModal(false)
        router.refresh()
      } else {
        alert(json.message || '操作失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setAdvancing(false)
    }
  }

  const handleAssign = async () => {
    if (!assigningTo) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/work-orders/${workOrder.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        <h2 className="text-lg font-semibold mb-3">流程进度</h2>
        <WorkOrderFlowStepBar status={workOrder.status} />
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 mb-4">
          不涉及费用的工单请勿使用「提交费用待确认」；租客需在小程序对「待确认费用」工单进行确认后方可继续处理。
        </p>
        <div className="flex flex-wrap gap-2">
          {workOrder.status === '待响应' && (
            <button
              type="button"
              disabled={advancing}
              onClick={() => callAdvance('start_processing')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              开始处理（进入处理中）
            </button>
          )}
          {workOrder.status === '处理中' && (
            <>
              <button
                type="button"
                disabled={advancing}
                onClick={() => {
                  setFeeRemarkInput(workOrder.feeRemark ?? '')
                  setFeeModal(true)
                }}
                className="px-4 py-2 border border-amber-500 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                提交费用待确认
              </button>
              <button
                type="button"
                disabled={advancing}
                onClick={() => callAdvance('complete_for_evaluation')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
              >
                办结并进入待评价
              </button>
            </>
          )}
          {workOrder.status === '待确认费用' && (
            <p className="text-sm text-slate-600 dark:text-slate-400 w-full">
              等待租客在小程序确认费用后继续；确认后状态将回到「处理中」。
            </p>
          )}
          {workOrder.status === '待评价' && (
            <button
              type="button"
              disabled={advancing}
              onClick={() => callAdvance('mark_evaluated')}
              className="px-4 py-2 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              标记评价完成
            </button>
          )}
          {['待派单', '待响应', '处理中'].includes(workOrder.status) && (
            <button
              type="button"
              disabled={advancing}
              onClick={() => {
                if (confirm('确定取消该工单？')) callAdvance('cancel')
              }}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              取消工单
            </button>
          )}
        </div>
      </div>

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
            <dd>{displayWorkOrderSource(workOrder.source)}</dd>
          </div>
          {workOrder.facilityScope && (
            <div>
              <dt className="text-sm text-slate-500">设施范围（租客端）</dt>
              <dd>{workOrder.facilityScope}</dd>
            </div>
          )}
          {workOrder.feeNoticeAcknowledged && (
            <div>
              <dt className="text-sm text-slate-500">费用知情确认</dt>
              <dd>租客已确认套内可能产生费用</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-slate-500">状态</dt>
            <dd className="font-medium">{workOrder.status}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">楼宇</dt>
            <dd>{workOrder.building?.name ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">房源</dt>
            <dd>
              {workOrder.room ? `${workOrder.room.roomNumber} · ${workOrder.room.name}` : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">租客</dt>
            <dd>{workOrder.tenant?.companyName ?? '-'}</dd>
          </div>
          {workOrder.location && (
            <div className="md:col-span-2">
              <dt className="text-sm text-slate-500">位置说明</dt>
              <dd>{workOrder.location}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-slate-500">处理人</dt>
            <dd>{workOrder.assignedEmployee?.name ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">派单时间</dt>
            <dd>{workOrder.assignedAt ? formatDateTime(workOrder.assignedAt) : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">响应时间</dt>
            <dd>{workOrder.respondedAt ? formatDateTime(workOrder.respondedAt) : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">完成处理时间</dt>
            <dd>{workOrder.completedAt ? formatDateTime(workOrder.completedAt) : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">评价完成时间</dt>
            <dd>{workOrder.evaluatedAt ? formatDateTime(workOrder.evaluatedAt) : '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">创建时间</dt>
            <dd>{formatDateTime(workOrder.createdAt)}</dd>
          </div>
        </dl>
        {workOrder.feeRemark && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <dt className="text-sm font-medium text-amber-900 dark:text-amber-200">费用说明</dt>
            <dd className="text-sm mt-1 text-amber-900 dark:text-amber-100">{workOrder.feeRemark}</dd>
            {workOrder.feeConfirmedAt && (
              <p className="text-xs mt-2 text-amber-800 dark:text-amber-300">
                租客已于 {formatDateTime(workOrder.feeConfirmedAt)} 确认并同意继续处理
              </p>
            )}
          </div>
        )}
        <div className="mt-4">
          <dt className="text-sm text-slate-500 mb-1">描述</dt>
          <dd className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {workOrder.description || '—'}
          </dd>
        </div>
        {imageUrls.length > 0 && (
          <div className="mt-4">
            <dt className="text-sm text-slate-500 mb-2">图片</dt>
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((u) => (
                <a
                  key={u}
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-24 h-24 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {canEditBasics && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">编辑工单</h2>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                编辑标题、描述与图片
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  disabled={savingEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingEdit ? '保存中…' : '保存'}
                </button>
              </div>
            )}
          </div>
          {editing ? (
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className="block text-sm font-medium mb-1">标题 *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">图片（选填）</label>
                <WorkOrderImageUpload urls={editImageUrls} onChange={setEditImageUrls} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              在工单未结束（非「评价完成」「已取消」）前，可修改标题、描述与附件图片。
            </p>
          )}
        </div>
      )}

      {(workOrder.status === '待派单' || workOrder.status === '待响应') && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4">
            {workOrder.status === '待派单' ? '派单' : '改派'}
          </h2>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] max-w-md">
              <label className="block text-sm font-medium mb-2">选择处理人</label>
              <EmployeeAssigneeSelect
                employees={employees}
                value={assigningTo}
                onChange={setAssigningTo}
                disabled={assigning}
              />
            </div>
            <button
              onClick={handleAssign}
              disabled={!assigningTo || assigning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {assigning ? '提交中...' : workOrder.status === '待派单' ? '确认派单' : '确认改派'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">操作日志</h2>
        {activityLogs.length === 0 ? (
          <p className="text-sm text-slate-500">
            暂无操作记录（新功能上线后的操作将从此处记录）
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 text-left">
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">时间</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">操作类型</th>
                  <th className="pb-2 pr-3 font-medium">操作人</th>
                  <th className="pb-2 pr-3 font-medium">账号</th>
                  <th className="pb-2 font-medium min-w-[200px]">说明 / 变更</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 dark:border-slate-700/80 align-top"
                  >
                    <td className="py-3 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {WORK_ORDER_ACTION_LABELS[log.action] ?? log.action}
                    </td>
                    <td className="py-3 pr-3">{log.operatorName ?? '-'}</td>
                    <td className="py-3 pr-3 font-mono text-xs">{log.operatorPhone ?? '-'}</td>
                    <td className="py-3">
                      <WorkOrderLogDescriptionCell log={log} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {feeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">提交费用待确认</h3>
            <p className="text-sm text-slate-500 mb-4">
              工单将进入「待确认费用」，租客需在小程序确认后方可继续。请填写费用说明（预估、计价方式等）。
            </p>
            <textarea
              value={feeRemarkInput}
              onChange={(e) => setFeeRemarkInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm mb-4"
              rows={4}
              placeholder="费用说明（选填）"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFeeModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300"
              >
                关闭
              </button>
              <button
                type="button"
                disabled={advancing}
                onClick={() =>
                  callAdvance('request_fee_confirmation', { feeRemark: feeRemarkInput })
                }
                className="px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-50"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
