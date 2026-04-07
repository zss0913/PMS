import type { Complaint } from '@prisma/client'
import { normalizeComplaintStatus } from '@/lib/complaint-status'

export type ComplaintTimelineItem = {
  id: number | null
  action: string
  summary: string
  operatorType: string
  operatorName: string | null
  operatorId: number | null
  createdAt: string
  /** 历史记录在补录日志前由系统推断 */
  synthetic?: boolean
}

type Names = {
  reporterName: string
  reporterPhone?: string
  assigneeName: string | null
  handlerName: string | null
}

/** 无 ComplaintActivityLog 旧数据时，根据当前字段推断时间线（仅作参考） */
export function buildComplaintFallbackTimeline(
  c: Complaint,
  names: Names
): ComplaintTimelineItem[] {
  const st = normalizeComplaintStatus(c.status)
  const items: ComplaintTimelineItem[] = [
    {
      id: null,
      action: '提交',
      summary: `租客用户「${names.reporterName}」提交卫生吐槽（以下为系统根据当前数据推断，精确日志自功能上线后记录）`,
      operatorType: 'tenant',
      operatorId: c.reporterId,
      operatorName: names.reporterName,
      createdAt: c.createdAt.toISOString(),
      synthetic: true,
    },
  ]

  if (st === '待处理') {
    return items
  }

  if (c.assignedTo && names.assigneeName) {
    items.push({
      id: null,
      action: '受理',
      summary: `已进入「处理中」，指派处理人「${names.assigneeName}」（时间取记录更新时间，仅供参考）`,
      operatorType: 'employee',
      operatorId: c.assignedTo,
      operatorName: names.assigneeName,
      createdAt: c.updatedAt.toISOString(),
      synthetic: true,
    })
  }

  if (st === '已处理' && c.handledAt) {
    const res = (c.result ?? '').trim()
    items.push({
      id: null,
      action: '办结',
      summary: res
        ? `处理人「${names.handlerName ?? '?'}」办结。说明：${res.length > 400 ? `${res.slice(0, 400)}…` : res}`
        : `处理人「${names.handlerName ?? '?'}」办结为「已处理」`,
      operatorType: 'employee',
      operatorId: c.handledBy,
      operatorName: names.handlerName,
      createdAt: c.handledAt.toISOString(),
      synthetic: true,
    })
  }

  return items
}
