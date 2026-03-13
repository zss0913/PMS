'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLink } from '@/components/AppLink'
import { ArrowLeft } from 'lucide-react'

type Building = { id: number; name: string }
type Room = { id: number; name: string; roomNumber: string; area: number }

type TenantRoomInput = { roomId: number; leaseArea: number }

type FormData = {
  type: '租客' | '业主'
  companyName: string
  buildingId: number | null
  roomIds: TenantRoomInput[]
  moveInDate: string
  leaseStartDate: string
  leaseEndDate: string
}

export function TenantForm({
  mode,
  id,
}: {
  mode: 'new' | 'edit'
  id?: number
}) {
  const router = useRouter()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    type: '租客',
    companyName: '',
    buildingId: null,
    roomIds: [],
    moveInDate: '',
    leaseStartDate: '',
    leaseEndDate: '',
  })

  const loadBuildings = async () => {
    const res = await fetch('/api/tenants')
    const json = await res.json()
    if (json.success && json.data.buildings) {
      setBuildings(json.data.buildings)
    }
  }

  const loadRooms = async (buildingId: number) => {
    const res = await fetch(`/api/rooms?buildingId=${buildingId}`)
    const json = await res.json()
    const list = json.success && json.data
      ? (Array.isArray(json.data) ? json.data : json.data.list)
      : []
    setRooms(list)
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        await loadBuildings()
        if (mode === 'edit' && id) {
          const res = await fetch(`/api/tenants/${id}`)
          const json = await res.json()
          if (!json.success) {
            setError(json.message || '加载失败')
            return
          }
          const { tenant, buildings: bList } = json.data
          if (bList) setBuildings(bList)
          setForm({
            type: tenant.type as '租客' | '业主',
            companyName: tenant.companyName,
            buildingId: tenant.buildingId,
            roomIds: tenant.tenantRooms?.map((tr: { roomId: number; leaseArea: number | string }) => ({
              roomId: tr.roomId,
              leaseArea: Number(tr.leaseArea ?? 0),
            })) ?? [],
            moveInDate: tenant.moveInDate,
            leaseStartDate: tenant.leaseStartDate,
            leaseEndDate: tenant.leaseEndDate,
          })
        }
      } catch {
        setError('网络错误')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [mode, id])

  useEffect(() => {
    if (form.buildingId) {
      loadRooms(form.buildingId)
    } else {
      setRooms([])
      setForm((p) => ({ ...p, roomIds: [] }))
    }
  }, [form.buildingId])

  const toggleRoom = (room: Room) => {
    setForm((prev) => {
      const exists = prev.roomIds.find((r) => r.roomId === room.id)
      let newRoomIds: TenantRoomInput[]
      if (exists) {
        newRoomIds = prev.roomIds.filter((r) => r.roomId !== room.id)
      } else {
        newRoomIds = [...prev.roomIds, { roomId: room.id, leaseArea: Number(room.area ?? 0) }]
      }
      return { ...prev, roomIds: newRoomIds }
    })
  }

  const updateRoomLeaseArea = (roomId: number, leaseArea: number) => {
    setForm((prev) => ({
      ...prev,
      roomIds: prev.roomIds.map((r) =>
        r.roomId === roomId ? { ...r, leaseArea } : r
      ),
    }))
  }

  const totalArea = form.roomIds.reduce((sum, r) => sum + Number(r.leaseArea ?? 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.companyName.trim()) {
      alert('请输入公司名称')
      return
    }
    if (!form.buildingId) {
      alert('请选择所属楼宇')
      return
    }
    if (form.roomIds.length === 0) {
      alert('请至少选择一个租赁房源')
      return
    }
    if (!form.moveInDate || !form.leaseStartDate || !form.leaseEndDate) {
      alert('请填写入住日期和租期')
      return
    }
    const leaseStart = new Date(form.leaseStartDate)
    const leaseEnd = new Date(form.leaseEndDate)
    if (leaseEnd <= leaseStart) {
      alert('租期结束日期必须大于开始日期')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        type: form.type,
        companyName: form.companyName.trim(),
        buildingId: form.buildingId,
        roomIds: form.roomIds,
        moveInDate: form.moveInDate,
        leaseStartDate: form.leaseStartDate,
        leaseEndDate: form.leaseEndDate,
      }
      const url = mode === 'edit' && id ? `/api/tenants/${id}` : '/api/tenants'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        router.push('/tenants')
        router.refresh()
      } else {
        alert(json.message || '保存失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
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
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <AppLink
          href="/tenants"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </AppLink>
      </div>
      <form onSubmit={handleSubmit} className="p-6 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">租客类型 *</label>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((p) => ({ ...p, type: e.target.value as '租客' | '业主' }))
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="租客">租客</option>
            <option value="业主">业主</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">公司名称 *</label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入公司名称"
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
                roomIds: [],
              }))
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="">请选择</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">租赁房源（多选，须同楼宇）*</label>
          {!form.buildingId ? (
            <p className="text-slate-500 text-sm py-2">请先选择所属楼宇</p>
          ) : rooms.length === 0 ? (
            <p className="text-slate-500 text-sm py-2">该楼宇暂无房源</p>
          ) : (
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 max-h-48 overflow-y-auto bg-white dark:bg-slate-700">
              <div className="space-y-3">
                {rooms.map((room) => {
                  const selected = form.roomIds.find((r) => r.roomId === room.id)
                  return (
                    <div
                      key={room.id}
                      className="flex items-center gap-4 flex-wrap"
                    >
                      <label className="flex items-center gap-2 cursor-pointer min-w-[140px]">
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => toggleRoom(room)}
                          className="rounded"
                        />
                        <span>
                          {room.roomNumber} {room.name}
                        </span>
                      </label>
                      {selected && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">租赁面积:</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={selected.leaseArea ?? ''}
                            onChange={(e) =>
                              updateRoomLeaseArea(
                                room.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                          />
                          <span className="text-sm text-slate-500">㎡</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">租赁面积(㎡)</label>
          <p className="py-2 text-slate-600 dark:text-slate-400">
            合计: <strong>{totalArea.toFixed(2)}</strong> ㎡
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">入住日期 *</label>
          <input
            type="date"
            value={form.moveInDate}
            onChange={(e) => setForm((p) => ({ ...p, moveInDate: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">租期开始 *</label>
            <input
              type="date"
              value={form.leaseStartDate}
              onChange={(e) =>
                setForm((p) => ({ ...p, leaseStartDate: e.target.value }))
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">租期结束 *</label>
            <input
              type="date"
              value={form.leaseEndDate}
              onChange={(e) =>
                setForm((p) => ({ ...p, leaseEndDate: e.target.value }))
              }
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
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
            href="/tenants"
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </AppLink>
        </div>
      </form>
    </div>
  )
}
