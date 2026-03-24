'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import {
  displayWorkOrderSource,
  isTenantSubmittedWorkOrderSource,
  parseWorkOrderImageUrls,
} from '@/lib/work-order'
import type { WorkOrderActivityLogDTO } from '@/lib/work-order-activity-log-db'
import { WORK_ORDER_ACTION_LABELS } from '@/lib/work-order-activity-log'
import { WorkOrderLogDescriptionCell } from '@/components/work-orders/WorkOrderLogDescriptionCell'
import { WorkOrderFlowStepBar } from '@/components/work-orders/WorkOrderFlowStepBar'
import { EmployeeAssigneeSelect } from '@/components/work-orders/EmployeeAssigneeSelect'
import { AppLink } from '@/components/AppLink'

function hasContactPhone(phone: string | null | undefined): boolean {
  return Boolean(phone?.trim())
}

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
  /** 费用合计（元） */
  feeTotal: number | null
  feeConfirmedAt: string | null
  building: { id: number; name: string } | null
  room: { id: number; name: string; roomNumber: string } | null
  tenant: { id: number; companyName: string } | null
  reporter: { role: string; name: string; phone: string } | null
  assignedTo: number | null
  assignedEmployee: { id: number; name: string; phone: string } | null
  assignedAt: string | null
  respondedAt: string | null
  completedAt: string | null
  evaluatedAt: string | null
  completionImageUrls: string[]
  completionRemark: string | null
  evaluationNote: string | null
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
  const [feeTotalInput, setFeeTotalInput] = useState(
    workOrder.feeTotal != null && Number.isFinite(workOrder.feeTotal)
      ? String(workOrder.feeTotal)
      : ''
  )
  const [phoneDialog, setPhoneDialog] = useState<{
    title: string
    nameLine: string
    phone: string
  } | null>(null)
  const [completeModal, setCompleteModal] = useState(false)
  const [completePhotoUrls, setCompletePhotoUrls] = useState<string[]>([])
  const [completeRemarkInput, setCompleteRemarkInput] = useState('')
  const [completeUploading, setCompleteUploading] = useState(false)
  const [evalModal, setEvalModal] = useState(false)
  const [evalContentInput, setEvalContentInput] = useState('')

  const imageUrls = parseWorkOrderImageUrls(workOrder.images)
  const completionUrls = workOrder.completionImageUrls ?? []
  const tenantSubmitted = isTenantSubmittedWorkOrderSource(workOrder.source)
  const canEditBasics = !['评价完成', '已取消'].includes(workOrder.status)
  const canCancelOrder = ['待派单', '待响应'].includes(workOrder.status)
  const showAssignBlock = workOrder.status === '待派单' || workOrder.status === '待响应'

  useEffect(() => {
    setAssigningTo(workOrder.assignedTo)
  }, [workOrder.assignedTo, workOrder.id, workOrder.updatedAt])

  useEffect(() => {
    setFeeRemarkInput(workOrder.feeRemark ?? '')
    setFeeTotalInput(
      workOrder.feeTotal != null && Number.isFinite(workOrder.feeTotal)
        ? String(workOrder.feeTotal)
        : ''
    )
  }, [workOrder.feeRemark, workOrder.feeTotal, workOrder.id, workOrder.updatedAt])

  const callAdvance = async (
    action: string,
    extra?: {
      feeRemark?: string
      feeTotal?: number
      completionImages?: string[]
      completionRemark?: string
      evaluationContent?: string
    }
  ) => {
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
        setCompleteModal(false)
        setCompletePhotoUrls([])
        setCompleteRemarkInput('')
        setEvalModal(false)
        setEvalContentInput('')
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

  const uploadCompletionFile = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/work-orders/upload-image', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    })
    const json = (await res.json()) as { success?: boolean; data?: { url?: string }; message?: string }
    if (json.success && json.data?.url) return json.data.url
    throw new Error(json.message || '上传失败')
  }

  const onPickCompletionFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const arr = Array.from(files)
    if (completePhotoUrls.length + arr.length > 10) {
      alert('办结照片最多 10 张')
      return
    }
    setCompleteUploading(true)
    try {
      const next: string[] = [...completePhotoUrls]
      for (const f of arr) {
        const url = await uploadCompletionFile(f)
        next.push(url)
      }
      setCompletePhotoUrls(next)
    } catch (e) {
      alert(e instanceof Error ? e.message : '上传失败')
    } finally {
      setCompleteUploading(false)
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
          有费用：点「登记费用」填写金额与说明后进入待员工确认 → 送租客支付。无费用：弹窗内合计填 0 或留空后确认，或点「未产生任何费用」，均保持处理中、无需租客确认。
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
                  setFeeTotalInput(
                    workOrder.feeTotal != null && Number.isFinite(workOrder.feeTotal)
                      ? String(workOrder.feeTotal)
                      : ''
                  )
                  setFeeModal(true)
                }}
                className="px-4 py-2 border border-amber-500 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                登记费用
              </button>
              <button
                type="button"
                disabled={advancing}
                onClick={() => {
                  if (
                    confirm(
                      '确认本工单未产生任何费用？将记录为费用合计 0 元，无需租客确认与支付，可继续处理直至办结。'
                    )
                  ) {
                    void callAdvance('no_fee_continue')
                  }
                }}
                className="px-4 py-2 border border-slate-400 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/40"
              >
                未产生任何费用
              </button>
              <button
                type="button"
                disabled={advancing}
                onClick={() => {
                  setCompletePhotoUrls([])
                  setCompleteRemarkInput('')
                  setCompleteModal(true)
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
              >
                办结并进入待评价
              </button>
            </>
          )}
          {workOrder.status === '待员工确认费用' && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400 w-full mb-2">
                请核对费用合计与说明无误后，再送租客确认。
              </p>
              <button
                type="button"
                disabled={advancing}
                onClick={() => callAdvance('publish_fee_for_tenant')}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-50"
              >
                确认并送租客核对
              </button>
            </>
          )}
          {workOrder.status === '待租客确认费用' && (
            <p className="text-sm text-slate-600 dark:text-slate-400 w-full">
              等待租客在小程序确认费用后继续；确认后状态将回到「处理中」。若租客拒绝付费，工单将变为「已取消」。
            </p>
          )}
          {workOrder.status === '待评价' && tenantSubmitted && (
            <p className="text-sm text-slate-600 dark:text-slate-400 w-full">
              本单为租客报修，须由租客在租客端完成评价后才会进入「评价完成」，此处不可直接标记。
            </p>
          )}
          {workOrder.status === '待评价' && !tenantSubmitted && (
            <button
              type="button"
              disabled={advancing}
              onClick={() => {
                setEvalContentInput('')
                setEvalModal(true)
              }}
              className="px-4 py-2 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              标记评价完成
            </button>
          )}
          {canCancelOrder && (
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

        {showAssignBlock && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
              {workOrder.status === '待派单' ? '派单' : '改派'}
            </h3>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px] max-w-md">
                <label className="block text-sm font-medium mb-2 text-slate-600 dark:text-slate-300">
                  选择处理人
                </label>
                <EmployeeAssigneeSelect
                  employees={employees}
                  value={assigningTo}
                  onChange={setAssigningTo}
                  disabled={assigning}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleAssign()}
                disabled={!assigningTo || assigning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
              >
                {assigning ? '提交中...' : workOrder.status === '待派单' ? '确认派单' : '确认改派'}
              </button>
            </div>
          </div>
        )}

        {canEditBasics && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600">
            <AppLink
              href={`/work-orders/${workOrder.id}/edit`}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              编辑工单（标题、描述与图片）
            </AppLink>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xl">
              进入独立编辑页，仅可修改与「新建工单」中相同的可编辑项；楼宇、类型、房源等创建后不可改。
            </p>
          </div>
        )}
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
            <dd>
              {workOrder.tenant?.companyName?.trim()
                ? workOrder.tenant.companyName
                : '-'}
            </dd>
          </div>
          {workOrder.location && (
            <div className="md:col-span-2">
              <dt className="text-sm text-slate-500">位置说明</dt>
              <dd>{workOrder.location}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-slate-500">提交人</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span>
                {workOrder.reporter
                  ? `${workOrder.reporter.name}（${workOrder.reporter.role}）`
                  : '-'}
              </span>
              {workOrder.reporter && hasContactPhone(workOrder.reporter.phone) && (
                <button
                  type="button"
                  onClick={() =>
                    setPhoneDialog({
                      title: '提交人电话',
                      nameLine: `${workOrder.reporter!.name}（${workOrder.reporter!.role}）`,
                      phone: workOrder.reporter!.phone.trim(),
                    })
                  }
                  className="inline-flex items-center rounded-full border border-sky-500/50 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
                >
                  查看电话
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">处理人</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span>{workOrder.assignedEmployee?.name ?? '-'}</span>
              {workOrder.assignedEmployee && hasContactPhone(workOrder.assignedEmployee.phone) && (
                <button
                  type="button"
                  onClick={() =>
                    setPhoneDialog({
                      title: '处理人电话',
                      nameLine: workOrder.assignedEmployee!.name,
                      phone: workOrder.assignedEmployee!.phone.trim(),
                    })
                  }
                  className="inline-flex items-center rounded-full border border-sky-500/50 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
                >
                  查看电话
                </button>
              )}
            </dd>
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
        {(workOrder.feeRemark ||
          (workOrder.feeTotal != null && Number.isFinite(workOrder.feeTotal))) && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            {workOrder.feeTotal != null && Number.isFinite(workOrder.feeTotal) && (
              <>
                <dt className="text-sm font-medium text-amber-900 dark:text-amber-200">费用合计</dt>
                <dd className="text-sm mt-1 font-semibold text-amber-950 dark:text-amber-50">
                  {Number(workOrder.feeTotal).toFixed(2)} 元
                </dd>
              </>
            )}
            {workOrder.feeRemark && (
              <>
                <dt className="text-sm font-medium text-amber-900 dark:text-amber-200 mt-2">费用说明</dt>
                <dd className="text-sm mt-1 text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                  {workOrder.feeRemark}
                </dd>
              </>
            )}
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
        {completionUrls.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <dt className="text-sm font-medium text-emerald-900 dark:text-emerald-200">办结现场照片</dt>
            <div className="flex flex-wrap gap-2 mt-2">
              {completionUrls.map((u) => (
                <a
                  key={u}
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-24 h-24 rounded-lg border border-emerald-200 dark:border-emerald-700 overflow-hidden shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
            {workOrder.completionRemark?.trim() && (
              <p className="text-sm mt-2 text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap">
                办结说明：{workOrder.completionRemark}
              </p>
            )}
          </div>
        )}
        {workOrder.evaluationNote?.trim() && (
          <div className="mt-4 p-3 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600">
            <dt className="text-sm font-medium text-slate-700 dark:text-slate-200">评价说明</dt>
            <dd className="text-sm mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-100">
              {workOrder.evaluationNote}
            </dd>
          </div>
        )}
      </div>

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

      {phoneDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setPhoneDialog(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-dialog-title"
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="phone-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {phoneDialog.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{phoneDialog.nameLine}</p>
            <p className="mt-4 select-all font-mono text-lg font-medium tracking-wide text-slate-900 dark:text-slate-100">
              {phoneDialog.phone}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              号码仅在您主动查看时显示，关闭弹窗后详情页不再展示号码。
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setPhoneDialog(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {completeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2">办结并进入待评价</h3>
            <p className="text-sm text-slate-500 mb-4">
              须上传至少 1 张、最多 10 张现场照片（jpg / jpeg / png）。办结说明选填。
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {completePhotoUrls.map((u) => (
                <div key={u} className="relative w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover rounded-lg border" />
                  <button
                    type="button"
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs"
                    onClick={() => setCompletePhotoUrls((prev) => prev.filter((x) => x !== u))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-block mb-3">
              <span className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm cursor-pointer inline-block">
                {completeUploading ? '上传中…' : '选择照片'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                disabled={completeUploading || completePhotoUrls.length >= 10}
                onChange={(e) => {
                  void onPickCompletionFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              办结说明（选填）
            </label>
            <textarea
              value={completeRemarkInput}
              onChange={(e) => setCompleteRemarkInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm mb-4"
              rows={3}
              maxLength={2000}
              placeholder="可填写处理结果摘要等"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCompleteModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                disabled={advancing || completeUploading || completePhotoUrls.length < 1}
                onClick={() => {
                  if (completePhotoUrls.length < 1) {
                    alert('请至少上传 1 张办结现场照片')
                    return
                  }
                  void callAdvance('complete_for_evaluation', {
                    completionImages: completePhotoUrls,
                    completionRemark: completeRemarkInput.trim() || undefined,
                  })
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
              >
                确认办结
              </button>
            </div>
          </div>
        </div>
      )}

      {evalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">标记评价完成</h3>
            <p className="text-sm text-slate-500 mb-3">评价内容选填，可不填直接确认。</p>
            <textarea
              value={evalContentInput}
              onChange={(e) => setEvalContentInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm mb-4"
              rows={4}
              maxLength={2000}
              placeholder="选填：服务评价或备注"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEvalModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                disabled={advancing}
                onClick={() =>
                  void callAdvance('mark_evaluated', {
                    evaluationContent: evalContentInput.trim() || undefined,
                  })
                }
                className="px-4 py-2 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-lg disabled:opacity-50"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {feeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-2">提交费用</h3>
            <p className="text-sm text-slate-500 mb-4">
              有费用：填写合计（大于 0）与说明，进入待员工确认后送租客核对与支付。无费用：合计填 0 或留空，无需说明，保持处理中且无需租客确认。
            </p>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              费用合计（元）
            </label>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={feeTotalInput}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, '')
                const p = v.split('.')
                const t =
                  p.length <= 1
                    ? p[0] ?? ''
                    : `${p[0]}.${p.slice(1).join('').slice(0, 2)}`
                setFeeTotalInput(t)
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm mb-3"
              placeholder="无费用填 0 或留空；有费用须大于 0"
            />
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              费用说明（有费用时必填）
            </label>
            <textarea
              value={feeRemarkInput}
              onChange={(e) => setFeeRemarkInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm mb-4"
              rows={4}
              placeholder="无费用可不填；有费用请说明预估或计价方式"
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
                onClick={() => {
                  const raw = feeTotalInput.trim().replace(/,/g, '')
                  const y = raw === '' ? 0 : parseFloat(raw)
                  if (!Number.isFinite(y) || y < 0) {
                    alert('费用合计须为有效数字')
                    return
                  }
                  const yuan = Math.round(y * 100) / 100
                  if (yuan === 0) {
                    void callAdvance('no_fee_continue')
                    return
                  }
                  const t = feeRemarkInput.trim()
                  if (!t) {
                    alert('产生费用时请填写费用说明')
                    return
                  }
                  void callAdvance('request_fee_confirmation', { feeRemark: t, feeTotal: yuan })
                }}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-50"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
