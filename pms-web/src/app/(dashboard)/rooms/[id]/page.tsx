import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AppLink } from '@/components/AppLink'
import { RoomDetailBackButton } from '@/components/rooms/RoomDetailBackButton'
import { Pencil, Users } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; tenantId?: string; buildingId?: string; returnTo?: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const { id } = await params
  const { from, tenantId, buildingId, returnTo } = await searchParams
  const roomId = parseInt(id, 10)
  if (isNaN(roomId)) redirect('/rooms')

  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
      ...(user.companyId > 0 ? { companyId: user.companyId } : {}),
    },
    include: {
      building: { select: { id: true, name: true } },
      floor: { select: { id: true, name: true } },
      _count: { select: { tenantRooms: true } },
    },
  })

  if (!room) notFound()

  // 查询当前租客信息
  const tenantRooms = await prisma.tenantRoom.findMany({
    where: { roomId },
    include: {
      tenant: {
        select: {
          id: true,
          companyName: true,
          type: true,
          leaseStartDate: true,
          leaseEndDate: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const currentTenant = tenantRooms.find((tr) => {
    const now = new Date()
    return tr.tenant.leaseStartDate <= now && tr.tenant.leaseEndDate >= now
  })

  const statusLabels: Record<string, string> = {
    '空置': '空置',
    '已租': '已租',
    '自用': '自用',
  }

  const typeLabels: Record<string, string> = {
    '商铺': '商铺',
    '写字楼': '写字楼',
    '住宅': '住宅',
  }

  const leasingStatusLabels: Record<string, string> = {
    '可招商': '可招商',
    '不可招商': '不可招商',
  }

  const subQuery = new URLSearchParams()
  if (buildingId) subQuery.set('buildingId', buildingId)
  if (returnTo) subQuery.set('returnTo', returnTo)
  const subQs = subQuery.toString()
  const tenantsHref = `/rooms/${room.id}/tenants${subQs ? `?${subQs}` : ''}`
  const roomDetailPath = `/rooms/${room.id}${subQs ? `?${subQs}` : ''}`
  const editHref = `/rooms/${room.id}/edit?returnTo=${encodeURIComponent(roomDetailPath)}`

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <RoomDetailBackButton returnTo={returnTo} from={from} tenantId={tenantId} />
        <div className="flex items-center gap-2">
          <AppLink
            href={tenantsHref}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
          >
            <Users className="w-4 h-4" />
            租客列表
          </AppLink>
          <AppLink
            href={editHref}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            <Pencil className="w-4 h-4" />
            编辑
          </AppLink>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6">房源详情</h1>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">房源名称</label>
              <p className="text-slate-900 dark:text-white font-medium">{room.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">房号</label>
              <p className="text-slate-900 dark:text-white">{room.roomNumber}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">所属楼宇</label>
              <p className="text-slate-900 dark:text-white">{room.building?.name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">所属楼层</label>
              <p className="text-slate-900 dark:text-white">{room.floor?.name || '-'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">房源面积(㎡)</label>
              <p className="text-slate-900 dark:text-white">{Number(room.area)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">房源类型</label>
              <p className="text-slate-900 dark:text-white">{typeLabels[room.type] || room.type}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">房源状态</label>
              <p className="text-slate-900 dark:text-white">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs ${
                    room.status === '已租'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : room.status === '空置'
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}
                >
                  {statusLabels[room.status] || room.status}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">招商状态</label>
              <p className="text-slate-900 dark:text-white">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs ${
                    room.leasingStatus === '可招商'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  {leasingStatusLabels[room.leasingStatus] || room.leasingStatus}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">租客数量</label>
              <p className="text-slate-900 dark:text-white">{room._count.tenantRooms}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">创建时间</label>
              <p className="text-slate-900 dark:text-white">{formatDateTime(room.createdAt)}</p>
            </div>
          </div>

          {currentTenant && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-lg font-semibold mb-4">当前租客</h3>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">公司名称</label>
                    <AppLink
                      href={`/tenants/${currentTenant.tenant.id}`}
                      className="text-blue-600 hover:text-blue-500 hover:underline font-medium"
                    >
                      {currentTenant.tenant.companyName}
                    </AppLink>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">租客类型</label>
                    <p className="text-slate-900 dark:text-white">{currentTenant.tenant.type}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">租期</label>
                    <p className="text-slate-900 dark:text-white">
                      {formatDate(currentTenant.tenant.leaseStartDate)} ~ {formatDate(currentTenant.tenant.leaseEndDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!currentTenant && room._count.tenantRooms > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-lg font-semibold mb-4">历史租客</h3>
              <div className="space-y-3">
                {tenantRooms.map((tr) => (
                  <div
                    key={tr.id}
                    className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">公司名称</label>
                        <AppLink
                          href={`/tenants/${tr.tenant.id}`}
                          className="text-blue-600 hover:text-blue-500 hover:underline font-medium"
                        >
                          {tr.tenant.companyName}
                        </AppLink>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">租客类型</label>
                        <p className="text-slate-900 dark:text-white">{tr.tenant.type}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">租期</label>
                        <p className="text-slate-900 dark:text-white">
                          {formatDate(tr.tenant.leaseStartDate)} ~ {formatDate(tr.tenant.leaseEndDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {room._count.tenantRooms === 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <div className="text-center text-slate-500 py-8">
                暂无租客记录
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
