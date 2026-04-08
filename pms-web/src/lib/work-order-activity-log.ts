import type { Prisma, PrismaClient } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { parseWorkOrderImageUrls } from '@/lib/work-order'
import { insertWorkOrderActivityLog } from '@/lib/work-order-activity-log-db'

type Db = PrismaClient | Prisma.TransactionClient

/** 与写入库 action 字段一致 */
export const WORK_ORDER_ACTION = {
  CREATE: 'create',
  UPDATE: 'update',
  ASSIGN: 'assign',
  CANCEL: 'cancel',
  START_PROCESSING: 'start_processing',
  REQUEST_FEE_CONFIRMATION: 'request_fee_confirmation',
  /** 处理中：员工确认无费用，不进入租客确认/支付，继续维修 */
  NO_FEE_CONTINUE: 'no_fee_continue',
  /** 员工确认后送租客核对费用 */
  PUBLISH_FEE_FOR_TENANT: 'publish_fee_for_tenant',
  /** 费用合计为 0 元，不进入租客支付，直接回到处理中 */
  FEE_ZERO_SKIP_TENANT: 'fee_zero_skip_tenant',
  /** 有费用但无需租客支付：不产生账单，直接进入待处理 */
  FEE_CONFIRM_INTERNAL_PENDING: 'fee_confirm_internal_pending',
  FEE_CONFIRM_TENANT: 'fee_confirm_tenant',
  /** 租客拒绝付费，工单取消 */
  FEE_REFUSE_TENANT: 'fee_refuse_tenant',
  /** 待处理：员工退费冲账并取消工单 */
  REFUND_FEE_CANCEL: 'refund_fee_cancel',
  COMPLETE_FOR_EVALUATION: 'complete_for_evaluation',
  MARK_EVALUATED: 'mark_evaluated',
  /** 租客在待评价节点提交评价并完结 */
  TENANT_SUBMIT_EVALUATION: 'tenant_submit_evaluation',
} as const

export const WORK_ORDER_ACTION_LABELS: Record<string, string> = {
  [WORK_ORDER_ACTION.CREATE]: '创建',
  [WORK_ORDER_ACTION.UPDATE]: '编辑',
  [WORK_ORDER_ACTION.ASSIGN]: '派单',
  [WORK_ORDER_ACTION.CANCEL]: '取消',
  [WORK_ORDER_ACTION.START_PROCESSING]: '开始处理',
  [WORK_ORDER_ACTION.REQUEST_FEE_CONFIRMATION]: '提交费用（待员工确认）',
  [WORK_ORDER_ACTION.NO_FEE_CONTINUE]: '未产生任何费用（继续处理）',
  [WORK_ORDER_ACTION.PUBLISH_FEE_FOR_TENANT]: '送租客确认费用',
  [WORK_ORDER_ACTION.FEE_ZERO_SKIP_TENANT]: '零元费用跳过租客确认',
  [WORK_ORDER_ACTION.FEE_CONFIRM_INTERNAL_PENDING]: '费用内部确认（入待处理）',
  [WORK_ORDER_ACTION.FEE_CONFIRM_TENANT]: '确认费用并在线支付（租客）',
  [WORK_ORDER_ACTION.FEE_REFUSE_TENANT]: '拒绝付费（租客）',
  [WORK_ORDER_ACTION.REFUND_FEE_CANCEL]: '退费并取消工单',
  [WORK_ORDER_ACTION.COMPLETE_FOR_EVALUATION]: '办结（待评价）',
  [WORK_ORDER_ACTION.MARK_EVALUATED]: '评价完成',
  [WORK_ORDER_ACTION.TENANT_SUBMIT_EVALUATION]: '提交评价（租客）',
}

export type WorkOrderChangeEntry = { field: string; label: string; from: string; to: string }

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return '（空）'
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ')
  const s = String(v)
  if (s.length > 200) return s.slice(0, 200) + '…'
  return s
}

/** 图片附件字段写入日志：用稳定 JSON 字符串，避免 formatVal 截断导致无法解析 */
function formatImagesForChangeLog(v: unknown): string {
  if (v === null || v === undefined) return '（空）'
  const raw = typeof v === 'string' ? v : ''
  const urls = parseWorkOrderImageUrls(raw)
  return JSON.stringify(urls)
}

export function buildWorkOrderEditChanges(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>,
  fieldLabels: Record<string, string>
): WorkOrderChangeEntry[] {
  const out: WorkOrderChangeEntry[] = []
  for (const key of Object.keys(fieldLabels)) {
    const a = oldRow[key]
    const b = newRow[key]
    const fs = key === 'images' ? formatImagesForChangeLog(a) : formatVal(a)
    const ts = key === 'images' ? formatImagesForChangeLog(b) : formatVal(b)
    if (fs !== ts) {
      out.push({ field: key, label: fieldLabels[key]!, from: fs, to: ts })
    }
  }
  return out
}

export function operatorFromAuthUser(user: AuthUser): {
  operatorId: number | null
  operatorName: string | null
  operatorPhone: string | null
} {
  return {
    operatorId: user.id,
    operatorName: user.name ?? null,
    operatorPhone: user.phone ?? null,
  }
}

export async function logWorkOrderActivity(
  db: Db,
  input: {
    workOrderId: number
    workOrderCode: string
    companyId: number
    action: string
    summary?: string | null
    changes?: WorkOrderChangeEntry[]
    meta?: Record<string, unknown>
    operatorId: number | null
    operatorName: string | null
    operatorPhone: string | null
  }
) {
  await insertWorkOrderActivityLog(db, {
    workOrderId: input.workOrderId,
    workOrderCode: input.workOrderCode,
    companyId: input.companyId,
    action: input.action,
    summary: input.summary ?? null,
    changesJson:
      input.changes && input.changes.length > 0 ? JSON.stringify(input.changes) : null,
    metaJson: input.meta && Object.keys(input.meta).length > 0 ? JSON.stringify(input.meta) : null,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    operatorPhone: input.operatorPhone,
  })
}
