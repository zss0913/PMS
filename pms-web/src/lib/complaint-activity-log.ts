import type { PrismaClient } from '@prisma/client'

export type ComplaintLogInput = {
  complaintId: number
  companyId: number
  action: string
  summary: string
  operatorType: 'tenant' | 'employee' | 'system'
  operatorId?: number | null
  operatorName?: string | null
}

export async function insertComplaintActivityLog(
  db: PrismaClient,
  input: ComplaintLogInput
): Promise<void> {
  await db.complaintActivityLog.create({
    data: {
      complaintId: input.complaintId,
      companyId: input.companyId,
      action: input.action,
      summary: input.summary,
      operatorType: input.operatorType,
      operatorId: input.operatorId ?? null,
      operatorName: input.operatorName ?? null,
    },
  })
}
