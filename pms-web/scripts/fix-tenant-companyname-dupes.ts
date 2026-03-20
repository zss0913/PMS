/**
 * 在添加 Tenant(companyId, companyName) 唯一约束前，将历史重复名称改为可区分。
 * 用法：npx tsx scripts/fix-tenant-companyname-dupes.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({ orderBy: { id: 'asc' } })
  const seen = new Set<string>()
  let n = 0
  for (const t of tenants) {
    const key = `${t.companyId}\t${t.companyName.trim()}`
    if (seen.has(key)) {
      const newName = `${t.companyName.trim()}（重复已改-${t.id}）`
      await prisma.tenant.update({
        where: { id: t.id },
        data: { companyName: newName },
      })
      n++
      console.log(`Updated tenant ${t.id}: -> ${newName}`)
    } else {
      seen.add(key)
    }
  }
  console.log(n > 0 ? `Done. Renamed ${n} duplicate(s).` : 'No duplicates found.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
