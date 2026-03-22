import type { AuthUser } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

/**
 * 员工端小程序：工单可见范围。
 * - dataScope === all：本企业全部工单
 * - 否则：派给我的、我上报的；组长额外可见「待派单」池
 * - project 范围：叠加 projectId（含 projectId 为 null 的兼容数据）
 */
export function mpEmployeeWorkOrderVisibilityWhere(user: AuthUser): Prisma.WorkOrderWhereInput {
  if (user.type !== 'employee') {
    return { companyId: user.companyId }
  }
  const dataScope = user.dataScope ?? 'self'
  if (dataScope === 'all') {
    return { companyId: user.companyId }
  }
  const or: Prisma.WorkOrderWhereInput[] = [
    { assignedTo: user.id },
    { reporterId: user.id },
  ]
  if (user.isLeader) {
    or.push({ status: '待派单' })
  }
  const parts: Prisma.WorkOrderWhereInput[] = [{ OR: or }]
  if (dataScope === 'project' && user.projectId != null) {
    parts.push({
      OR: [{ projectId: user.projectId }, { projectId: null }],
    })
  }
  return { companyId: user.companyId, AND: parts }
}
