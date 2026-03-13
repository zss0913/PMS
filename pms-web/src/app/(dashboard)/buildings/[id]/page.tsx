import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft, Pencil } from 'lucide-react'
import { BuildingDetail } from '@/components/buildings/BuildingDetail'

export default async function BuildingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const { id } = await params
  const buildingId = parseInt(id, 10)
  if (isNaN(buildingId)) redirect('/buildings')

  const where = user.companyId > 0 ? { id: buildingId, companyId: user.companyId } : { id: buildingId }
  const building = await prisma.building.findFirst({
    where,
    include: {
      project: { select: { id: true, name: true } },
      floors: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
      _count: { select: { rooms: true } },
    },
  })
  if (!building) notFound()

  const buildingData = {
    ...building,
    area: Number(building.area),
    floors: building.floors.map((f) => ({ ...f, area: Number(f.area) })),
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AppLink
            href="/buildings"
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </AppLink>
        </div>
        <AppLink
          href={`/buildings/${buildingId}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Pencil className="w-4 h-4" />
          编辑
        </AppLink>
      </div>
      <BuildingDetail building={buildingData} />
    </div>
  )
}
