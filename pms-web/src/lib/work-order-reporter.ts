import type { PrismaClient } from '@prisma/client'

export type WorkOrderReporterDTO = {
  role: '员工' | '租客'
  name: string
  phone: string
}

/**
 * reporterId 在 Employee 与 TenantUser 两表中各自自增，数值可能重合。
 * 若一律先查 Employee，则「租客自建」工单会误匹配到同 id 的员工（电话、姓名均错）。
 * 按工单 source 决定查询顺序；无法识别时保持「先员工后租客」以兼容 PC/巡检等场景。
 */
export async function resolveWorkOrderReporter(
  db: PrismaClient,
  companyId: number,
  reporterId: number,
  source: string | null | undefined
): Promise<WorkOrderReporterDTO | null> {
  const src = (source ?? '').trim()

  const tryTenant = () =>
    db.tenantUser.findFirst({
      where: { id: reporterId, companyId },
      select: { name: true, phone: true },
    })

  const tryEmployee = () =>
    db.employee.findFirst({
      where: { id: reporterId, companyId },
      select: { name: true, phone: true },
    })

  const tenantSources = new Set(['租客自建', '租客端'])

  if (tenantSources.has(src)) {
    const tu = await tryTenant()
    if (tu) return { role: '租客', name: tu.name, phone: tu.phone }
    const emp = await tryEmployee()
    if (emp) return { role: '员工', name: emp.name, phone: emp.phone }
    return null
  }

  const emp = await tryEmployee()
  if (emp) return { role: '员工', name: emp.name, phone: emp.phone }
  const tu = await tryTenant()
  if (tu) return { role: '租客', name: tu.name, phone: tu.phone }
  return null
}
