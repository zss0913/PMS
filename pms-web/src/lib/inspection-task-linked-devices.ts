import type { PrismaClient } from '@prisma/client'

export type InspectionTaskLinkedDevice = {
  id: number
  code: string
  name: string
  type: string
  location: string
  status: string
}

/** 任务上的 inspectionType 与 NFC/计划一致时为「工程」「设备」等 */
export function isDeviceInspectionType(inspectionType: string): boolean {
  const t = (inspectionType ?? '').trim()
  return t === '设备' || t.startsWith('设备')
}

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

const deviceSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  location: true,
  status: true,
} as const

const includeDevices = {
  devices: {
    include: {
      device: { select: deviceSelect },
    },
  },
} as const

type InspectionPointWithDevices = {
  id: number
  name: string
  nfcTagId: number | null
  devices: { device: InspectionTaskLinkedDevice }[]
}

function mapPointDevices(p: InspectionPointWithDevices): InspectionTaskLinkedDevice[] {
  return p.devices.map(({ device: d }) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    type: d.type,
    location: d.location,
    status: d.status,
  }))
}

/**
 * 设备巡检：按「检查项」顺序返回每个巡检点关联的设备（与任务 checkItems 一一对应）。
 * 非设备类巡检返回与 checkItems 等长的空数组。
 */
export async function fetchLinkedDevicesPerCheckItem(
  prisma: PrismaClient,
  args: {
    companyId: number
    buildingId: number | null
    planId: number
    inspectionType: string
    checkItems: { name: string; nfcTagId: number }[]
  }
): Promise<InspectionTaskLinkedDevice[][]> {
  const n = args.checkItems.length
  const emptyRow = (): InspectionTaskLinkedDevice[][] => Array.from({ length: n }, () => [])

  if (!isDeviceInspectionType(args.inspectionType) || n === 0) {
    return emptyRow()
  }

  let buildingId = args.buildingId
  if (buildingId == null) {
    const planRow = await prisma.inspectionPlan.findFirst({
      where: { id: args.planId, companyId: args.companyId },
      select: { buildingId: true },
    })
    buildingId = planRow?.buildingId ?? null
  }
  if (buildingId == null) {
    return emptyRow()
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
      include: includeDevices,
    })) as InspectionPointWithDevices[]

    const byId = new Map(pointRows.map((p) => [p.id, p]))

    if (orderedPointIds.length === n) {
      return orderedPointIds.map((pid) => {
        const p = byId.get(pid)
        return p ? mapPointDevices(p) : []
      })
    }

    const orderedPoints = orderedPointIds
      .map((id) => byId.get(id))
      .filter(Boolean) as InspectionPointWithDevices[]

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
      return mapPointDevices(orderedPoints[chosenIdx]!)
    })
  }

  const nfcIds = [
    ...new Set(
      args.checkItems.map((c) => c.nfcTagId).filter((id) => Number.isInteger(id) && id > 0)
    ),
  ]
  if (nfcIds.length === 0) {
    return emptyRow()
  }

  const allPoints = (await prisma.inspectionPoint.findMany({
    where: {
      companyId: args.companyId,
      buildingId,
      nfcTagId: { in: nfcIds },
      inspectionCategory: '设备巡检',
    },
    include: includeDevices,
  })) as InspectionPointWithDevices[]

  const byNfc = new Map<number, InspectionPointWithDevices[]>()
  for (const p of allPoints) {
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
    return mapPointDevices(chosen)
  })
}
