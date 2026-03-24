import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const logs = await prisma.workOrderActivityLog.deleteMany({})
  const orders = await prisma.workOrder.deleteMany({})
  console.log('已删除 WorkOrderActivityLog:', logs.count, '条')
  console.log('已删除 WorkOrder:', orders.count, '条')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
