import type { PrismaClient } from '@prisma/client'

/**
 * 手工新建账单：若租客名下有租赁房源，则挂接楼宇与主房源（同一楼宇多间时写「合并房源：」行，与规则生成账单一致）。
 * 若租客跨多栋楼宇有房源，本单仅挂接 buildingId 最小的一栋及其房源；无租赁关系时不挂接。
 */
export async function resolveManualBillLocationFromTenant(
  db: PrismaClient,
  companyId: number,
  tenantId: number,
  userRemark: string | null | undefined
): Promise<{
  buildingId: number | null
  roomId: number | null
  projectId: number | null
  remark: string | null
}> {
  const rows = await db.tenantRoom.findMany({
    where: { tenantId },
    include: {
      room: { include: { building: true } },
    },
  })

  const valid = rows.filter((tr) => tr.room.companyId === companyId)
  if (valid.length === 0) {
    const r = userRemark?.trim()
    return { buildingId: null, roomId: null, projectId: null, remark: r || null }
  }

  const byBuilding = new Map<number, typeof valid>()
  for (const tr of valid) {
    const bid = tr.room.buildingId
    if (!byBuilding.has(bid)) byBuilding.set(bid, [])
    byBuilding.get(bid)!.push(tr)
  }

  const sortedBuildingIds = [...byBuilding.keys()].sort((a, b) => a - b)
  const members = byBuilding.get(sortedBuildingIds[0]!)!
  members.sort((a, b) => a.roomId - b.roomId)

  const primary = members[0]!.room
  const buildingId = primary.buildingId
  const roomId = primary.id
  const projectId = primary.building.projectId ?? null

  const roomNumbers = members.map((m) => m.room.roomNumber).join('、')
  const user = userRemark?.trim()
  const remark =
    members.length > 1
      ? [user, `合并房源：${roomNumbers}`].filter(Boolean).join('\n')
      : user || null

  return { buildingId, roomId, projectId, remark: remark || null }
}
