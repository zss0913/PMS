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
 * 投递规则（**并集**去重，与后台「所属项目 / 所属部门 / 部门负责人」配置对齐）：
 * 1. 员工绑定了项目：项目 buildingIds 含该楼，或项目未配楼宇则视为覆盖本公司全部楼宇。
 * 2. 员工绑定了部门：部门 `buildingIds` 含该楼；**未配置负责楼宇（空数组）时与项目一致，视为本公司全部楼宇**。
 * 3. 员工作为 **部门负责人**：部门 `buildingIds` 含该楼；未配置时同上。
 * 4. 兜底：`projectId` 为空 + 勾选对应管理业务类型（仅当上面都未命中任何人时不推荐依赖；仍会并入并集）。
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

  const seen = new Set<number>()

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

  const withDept = await prisma.employee.findMany({
    where: {
      companyId,
      status: 'active',
      departmentId: { not: null },
    },
    select: {
      id: true,
      businessTypes: true,
      department: { select: { buildingIds: true } },
    },
  })
  for (const e of withDept) {
    if (!e.department) continue
    if (!parseEmployeeBusinessTypes(e.businessTypes).includes(businessTag)) continue
    const bids = parseProjectBuildingIds(e.department.buildingIds)
    if (bids.length > 0) {
      if (!bids.includes(buildingId)) continue
    } else {
      if (!companyBuildingIdSet.has(buildingId)) continue
    }
    seen.add(e.id)
  }

  const deptsWithManager = await prisma.department.findMany({
    where: { companyId, managerId: { not: null } },
    select: { managerId: true, buildingIds: true },
  })
  for (const d of deptsWithManager) {
    if (d.managerId == null) continue
    const bids = parseProjectBuildingIds(d.buildingIds)
    if (bids.length > 0) {
      if (!bids.includes(buildingId)) continue
    } else {
      if (!companyBuildingIdSet.has(buildingId)) continue
    }
    const mgr = await prisma.employee.findFirst({
      where: { id: d.managerId, companyId, status: 'active' },
      select: { id: true, businessTypes: true },
    })
    if (mgr && parseEmployeeBusinessTypes(mgr.businessTypes).includes(businessTag)) {
      seen.add(mgr.id)
    }
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
    console.log(
      '[staff-notification] recipients',
      JSON.stringify({ companyId, buildingId, businessTag, count: seen.size, ids: [...seen] })
    )
  } else {
    console.warn(
      '[staff-notification] no recipients',
      JSON.stringify({ companyId, buildingId, businessTag })
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
