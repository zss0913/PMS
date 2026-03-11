'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

type Room = {
  id: number
  name: string
  roomNumber: string
  area: { toString: () => string } | number
  buildingId: number
  floorId: number
  type: string
  status: string
  leasingStatus: string
  companyId: number
  createdAt: string
  building: { name: string }
  floor: { name: string }
  _count?: { tenantRooms: number }
}

type Building = { id: number; name: string }

const ROOM_TYPES = [
  { value: '', label: '全部类型' },
  { value: '商铺', label: '商铺' },
  { value: '写字楼', label: '写字楼' },
  { value: '住宅', label: '住宅' },
]
const ROOM_STATUSES = [
  { value: '', label: '全部状态' },
  { value: '空置', label: '空置' },
  { value: '已租', label: '已租' },
  { value: '自用', label: '自用' },
]
const LEASING_STATUSES = [
  { value: '', label: '全部招商' },
  { value: '可招商', label: '可招商' },
  { value: '不可招商', label: '不可招商' },
]

export function RoomList({ buildings, initialBuildingId }: { buildings: Building[]; initialBuildingId?: number }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    name: '',
    roomNumber: '',
    buildingId: initialBuildingId != null ? String(initialBuildingId) : '',
    status: '',
    leasingStatus: '',
  })

  const fetchRooms = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.name) params.set('name', filters.name)
      if (filters.roomNumber) params.set('roomNumber', filters.roomNumber)
      if (filters.buildingId) params.set('buildingId', filters.buildingId)
      if (filters.status) params.set('status', filters.status)
      if (filters.leasingStatus) params.set('leasingStatus', filters.leasingStatus)
      const res = await fetch(`/api/rooms?${params}`)
      const json = await res.json()
      if (!json.success) {
        setError(json.message || '加载失败')
        setRooms([])
        return
      }
      setRooms(json.data)
    } catch (e) {
      setError('网络错误')
      setRooms([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRooms()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该房源吗？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        fetchRooms()
      } else {
        alert(json.message || '删除失败')
      }
    } catch (e) {
      alert('网络错误')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRooms()
  }

  if (loading && rooms.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <form onSubmit={handleSearch} className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">房源名称</label>
            <input
              type="text"
              placeholder="搜索"
              value={filters.name}
              onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs text-slate-500 mb-1">房号</label>
            <input
              type="text"
              placeholder="搜索"
              value={filters.roomNumber}
              onChange={(e) => setFilters((p) => ({ ...p, roomNumber: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">所属楼宇</label>
            <select
              value={filters.buildingId}
              onChange={(e) => setFilters((p) => ({ ...p, buildingId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="">全部</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs text-slate-500 mb-1">房源状态</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {ROOM_STATUSES.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs text-slate-500 mb-1">招商状态</label>
            <select
              value={filters.leasingStatus}
              onChange={(e) => setFilters((p) => ({ ...p, leasingStatus: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {LEASING_STATUSES.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500"
          >
            <Search className="w-4 h-4" />
            筛选
          </button>
          <Link
            href="/rooms/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            新增房源
          </Link>
        </div>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">房源名称</th>
              <th className="text-left p-4 font-medium">房号</th>
              <th className="text-left p-4 font-medium">管理面积(㎡)</th>
              <th className="text-left p-4 font-medium">所属楼宇</th>
              <th className="text-left p-4 font-medium">所属楼层</th>
              <th className="text-left p-4 font-medium">房源类型</th>
              <th className="text-left p-4 font-medium">房源状态</th>
              <th className="text-left p-4 font-medium">招商状态</th>
              <th className="text-left p-4 font-medium">租客数量</th>
              <th className="text-left p-4 font-medium">创建时间</th>
              <th className="text-left p-4 font-medium w-36">操作</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{r.name}</td>
                <td className="p-4">{r.roomNumber}</td>
                <td className="p-4">{Number(r.area)}</td>
                <td className="p-4">{r.building?.name ?? '-'}</td>
                <td className="p-4">{r.floor?.name ?? '-'}</td>
                <td className="p-4">{r.type}</td>
                <td className="p-4">{r.status}</td>
                <td className="p-4">{r.leasingStatus}</td>
                <td className="p-4">{r._count?.tenantRooms ?? 0}</td>
                <td className="p-4">{formatDateTime(r.createdAt)}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <Link
                      href={`/rooms/${r.id}/edit`}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/tenants?roomId=${r.id}`}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                      title="查看租客列表"
                    >
                      <Users className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rooms.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新增房源」添加
        </div>
      )}
    </div>
  )
}
