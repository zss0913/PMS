import type { PrismaClient } from '@prisma/client'
import { planTypeMatchesCategory } from '@/lib/inspection-point-types'

function parseInspectionPointIdsJson(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    const out: number[] = []
    const seen = new Set<number>()
    for (const x of arr) {
      const n = typeof x === 'number' ? x : parseInt(String(x), 10)
      if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  } catch {
    return []
  }
}

/** 巡检点台账 `images` JSON 字符串 → URL 列表（保留顺序，用于大图滑动） */
export function parseInspectionPointImagesField(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((s) => s.trim())
  } catch {
    return []
  }
}

type PointWithImages = {
  id: number
  name: string
  nfcTagId: number | null
  images: string | null
}

function urlsFromPoint(p: PointWithImages | null | undefined): string[] {
  if (!p) return []
  return parseInspectionPointImagesField(p.images)
}

/**
 * 按检查项顺序解析每个巡检点上的参考图（与设备关联使用相同的巡检点对齐规则；适用于各类巡检）。
 */
export async function fetchInspectionPointImagesPerCheckItem(
  prisma: PrismaClient,
  args: {
    companyId: number
    buildingId: number | null
    planId: number
    inspectionType: string
    checkItems: { name: string; nfcTagId: number }[]
  }
): Promise<string[][]> {
  const n = args.checkItems.length
  const empty = () => Array.from({ length: n }, () => [] as string[])

  if (n === 0) return []

  let buildingId = args.buildingId
  if (buildingId == null) {
    const planRow = await prisma.inspectionPlan.findFirst({
      where: { id: args.planId, companyId: args.companyId },
      select: { buildingId: true },
    })
    buildingId = planRow?.buildingId ?? null
  }
  if (buildingId == null) {
    return empty()
  }

  const plan = await prisma.inspectionPlan.findFirst({
    where: { id: args.planId, companyId: args.companyId },
    select: { inspectionPointIds: true },
  })
  const orderedPointIds = parseInspectionPointIdsJson(plan?.inspectionPointIds)

  if (orderedPointIds.length > 0) {
    const pointRows = (await prisma.inspectionPoint.findMany({
      where: {
        id: { in: orderedPointIds },
        companyId: args.companyId,
        buildingId,
      },
      select: { id: true, name: true, nfcTagId: true, images: true },
    })) as PointWithImages[]

    const byId = new Map(pointRows.map((p) => [p.id, p]))

    if (orderedPointIds.length === n) {
      return orderedPointIds.map((pid) => urlsFromPoint(byId.get(pid)))
    }

    const orderedPoints = orderedPointIds
      .map((id) => byId.get(id))
      .filter(Boolean) as PointWithImages[]

    const used = new Set<number>()
    return args.checkItems.map((item) => {
      let chosenIdx = -1
      for (let j = 0; j < orderedPoints.length; j++) {
        if (used.has(j)) continue
        const p = orderedPoints[j]!
        if (
          p.nfcTagId === item.nfcTagId &&
          p.name.trim() === String(item.name ?? '').trim()
        ) {
          chosenIdx = j
          break
        }
      }
      if (chosenIdx < 0) {
        chosenIdx = orderedPoints.findIndex(
          (p, j) => !used.has(j) && p.nfcTagId === item.nfcTagId
        )
      }
      if (chosenIdx < 0) {
        return []
      }
      used.add(chosenIdx)
      return urlsFromPoint(orderedPoints[chosenIdx])
    })
  }

  const nfcIds = [
    ...new Set(
      args.checkItems.map((c) => c.nfcTagId).filter((id) => Number.isInteger(id) && id > 0)
    ),
  ]
  if (nfcIds.length === 0) {
    return empty()
  }

  const allPoints = (await prisma.inspectionPoint.findMany({
    where: {
      companyId: args.companyId,
      buildingId,
      nfcTagId: { in: nfcIds },
    },
    select: { id: true, name: true, nfcTagId: true, images: true, inspectionCategory: true },
  })) as (PointWithImages & { inspectionCategory: string })[]

  const matching = allPoints.filter((p) =>
    planTypeMatchesCategory(args.inspectionType, p.inspectionCategory)
  )

  const byNfc = new Map<number, (PointWithImages & { inspectionCategory: string })[]>()
  for (const p of matching) {
    if (p.nfcTagId == null) continue
    const arr = byNfc.get(p.nfcTagId) ?? []
    arr.push(p)
    byNfc.set(p.nfcTagId, arr)
  }

  const usedPointIds = new Set<number>()
  return args.checkItems.map((item) => {
    const candidates = byNfc.get(item.nfcTagId) ?? []
    let chosen =
      candidates.find(
        (p) =>
          !usedPointIds.has(p.id) && p.name.trim() === String(item.name ?? '').trim()
      ) ?? null
    if (!chosen) {
      chosen = candidates.find((p) => !usedPointIds.has(p.id)) ?? null
    }
    if (!chosen) {
      return []
    }
    usedPointIds.add(chosen.id)
    return urlsFromPoint(chosen)
  })
}
