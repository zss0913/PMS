import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/** 新加 model 后旧的全局 Prisma 实例上可能没有对应 delegate（需 prisma generate + 换新实例） */
const REQUIRED_DELEGATES = ['billActivityLog', 'billAttachment'] as const

function prismaClientIsComplete(p: PrismaClient): boolean {
  for (const name of REQUIRED_DELEGATES) {
    const d = (p as unknown as Record<string, { create?: unknown } | undefined>)[name]
    if (typeof d?.create !== 'function') return false
  }
  return true
}

let client = globalForPrisma.prisma ?? new PrismaClient()
if (!prismaClientIsComplete(client)) {
  void client.$disconnect().catch(() => {})
  client = new PrismaClient()
}
globalForPrisma.prisma = client

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = client
}

export const prisma = client
