import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { SectionalView } from '@/components/sectional-view/SectionalView'

async function getBuildingFilter(companyId: number, dataScope?: string, projectId?: number | null, departmentId?: number | null) {
  if (companyId <= 0) return null
  const scope = dataScope ?? 'all'
  if (scope === 'all') return null

  if (scope === 'project' && projectId) {
    const ids = await prisma.building.findMany({
      where: { companyId, projectId },
      select: { id: true },
    })
    return ids.map((b) => b.id)
  }

  if (scope === 'department' && departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    })
    if (!dept?.buildingIds) return null
    try {
      const ids = JSON.parse(dept.buildingIds) as number[]
      return ids.length ? ids : null
    } catch {
      return null
    }
  }

  return null
}

export default async function SectionalViewPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId <= 0) {
    redirect('/')
  }

  const buildingFilter = await getBuildingFilter(
    user.companyId,
    user.dataScope,
    user.projectId,
    user.departmentId
  )

  const buildings = await prisma.building.findMany({
    where: {
      companyId: user.companyId,
      ...(buildingFilter ? { id: { in: buildingFilter } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  })

  return (
    <div className="min-h-full bg-[#0a0e1a] p-6">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">剖面图</h1>
      <SectionalView buildings={buildings} />
    </div>
  )
}
