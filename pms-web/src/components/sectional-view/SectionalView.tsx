'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type Building = { id: number; name: string }

type Tenant = {
  id: number
  companyName: string
  type: string
  leaseArea: number
  leaseStartDate: string
  leaseEndDate: string
  moveInDate: string
}

type Room = {
  id: number
  roomNumber: string
  name: string
  area: number
  status: string
  leasingStatus: string
  type: string
  tenants: Tenant[]
  latestTenant: Tenant | null
  leaseEndDateForDisplay: string | null
}

type Floor = {
  id: number
  name: string
  sort: number
  area: number
  rooms: Room[]
}

type SectionalData = {
  building: { id: number; name: string }
  summary: {
    totalArea: number
    totalCount: number
    leasedArea: number
    leasedCount: number
    selfUseArea: number
    selfUseCount: number
    vacantArea: number
    vacantCount: number
  }
  floors: Floor[]
}

const STORAGE_KEY = 'sectional-view-order'

function getStoredOrder(buildingId: number): Record<number, number[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const all = JSON.parse(raw) as Record<string, Record<string, number[]>>
    const floorMap = all[String(buildingId)] || {}
    const result: Record<number, number[]> = {}
    for (const [fid, ids] of Object.entries(floorMap)) {
      result[Number(fid)] = ids
    }
    return result
  } catch {
    return {}
  }
}

function saveRoomOrder(buildingId: number, floorId: number, roomIds: number[]) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const all: Record<string, Record<string, number[]>> = raw ? JSON.parse(raw) : {}
    const bKey = String(buildingId)
    if (!all[bKey]) all[bKey] = {}
    all[bKey][String(floorId)] = roomIds
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    //
  }
}

