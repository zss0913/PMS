'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'

type Building = { id: number; name: string }
type Floor = { id: number; name: string }

const ROOM_TYPES = [
  { value: '商铺', label: '商铺' },
  { value: '写字楼', label: '写字楼' },
  { value: '住宅', label: '住宅' },
]
const ROOM_STATUSES = [
  { value: '空置', label: '空置' },
  { value: '已租', label: '已租' },
  { value: '自用', label: '自用' },
]
const LEASING_STATUSES = [
  { value: '可招商', label: '可招商' },
  { value: '不可招商', label: '不可招商' },
]

type FormData = {
  name: string
  roomNumber: string
  area: string
  buildingId: number | null
  floorId: number | null
  type: string
  status: string
  leasingStatus: string
}

export function RoomForm({
  mode,
  id,
  buildings,
  initialData,
}: {
  mode: 'new' | 'edit'
  id?: number
  buildings: Building[]
  initialData?: FormData | null
}) {
  const router = useRouter()
  const [floors, setFloors] = useState<Floor[]>([])
  const [loadingFloors, setLoadingFloors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormData>({
    name: initialData?.name ?? '',
    roomNumber: initialData?.roomNumber ?? '',
    area: initialData?.area ?? '',
    buildingId: initialData?.buildingId ?? null,
    floorId: initialData?.floorId ?? null,
    type: initialData?.type ?? '商铺',
    status: initialData?.status ?? '空置',
    leasingStatus: initialData?.leasingStatus ?? '可招商',
  })

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        roomNumber: initialData.roomNumber,
        area: initialData.area,
        buildingId: initialData.buildingId,
        floorId: initialData.floorId,
        type: initialData.type,
        status: initialData.status,
        leasingStatus: initialData.leasingStatus,
      })
    }
  }, [initialData])

  useEffect(() => {
    if (!form.buildingId) {
      setFloors([])
      setForm((p) => ({ ...p, floorId: null }))
      return
    }
    setLoadingFloors(true)
    fetch(`/api/floors?buildingId=${form.buildingId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setFloors(json.data)
          setForm((p) => {
            const floorExists = json.data.some((f: Floor) => f.id === p.floorId)
            return { ...p, floorId: floorExists ? p.floorId : (json.data[0]?.id ?? null) }
          })
        } else {
          setFloors([])
        }
      })
      .catch(() => setFloors([]))
      .finally(() => setLoadingFloors(false))
  }, [form.buildingId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      alert('请输入房源名称')
      return
    }
    if (!form.roomNumber.trim()) {
      alert('请输入房号')
      return
    }
    const areaNum = parseFloat(form.area)
    if (isNaN(areaNum) || areaNum < 0) {
      alert('请输入有效的管理面积')
      return
    }
    if (!form.buildingId) {
      alert('请选择所属楼宇')
      return
    }
    if (!form.floorId) {
      alert('请选择所属楼层')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        roomNumber: form.roomNumber.trim(),
        area: areaNum,
        buildingId: form.buildingId,
        floorId: form.floorId,
        type: form.type,
        status: form.status,
        leasingStatus: form.leasingStatus,
      }
      const url = mode === 'edit' && id ? `/api/rooms/${id}` : '/api/rooms'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        router.push('/rooms')
        router.refresh()
      } else {
        alert(json.message || '保存失败')
      }
    } catch (e) {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <AppLink
          href="/rooms"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </AppLink>
      </div>
      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">房源名称 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入房源名称"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">房号 *</label>
          <input
            type="text"
            value={form.roomNumber}
            onChange={(e) => setForm((p) => ({ ...p, roomNumber: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入房号"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">管理面积(㎡) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.area}
            onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入管理面积"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">所属楼宇 *</label>
          <select
            value={form.buildingId ?? ''}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                buildingId: e.target.value ? parseInt(e.target.value, 10) : null,
                floorId: null,
              }))
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">请选择楼宇</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">所属楼层 *</label>
          <select
            value={form.floorId ?? ''}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                floorId: e.target.value ? parseInt(e.target.value, 10) : null,
              }))
            }
            disabled={!form.buildingId || loadingFloors}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 disabled:opacity-50"
          >
            <option value="">{loadingFloors ? '加载中...' : form.buildingId ? '请选择楼层' : '请先选择楼宇'}</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">房源类型 *</label>
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            {ROOM_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">房源状态 *</label>
          <select
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            {ROOM_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">招商状态 *</label>
          <select
            value={form.leasingStatus}
            onChange={(e) => setForm((p) => ({ ...p, leasingStatus: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            {LEASING_STATUSES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
          <AppLink
            href="/rooms"
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </AppLink>
        </div>
      </form>
    </div>
  )
}
