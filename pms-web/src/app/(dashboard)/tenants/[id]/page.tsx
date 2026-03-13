import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft, Pencil } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; roomId?: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/tenants')

  const { id } = await params
  const { from, roomId } = await searchParams
  const tenantId = parseInt(id, 10)
  if (isNaN(tenantId)) redirect('/tenants')

  const backHref = from === 'room' && roomId ? `/rooms/${roomId}/tenants` : '/tenants'
  const backLabel = from === 'room' && roomId ? '返回房源租客列表' : '返回列表'

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, companyId: user.companyId },
    include: {
      building: { select: { id: true, name: true } },
      tenantRooms: {
        include: {
          room: { select: { id: true, name: true, roomNumber: true, area: true } },
        },
      },
      _count: { select: { tenantUsers: true, bills: true } },
    },
  })

  if (!tenant) notFound()

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <AppLink
          href={backHref}
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </AppLink>
        <AppLink
          href={`/tenants/${tenant.id}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Pencil className="w-4 h-4" />
          编辑
        </AppLink>
      </div>

      <h1 className="text-2xl font-bold mb-6">租户详情</h1>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">租客类型</label>
              <p className="text-slate-900 dark:text-white">{tenant.type}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">公司名称</label>
              <p className="text-slate-900 dark:text-white font-medium">{tenant.companyName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">所属楼宇</label>
              <p className="text-slate-900 dark:text-white">{tenant.building?.name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">租赁面积(㎡)</label>
              <p className="text-slate-900 dark:text-white">{Number(tenant.totalArea)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">入住日期</label>
              <p className="text-slate-900 dark:text-white">{formatDate(tenant.moveInDate)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">租期</label>
              <p className="text-slate-900 dark:text-white">
                {formatDate(tenant.leaseStartDate)} ~ {formatDate(tenant.leaseEndDate)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">员工数量</label>
              <p className="text-slate-900 dark:text-white">{tenant._count.tenantUsers}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">创建时间</label>
              <p className="text-slate-900 dark:text-white">{formatDateTime(tenant.createdAt)}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-500 mb-2">租赁房源</label>
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="text-left p-3 font-medium">房号</th>
                    <th className="text-left p-3 font-medium">房源名称</th>
                    <th className="text-left p-3 font-medium">房源面积(㎡)</th>
                    <th className="text-left p-3 font-medium">租赁面积(㎡)</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.tenantRooms.map((tr) => (
                    <tr
                      key={tr.id}
                      className="border-t border-slate-100 dark:border-slate-700"
                    >
                      <td className="p-3">{tr.room.roomNumber}</td>
                      <td className="p-3">{tr.room.name}</td>
                      <td className="p-3">{Number(tr.room.area)}</td>
                      <td className="p-3">{Number(tr.leaseArea)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
