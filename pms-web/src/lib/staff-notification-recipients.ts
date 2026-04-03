import type { PrismaClient } from '@prisma/client'

export function parseEmployeeBusinessTypes(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json) as string[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function parseProjectBuildingIds(buildingIds: string | null | undefined): number[] {
  if (!buildingIds) return []
  try {
    const arr = JSON.parse(buildingIds) as unknown
    if (!Array.isArray(arr)) return []
    return arr.map((x) => Number(x)).filter((n) => !Number.isNaN(n) && n > 0)
  } catch {
    return []
  }
}

export function projectCoversBuilding(
  projectBuildingIdsJson: string | null | undefined,
  buildingId: number
): boolean {
  const ids = parseProjectBuildingIds(projectBuildingIdsJson)
  return ids.includes(buildingId)
}

/**
 * 投递规则（按顺序合并去重）：
 * 1. 已绑定项目：若项目配置了 buildingIds 则须包含目标楼宇；若未配置（空）则视为该项目覆盖本公司全部楼宇（避免后台未录入楼宇范围时永远收不到通知）。
 * 2. 若仍无人：projectId 为空的在职员工，只要勾选了对应管理业务类型也接收（常见：只配了「报修」未选所属项目）。
 */
export async function findRecipientEmployeeIds(
  prisma: PrismaClient,
  params: { companyId: number; buildingId: number; businessTag: string }
): Promise<number[]> {
  const { companyId, buildingId, businessTag } = params

  const companyBuildings = await prisma.building.findMany({
    where: { companyId },
    select: { id: true },
  })
  const companyBuildingIdSet = new Set(companyBuildings.map((b) => b.id))
  if (!companyBuildingIdSet.has(buildingId)) {
    console.warn(
      '[staff-notification] buildingId not in company',
      JSON.stringify({ companyId, buildingId })
    )
  }

  const withProject = await prisma.employee.findMany({
    where: {
      companyId,
      status: 'active',
      projectId: { not: null },
    },
    select: {
      id: true,
      businessTypes: true,
      projectId: true,
      project: { select: { buildingIds: true } },
    },
  })

  const seen = new Set<number>()

  for (const e of withProject) {
    if (!e.project || e.projectId == null) continue
    const types = parseEmployeeBusinessTypes(e.businessTypes)
    if (!types.includes(businessTag)) continue

    const scoped = parseProjectBuildingIds(e.project.buildingIds)
    if (scoped.length > 0) {
      if (!scoped.includes(buildingId)) continue
    } else {
      if (!companyBuildingIdSet.has(buildingId)) continue
    }
    seen.add(e.id)
  }

  if (seen.size > 0) {
    return [...seen]
  }

  const noProject = await prisma.employee.findMany({
    where: {
      companyId,
      status: 'active',
      projectId: null,
    },
    select: { id: true, businessTypes: true },
  })
  for (const e of noProject) {
    if (parseEmployeeBusinessTypes(e.businessTypes).includes(businessTag)) {
      seen.add(e.id)
    }
  }
  if (seen.size > 0) {
    console.warn(
      '[staff-notification] used projectId-null fallback',
      JSON.stringify({ companyId, buildingId, businessTag, employeeIds: [...seen] })
    )
  }
  return [...seen]
}

function parsePlanUserIds(userIds: string | null | undefined): number[] {
  if (!userIds) return []
  try {
    const arr = JSON.parse(userIds) as unknown
    if (!Array.isArray(arr)) return []
    return arr.map((x) => Number(x)).filter((n) => !Number.isNaN(n) && n > 0)
  } catch {
    return []
  }
}

/**
 * 巡检任务：优先通知计划在「执行人」里勾选的员工；若无则按本公司各项目所辖楼宇并集，匹配管理业务类型。
 */
export async function findRecipientEmployeeIdsForInspectionPlan(
  prisma: PrismaClient,
  params: {
    companyId: number
    businessTag: string
    planUserIdsJson: string | null | undefined
  }
): Promise<number[]> {
  const { companyId, businessTag, planUserIdsJson } = params

  const explicit = parsePlanUserIds(planUserIdsJson)
  if (explicit.length > 0) {
    const valid = await prisma.employee.findMany({
      where: {
        id: { in: explicit },
        companyId,
        status: 'active',
      },
      select: { id: true },
    })
    if (valid.length > 0) {
      return valid.map((v) => v.id)
    }
  }

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: { buildingIds: true },
  })
  const buildingSet = new Set<number>()
  for (const p of projects) {
    for (const bid of parseProjectBuildingIds(p.buildingIds)) {
      buildingSet.add(bid)
    }
  }

  const merged = new Set<number>()
  for (const buildingId of buildingSet) {
    const part = await findRecipientEmployeeIds(prisma, {
      companyId,
      buildingId,
      businessTag,
    })
    part.forEach((id) => merged.add(id))
  }
  return [...merged]
}
