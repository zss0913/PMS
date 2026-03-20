import type { PrismaClient } from '@prisma/client'
import { parseMergedRoomLabels } from '@/lib/bill-merged-rooms'

/** 按房号/名称在楼宇内解析 Room；与生成账单时写入的「合并房源：」标签一致 */
export async function resolveRoomIdByLabel(
  db: PrismaClient,
  buildingId: number,
  companyId: number,
  label: string
): Promise<number | null> {
  const byNumber = await db.room.findFirst({
    where: { buildingId, roomNumber: label },
  })
  if (byNumber) return byNumber.id
  const byName = await db.room.findFirst({
    where: { buildingId, companyId, name: label },
  })
  return byName?.id ?? null
}

/**
 * 合并账单含多个房源：除主 roomId 外，其余在 remark「合并房源：」中列出。
 */
export async function collectRoomIdsForBillGroup(
  db: PrismaClient,
  group: { buildingId: number; roomId: number; remark: string | null }[],
  companyId: number
): Promise<number[]> {
  const ordered: number[] = []
  const seen = new Set<number>()
  for (const b of group) {
    const labels = parseMergedRoomLabels(b.remark)
    if (labels?.length) {
      let added = 0
      for (const label of labels) {
        const id = await resolveRoomIdByLabel(db, b.buildingId, companyId, label)
        if (id != null && !seen.has(id)) {
          seen.add(id)
          ordered.push(id)
          added += 1
        }
      }
      if (added === 0) {
        const id = b.roomId
        if (!seen.has(id)) {
          seen.add(id)
          ordered.push(id)
        }
      }
    } else {
      const id = b.roomId
      if (!seen.has(id)) {
        seen.add(id)
        ordered.push(id)
      }
    }
  }
  return ordered
}

/** 账单详情页：本条账单涉及的全部房源（含合并房源解析） */
export async function getBillRelatedRoomsForDetail(
  db: PrismaClient,
  companyId: number,
  bill: { buildingId: number | null; roomId: number | null; remark: string | null }
) {
  if (bill.buildingId == null || bill.roomId == null) return []
  const ids = await collectRoomIdsForBillGroup(
    db,
    [{ buildingId: bill.buildingId, roomId: bill.roomId, remark: bill.remark }],
    companyId
  )
  if (ids.length === 0) return []
  return db.room.findMany({
    where: { id: { in: ids }, companyId },
    select: {
      id: true,
      roomNumber: true,
      name: true,
      buildingId: true,
      building: { select: { id: true, name: true } },
      floor: { select: { id: true, name: true } },
    },
    orderBy: { id: 'asc' },
  })
}
