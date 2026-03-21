import type { Prisma, PrismaClient } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
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
  FEE_CONFIRM_TENANT: 'fee_confirm_tenant',
  COMPLETE_FOR_EVALUATION: 'complete_for_evaluation',
  MARK_EVALUATED: 'mark_evaluated',
} as const

export const WORK_ORDER_ACTION_LABELS: Record<string, string> = {
  [WORK_ORDER_ACTION.CREATE]: '创建',
  [WORK_ORDER_ACTION.UPDATE]: '编辑',
  [WORK_ORDER_ACTION.ASSIGN]: '派单',
  [WORK_ORDER_ACTION.CANCEL]: '取消',
  [WORK_ORDER_ACTION.START_PROCESSING]: '开始处理',
  [WORK_ORDER_ACTION.REQUEST_FEE_CONFIRMATION]: '提交费用待确认',
  [WORK_ORDER_ACTION.FEE_CONFIRM_TENANT]: '确认费用（租客）',
  [WORK_ORDER_ACTION.COMPLETE_FOR_EVALUATION]: '办结（待评价）',
  [WORK_ORDER_ACTION.MARK_EVALUATED]: '评价完成',
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

export function buildWorkOrderEditChanges(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>,
  fieldLabels: Record<string, string>
): WorkOrderChangeEntry[] {
  const out: WorkOrderChangeEntry[] = []
  for (const key of Object.keys(fieldLabels)) {
    const a = oldRow[key]
    const b = newRow[key]
    const fs = formatVal(a)
    const ts = formatVal(b)
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
