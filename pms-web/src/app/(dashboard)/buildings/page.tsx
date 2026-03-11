import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { BuildingList } from '@/components/buildings/BuildingList'

export default async function BuildingsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const companyId = user.companyId
  const buildings = companyId > 0
    ? await prisma.building.findMany({
        where: { companyId },
        include: {
          project: { select: { name: true } },
          _count: { select: { floors: true, rooms: true } },
        },
        orderBy: { id: 'asc' },
      })
    : await prisma.building.findMany({
        include: {
          project: { select: { name: true } },
          _count: { select: { floors: true, rooms: true } },
        },
        orderBy: { id: 'asc' },
      })
  const projects = companyId > 0
    ? await prisma.project.findMany({ where: { companyId } })
    : await prisma.project.findMany()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">楼宇管理</h1>
      <BuildingList
        buildings={buildings}
        projects={projects}
        isSuperAdmin={companyId === 0}
      />
    </div>
  )
}
