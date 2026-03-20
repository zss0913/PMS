import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export type TenantAppMessageInsert = {
  tenantId: number
  companyId: number
  title: string
  content: string
  billIdsJson: string
}

type Delegate = {
  create: (args: { data: TenantAppMessageInsert }) => Promise<unknown>
}

function delegate(db: Db): Delegate | undefined {
  return (db as unknown as { tenantAppMessage?: Delegate }).tenantAppMessage
}

/**
 * 写入租客端应用内消息。若当前进程 Prisma Client 尚未包含 tenantAppMessage delegate
 * （未执行 prisma generate / 未重启），则对 SQLite 表走 INSERT，避免 undefined.create。
 */
export async function insertTenantAppMessage(db: Db, data: TenantAppMessageInsert): Promise<void> {
  const d = delegate(db)
  if (d?.create) {
    await d.create({ data })
    return
  }
  await db.$executeRaw`
    INSERT INTO TenantAppMessage (tenantId, companyId, title, content, billIdsJson)
    VALUES (${data.tenantId}, ${data.companyId}, ${data.title}, ${data.content}, ${data.billIdsJson})
  `
}
