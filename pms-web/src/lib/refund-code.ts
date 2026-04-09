import type { Prisma } from '@prisma/client'

/** 退费单号全局唯一，与 `api/refunds` 策略一致 */
export async function allocateUniqueRefundCode(tx: Prisma.TransactionClient): Promise<string> {
  const dayPrefix = `REF${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  let n = (await tx.refund.count()) + 1
  let attempts = 0
  while (attempts < 50000) {
    const code = `${dayPrefix}${String(n).padStart(4, '0')}`
    const exists = await tx.refund.findUnique({ where: { code } })
    if (!exists) return code
    n++
    attempts++
  }
  throw new Error('无法生成唯一退费单号，请稍后重试')
}
