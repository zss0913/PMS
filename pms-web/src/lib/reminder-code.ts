import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/** PaymentReminder.code 全局唯一，与缴费/退费单号策略一致 */
export async function allocateUniqueReminderCode(db: Db): Promise<string> {
  const dayPrefix = `REM${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  let n = (await db.paymentReminder.count()) + 1
  let attempts = 0
  while (attempts < 50000) {
    const code = `${dayPrefix}${String(n).padStart(4, '0')}`
    const exists = await db.paymentReminder.findUnique({ where: { code } })
    if (!exists) return code
    n++
    attempts++
  }
  throw new Error('无法生成唯一催缴单号，请稍后重试')
}