function getExpiryCategory(leaseEndDate: string | null, status: string): string {
  if (!leaseEndDate || status === '空置' || status === '自用') return '无到期'
  const end = new Date(leaseEndDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diff = (end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  if (diff < 0) return '已到期'
  if (diff <= 30) return '30天内到期'
  if (diff <= 90) return '90天内到期'
  if (diff <= 180) return '半年内到期'
  if (diff <= 365) return '一年内到期'
  return '一年以上到期'
}

const STATUS_COLORS: Record<string, string> = {
  已租: 'bg-green-500 text-white',
  自用: 'bg-slate-400 text-white',
  空置: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200',
}

const EXPIRY_COLORS: Record<string, string> = {
  已到期: 'bg-red-500 text-white',
  '30天内到期': 'bg-orange-500 text-white',
  '90天内到期': 'bg-amber-500 text-white',
  半年内到期: 'bg-yellow-400 text-slate-900',
  一年内到期: 'bg-lime-400 text-slate-900',
  一年以上到期: 'bg-green-400 text-slate-900',
  无到期: 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200',
}

export function SectionalView({ buildings }: { buildings: Building[] }) {
  const router = useRouter()
  const [buildingId, setBuildingId] = useState<number | null>(buildings[0]?.id ?? null)
  const [displayMode, setDisplayMode] = useState<'status' | 'expiry'>('status')
  const [data, setData] = useState<SectionalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tooltip, setTooltip] = useState<{ room: Room; x: number; y: number } | null>(null)
  const [dragOverFloorId, setDragOverFloorId] = useState<number | null>(null)
  const [draggedRoom, setDraggedRoom] = useState<{ room: Room; floorId: number } | null>(null)

  const fetchData = useCallback(async (bid: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sectional-view?buildingId=${bid}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setData(null)
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (buildingId) fetchData(buildingId)
  }, [buildingId, fetchData])

  useEffect(() => {
    if (buildings.length > 0 && !buildingId) {
      setBuildingId(buildings[0].id)
    }
  }, [buildings, buildingId])

  const applyRoomOrder = useCallback((floors: Floor[], bid: number): Floor[] => {
    const stored = getStoredOrder(bid)
    return floors.map((f) => {
      const ids = stored[f.id]
      if (!ids || ids.length === 0) return f
      const idSet = new Set(ids)
      const ordered = ids.map((id) => f.rooms.find((r) => r.id === id)).filter(Boolean) as Room[]
      const rest = f.rooms.filter((r) => !idSet.has(r.id))
      return { ...f, rooms: [...ordered, ...rest] }
    })
  }, [])

  const reorderRooms = (floorId: number, roomIds: number[]) => {
    if (!buildingId || !data) return
    saveRoomOrder(buildingId, floorId, roomIds)
    setData({
      ...data,
      floors: data.floors.map((f) => {
        if (f.id !== floorId) return f
        const idSet = new Set(roomIds)
        const ordered = roomIds.map((id) => f.rooms.find((r) => r.id === id)).filter(Boolean) as Room[]
        const rest = f.rooms.filter((r) => !idSet.has(r.id))
        return { ...f, rooms: [...ordered, ...rest] }
      }),
    })
  }

  const handleDragStart = (e: React.DragEvent, room: Room, floorId: number) => {
    setDraggedRoom({ room, floorId })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(room.id))
  }

  const handleDragOver = (e: React.DragEvent, floorId: number) => {
    e.preventDefault()
    setDragOverFloorId(floorId)
  }

  const handleDragLeave = () => {
    setDragOverFloorId(null)
  }

  const handleDrop = (e: React.DragEvent, floorId: number, dropIndex: number) => {
    e.preventDefault()
    setDragOverFloorId(null)
    setDraggedRoom(null)
    if (!data || !draggedRoom || draggedRoom.floorId !== floorId) return
    const floor = data.floors.find((f) => f.id === floorId)
    if (!floor) return
    const roomIds = floor.rooms.map((r) => r.id)
    const dragId = draggedRoom.room.id
    const fromIdx = roomIds.indexOf(dragId)
    if (fromIdx === -1) return
    roomIds.splice(fromIdx, 1)
    const insertIdx = fromIdx < dropIndex ? dropIndex - 1 : dropIndex
    roomIds.splice(insertIdx, 0, dragId)
    reorderRooms(floorId, roomIds)
  }

  const displayFloors = data
    ? applyRoomOrder(data.floors, data.building.id)
    : []

  if (buildings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        暂无楼宇数据，请先添加楼宇
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-400">楼宇</label>
          <select
            value={buildingId ?? ''}
            onChange={(e) => setBuildingId(Number(e.target.value) || null)}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDisplayMode('status')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              displayMode === 'status'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'
            )}
          >
            按状态
          </button>
          <button
            onClick={() => setDisplayMode('expiry')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              displayMode === 'expiry'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'
            )}
          >
            按到期区间
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
          加载中...
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              title="管理面积"
              value={`${data.summary.totalArea.toFixed(2)}㎡`}
              sub={`${data.summary.totalCount} 间`}
            />
            <SummaryCard
              title="在租面积"
              value={`${data.summary.leasedArea.toFixed(2)}㎡`}
              sub={`${data.summary.leasedCount} 间`}
            />
            <SummaryCard
              title="自用面积"
              value={`${data.summary.selfUseArea.toFixed(2)}㎡`}
              sub={`${data.summary.selfUseCount} 间`}
            />
            <SummaryCard
              title="空置面积"
              value={`${data.summary.vacantArea.toFixed(2)}㎡`}
              sub={`${data.summary.vacantCount} 间`}
            />
          </div>

          {displayMode === 'status' && (
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-green-500" />
                已租
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-slate-400" />
                自用
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded bg-pink-100 dark:bg-pink-900/30" />
                空置
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded border-2 border-dashed border-pink-400" />
                可招商
              </span>
            </div>
          )}

          {displayMode === 'expiry' && (
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.entries(EXPIRY_COLORS).map(([label, cls]) => (
                <span key={label} className="flex items-center gap-1">
                  <span className={cn('w-4 h-4 rounded', cls.split(' ')[0])} />
                  {label}
                </span>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-medium">
              {data.building.name}
            </div>
            <div className="p-4 space-y-4">
              {displayFloors.map((floor) => {
                const totalArea = floor.rooms.reduce((s, r) => s + r.area, 0) || 1
                return (
                  <div
                    key={floor.id}
                    className={cn(
                      'flex items-stretch gap-1 min-h-[80px] rounded-lg transition-colors',
                      dragOverFloorId === floor.id && 'bg-slate-100 dark:bg-slate-700/50'
                    )}
                    onDragOver={(e) => handleDragOver(e, floor.id)}
                    onDragLeave={handleDragLeave}
                  >
                    <div className="w-24 shrink-0 flex items-center justify-center text-sm text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-600 pr-2">
                      <div>
                        <div className="font-medium">{floor.name}</div>
                        <div className="text-xs">{floor.area.toFixed(0)}㎡</div>
                      </div>
                    </div>
                    <div className="flex-1 flex gap-1 content-stretch min-w-0 overflow-hidden">
                      {floor.rooms.map((room, idx) => {
                        const pct = (room.area / totalArea) * 100
                        const expiryCat = getExpiryCategory(room.leaseEndDateForDisplay, room.status)
                        const statusCls = STATUS_COLORS[room.status] ?? 'bg-slate-300'
                        const expiryCls = EXPIRY_COLORS[expiryCat] ?? 'bg-slate-300'
                        const cls = displayMode === 'status' ? statusCls : expiryCls
                        const hasAntLine = room.leasingStatus === '可招商'

                        return (
                          <div
                            key={room.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, room, floor.id)}
                            onDrop={(e) => handleDrop(e, floor.id, idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => router.push(`/rooms/${room.id}/tenants?from=sectional-view`)}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setTooltip({ room, x: rect.left, y: rect.bottom + 4 })
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            className={cn(
                              'min-w-0 rounded cursor-pointer transition hover:opacity-90 flex flex-col justify-center p-2 text-xs overflow-hidden border-2',
                              cls,
                              hasAntLine ? 'border-dashed border-pink-400 dark:border-pink-500' : 'border-transparent'
                            )}
                            style={{ flex: `${pct} 1 0` }}
                          >
                            <div className="font-medium truncate">{room.roomNumber}</div>
                            <div className="truncate">{room.area}㎡</div>
                            {room.latestTenant && (
                              <>
                                <div className="truncate">{room.latestTenant.companyName}</div>
                                {room.leaseEndDateForDisplay && (
                                  <div className="text-[10px] opacity-90">
                                    {room.leaseEndDateForDisplay}到期
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {tooltip && (
            <div
              className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-4 max-w-sm text-sm"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="font-medium mb-2">
                {tooltip.room.roomNumber} {tooltip.room.type}
              </div>
              <div className="text-slate-500 dark:text-slate-400 mb-2">
                管理面积 {tooltip.room.area}㎡ · {tooltip.room.leasingStatus}
              </div>
              {tooltip.room.tenants.length > 0 && (
                <div className="space-y-2">
                  {tooltip.room.tenants.map((t) => (
                    <div key={t.id} className="border-t border-slate-100 dark:border-slate-700 pt-2">
                      <div className="font-medium">{t.companyName}</div>
                      <div className="text-xs text-slate-500">
                        租赁面积 {t.leaseArea}㎡ · {t.leaseStartDate} 至 {t.leaseEndDate}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
          暂无数据
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  sub,
}: {
  title: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
      <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{sub}</div>
    </div>
  )
}
