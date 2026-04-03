import type { PrismaClient } from '@prisma/client'
import { isPendingStatus, isProcessingStatus, normalizeComplaintStatus } from '@/lib/complaint-status'

export type ComplaintStaffActionBody = {
  status?: string
  assignedTo?: number
  result?: string
  resultImages?: string[]
}

export type ComplaintActionResult =
  | { ok: true }
  | { ok: false; message: string; status?: number }

/**
 * 物业员工更新吐槽：待处理 → 处理中（须指派 assignedTo）；处理中 → 已处理（须填写 result，仅被指派人可操作）。
 */
export async function applyComplaintStaffAction(
  prisma: PrismaClient,
  args: {
    complaintId: number
    companyId: number
    actorEmployeeId: number
    body: ComplaintStaffActionBody
  }
): Promise<ComplaintActionResult> {
  const { complaintId, companyId, actorEmployeeId, body } = args

  const existing = await prisma.complaint.findFirst({
    where: { id: complaintId, companyId },
  })
  if (!existing) {
    return { ok: false, message: '记录不存在', status: 404 }
  }

  const cur = normalizeComplaintStatus(existing.status)

  if (body.status === undefined && body.result === undefined && body.assignedTo === undefined) {
    return { ok: false, message: '无有效更新内容' }
  }

  const next = body.status !== undefined ? normalizeComplaintStatus(body.status) : cur

  if (body.status !== undefined && next === cur && body.result === undefined) {
    return { ok: false, message: '状态未变化' }
  }

  // 待处理 → 处理中
  if (next === '处理中') {
    if (!isPendingStatus(existing.status)) {
      return { ok: false, message: '仅「待处理」可受理为处理中' }
    }
    const aid = body.assignedTo
    if (aid == null || aid < 1) {
      return { ok: false, message: '受理为处理中时必须指派处理人' }
    }
    const emp = await prisma.employee.findFirst({
      where: { id: aid, companyId, status: 'active' },
    })
    if (!emp) {
      return { ok: false, message: '处理人不存在或已停用' }
    }
    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: '处理中',
        assignedTo: aid,
      },
    })
    return { ok: true }
  }

  // 处理中 → 已处理
  if (next === '已处理') {
    if (!isProcessingStatus(existing.status)) {
      return { ok: false, message: '仅「处理中」可办结为已处理' }
    }
    if (existing.assignedTo == null) {
      return { ok: false, message: '未指派处理人，无法办结' }
    }
    if (existing.assignedTo !== actorEmployeeId) {
      return { ok: false, message: '仅被指派的处理人可办结' }
    }
    const resText = (body.result ?? '').trim()
    if (!resText) {
      return { ok: false, message: '请填写处理结果说明' }
    }
    const imgs =
      body.resultImages && body.resultImages.length > 0
        ? JSON.stringify(body.resultImages)
        : null
    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: '已处理',
        result: resText,
        resultImages: imgs,
        handledBy: actorEmployeeId,
        handledAt: new Date(),
      },
    })
    return { ok: true }
  }

  if (body.result !== undefined && body.status === undefined) {
    return { ok: false, message: '请通过「已处理」状态提交处理结果' }
  }

  return { ok: false, message: '不支持的状态变更' }
}

export function serializeComplaintImages(json: string | null | undefined): string[] {
  if (!json?.trim()) return []
  try {
    const arr = JSON.parse(json) as unknown
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
