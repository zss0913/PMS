import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

type WorkOrderActivityLogDelegate = {
  findMany: (args: {
    where: { companyId: number; workOrderId: number }
    orderBy: { id: 'desc' }
  }) => Promise<WorkOrderActivityLogDTO[]>
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>
}

export type WorkOrderActivityLogDTO = {
  id: number
  workOrderId: number
  workOrderCode: string
  companyId: number
  action: string
  summary: string | null
  changesJson: string | null
  operatorId: number | null
  operatorName: string | null
  operatorPhone: string | null
  metaJson: string | null
  createdAt: Date
}

function delegate(db: Db): WorkOrderActivityLogDelegate | undefined {
  return (db as unknown as { workOrderActivityLog?: WorkOrderActivityLogDelegate })
    .workOrderActivityLog
}

function normalizeRawRow(row: Record<string, unknown>): WorkOrderActivityLogDTO {
  const created = row.createdAt
  return {
    id: Number(row.id),
    workOrderId: Number(row.workOrderId),
    workOrderCode: String(row.workOrderCode),
    companyId: Number(row.companyId),
    action: String(row.action),
    summary: row.summary == null ? null : String(row.summary),
    changesJson: row.changesJson == null ? null : String(row.changesJson),
    operatorId: row.operatorId == null ? null : Number(row.operatorId),
    operatorName: row.operatorName == null ? null : String(row.operatorName),
    operatorPhone: row.operatorPhone == null ? null : String(row.operatorPhone),
    metaJson: row.metaJson == null ? null : String(row.metaJson),
    createdAt: created instanceof Date ? created : new Date(String(created)),
  }
}

export async function fetchWorkOrderActivityLogs(
  db: Db,
  companyId: number,
  workOrderId: number
): Promise<WorkOrderActivityLogDTO[]> {
  const d = delegate(db)
  if (d?.findMany) {
    return d.findMany({
      where: { companyId, workOrderId },
      orderBy: { id: 'desc' },
    })
  }
  try {
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM WorkOrderActivityLog
      WHERE companyId = ${companyId} AND workOrderId = ${workOrderId}
      ORDER BY id DESC
    `
    return rows.map(normalizeRawRow)
  } catch (e) {
    console.warn('[WorkOrderActivityLog] findMany/raw 失败，返回空', e)
    return []
  }
}

export type InsertWorkOrderActivityLogInput = {
  workOrderId: number
  workOrderCode: string
  companyId: number
  action: string
  summary?: string | null
  changesJson?: string | null
  metaJson?: string | null
  operatorId: number | null
  operatorName: string | null
  operatorPhone: string | null
}

export async function insertWorkOrderActivityLog(
  db: Db,
  input: InsertWorkOrderActivityLogInput
): Promise<void> {
  const d = delegate(db)
  const summary = input.summary ?? null
  const changesJson = input.changesJson ?? null
  const metaJson = input.metaJson ?? null

  if (d?.create) {
    await d.create({
      data: {
        workOrderId: input.workOrderId,
        workOrderCode: input.workOrderCode,
        companyId: input.companyId,
        action: input.action,
        summary,
        changesJson,
        metaJson,
        operatorId: input.operatorId,
        operatorName: input.operatorName,
        operatorPhone: input.operatorPhone,
      },
    })
    return
  }

  await db.$executeRaw`
    INSERT INTO WorkOrderActivityLog (
      workOrderId, workOrderCode, companyId, action, summary, changesJson, operatorId, operatorName, operatorPhone, metaJson
    ) VALUES (
      ${input.workOrderId},
      ${input.workOrderCode},
      ${input.companyId},
      ${input.action},
      ${summary},
      ${changesJson},
      ${input.operatorId},
      ${input.operatorName},
      ${input.operatorPhone},
      ${metaJson}
    )
  `
}
