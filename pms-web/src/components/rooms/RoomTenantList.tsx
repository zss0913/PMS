'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { ArrowLeft, Eye } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

type Room = {
  id: number
  name: string
  roomNumber: string
  area: number
  building: { id: number; name: string }
  floor: { id: number; name: string }
}

type Tenant = {
  id: number
  type: string
  companyName: string
  buildingId: number
  building: { id: number; name: string }
  roomNumbers: string
  totalArea: number
  leaseArea: number
  moveInDate: string
  leaseStartDate: string
  leaseEndDate: string
  employeeCount: number
  createdAt: string
}

type ApiData = {
  room: Room
  tenants: Tenant[]
}

export function RoomTenantList({ roomId }: { roomId: number }) {
  const searchParams = useSearchParams()
  const fromSectionalView = searchParams.get('from') === 'sectional-view'

  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/rooms/${roomId}/tenants`)
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        } else {
          setError(json.message || '加载失败')
        }
      } catch {
        setError('网络错误')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [roomId])

  const tenants = data?.tenants ?? []
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(tenants, 15)

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-red-500">
        {error || '加载失败'}
      </div>
    )
  }

  const { room } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AppLink
          href={fromSectionalView ? '/sectional-view' : '/rooms'}
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-5 h-5" />
          {fromSectionalView ? '返回剖面图' : '返回房源列表'}
        </AppLink>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">房源租客列表</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {room.name}（{room.roomNumber}）· {room.building?.name ?? '-'} · {room.floor?.name ?? '-'} · {room.area}㎡
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {tenants.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            该房源暂无关联租客
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left p-4 font-medium">公司名称</th>
                  <th className="text-left p-4 font-medium">租客类型</th>
                  <th className="text-left p-4 font-medium">租赁房号</th>
                  <th className="text-left p-4 font-medium">租赁面积(㎡)</th>
                  <th className="text-left p-4 font-medium">入住日期</th>
                  <th className="text-left p-4 font-medium">租期</th>
                  <th className="text-left p-4 font-medium">员工数</th>
                  <th className="text-left p-4 font-medium">创建时间</th>
                  <th className="text-left p-4 font-medium w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="p-4 font-medium">{t.companyName}</td>
                    <td className="p-4">{t.type}</td>
                    <td className="p-4">{t.roomNumbers || '-'}</td>
                    <td className="p-4">{t.leaseArea}</td>
                    <td className="p-4">{formatDate(t.moveInDate)}</td>
                    <td className="p-4">
                      {formatDate(t.leaseStartDate)} ~ {formatDate(t.leaseEndDate)}
                    </td>
                    <td className="p-4">{t.employeeCount}</td>
                    <td className="p-4">{formatDateTime(t.createdAt)}</td>
                    <td className="p-4">
                      <AppLink
                        href={`/tenants/${t.id}?from=room&roomId=${roomId}`}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-500 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        查看
                      </AppLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tenants.length > 0 && (
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </div>
  )
}
