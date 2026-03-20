import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

type BillActivityLogDelegate = {
  findMany: (args: {
    where: { companyId: number; billId: number }
    orderBy: { id: 'desc' }
  }) => Promise<BillActivityLogDTO[]>
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>
}

/** 与 Prisma model BillActivityLog 一致，用于 delegate 缺失时的 raw 查询结果 */
export type BillActivityLogDTO = {
  id: number
  billId: number | null
  billCode: string
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

function delegate(db: Db): BillActivityLogDelegate | undefined {
  return (db as unknown as { billActivityLog?: BillActivityLogDelegate }).billActivityLog
}

function normalizeRawRow(row: Record<string, unknown>): BillActivityLogDTO {
  const created = row.createdAt
  return {
    id: Number(row.id),
    billId: row.billId == null ? null : Number(row.billId),
    billCode: String(row.billCode),
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

/**
 * 读取账单操作日志。优先走 Prisma delegate；若当前进程里的 Client 尚未包含
 * billActivityLog（未 prisma generate / 未重启），则对 SQLite 表 BillActivityLog 走 $queryRaw。
 */
export async function fetchBillActivityLogsForBill(
  db: Db,
  companyId: number,
  billId: number
): Promise<BillActivityLogDTO[]> {
  const d = delegate(db)
  if (d?.findMany) {
    return d.findMany({
      where: { companyId, billId },
      orderBy: { id: 'desc' },
    })
  }
  try {
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM BillActivityLog
      WHERE companyId = ${companyId} AND billId = ${billId}
      ORDER BY id DESC
    `
    return rows.map(normalizeRawRow)
  } catch (e) {
    console.warn('[BillActivityLog] findMany 不可用且 raw 查询失败，返回空日志', e)
    return []
  }
}

export type InsertBillActivityLogInput = {
  billId: number
  billCode: string
  companyId: number
  action: string
  summary?: string | null
  changesJson?: string | null
  metaJson?: string | null
  operatorId: number
  operatorName: string
  operatorPhone: string
}

/** 写入一条操作日志（delegate 缺失时用 INSERT） */
export async function insertBillActivityLog(db: Db, input: InsertBillActivityLogInput): Promise<void> {
  const d = delegate(db)
  const summary = input.summary ?? null
  const changesJson = input.changesJson ?? null
  const metaJson = input.metaJson ?? null

  if (d?.create) {
    await d.create({
      data: {
        billId: input.billId,
        billCode: input.billCode,
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
    INSERT INTO BillActivityLog (
      billId, billCode, companyId, action, summary, changesJson, operatorId, operatorName, operatorPhone, metaJson
    ) VALUES (
      ${input.billId},
      ${input.billCode},
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
