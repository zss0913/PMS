'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Building = { id: number; name: string }
type Room = { id: number; name: string; roomNumber: string }
type Tenant = { id: number; companyName: string }
type WorkOrderType = { id: number; name: string }

export function WorkOrderForm() {
  const router = useRouter()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [workOrderTypes, setWorkOrderTypes] = useState<WorkOrderType[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    buildingId: '',
    roomId: '',
    tenantId: '',
    source: 'PC端',
    type: '',
    title: '',
    description: '',
  })

  useEffect(() => {
    fetch('/api/work-orders')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setBuildings(json.data.buildings ?? [])
          setWorkOrderTypes(json.data.workOrderTypes ?? [])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!form.buildingId) {
      setRooms([])
      setTenants([])
      return
    }
    Promise.all([
      fetch(`/api/rooms?buildingId=${form.buildingId}`).then((r) => r.json()),
      fetch(`/api/tenants?buildingId=${form.buildingId}`).then((r) => r.json()),
    ]).then(([roomsRes, tenantsRes]) => {
      if (roomsRes.success && Array.isArray(roomsRes.data)) {
        setRooms(roomsRes.data.map((r: { id: number; name: string; roomNumber: string }) => ({ id: r.id, name: r.name, roomNumber: r.roomNumber })))
      } else {
        setRooms([])
      }
      if (tenantsRes.success && tenantsRes.data?.list) {
        setTenants(tenantsRes.data.list.map((t: { id: number; companyName: string }) => ({ id: t.id, companyName: t.companyName })))
      } else {
        setTenants([])
      }
    })
    setForm((p) => ({ ...p, roomId: '', tenantId: '' }))
  }, [form.buildingId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.buildingId || !form.roomId || !form.tenantId || !form.type || !form.title) {
      alert('请填写必填项')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: Number(form.buildingId),
          roomId: Number(form.roomId),
          tenantId: Number(form.tenantId),
          source: form.source,
          type: form.type,
          title: form.title,
          description: form.description,
        }),
      })
      const json = await res.json()
      if (json.success) {
        router.push('/work-orders')
      } else {
        alert(json.message || '创建失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-6">加载中...</div>
  }

  if (workOrderTypes.length === 0) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">请先配置工单类型</p>
        <p className="text-sm mt-1">在「工单类型」菜单中添加至少一个工单类型后再创建工单。</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">新建工单</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">楼宇 *</label>
          <select
            value={form.buildingId}
            onChange={(e) => setForm((p) => ({ ...p, buildingId: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            required
          >
            <option value="">请选择楼宇</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">房源 *</label>
          <select
            value={form.roomId}
            onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            required
          >
            <option value="">请选择房源</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber} - {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">租客 *</label>
          <select
            value={form.tenantId}
            onChange={(e) => setForm((p) => ({ ...p, tenantId: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            required
          >
            <option value="">请选择租客</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.companyName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">来源</label>
          <select
            value={form.source}
            onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          >
            <option value="PC端">PC端</option>
            <option value="小程序">小程序</option>
            <option value="电话">电话</option>
            <option value="现场">现场</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">工单类型 *</label>
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            required
          >
            <option value="">请选择类型</option>
            {workOrderTypes.map((wt) => (
              <option key={wt.id} value={wt.name}>
                {wt.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">标题 *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="请输入工单标题"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            rows={3}
            placeholder="请输入问题描述"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '创建工单'}
          </button>
        </div>
      </form>
    </div>
  )
}
