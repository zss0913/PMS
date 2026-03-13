'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Device } from './DeviceList'

const DEVICE_STATUSES = [
  { value: '正常', label: '正常' },
  { value: '维修中', label: '维修中' },
  { value: '报废', label: '报废' },
] as const

type Building = { id: number; name: string }

export function DeviceForm({
  device,
  buildings,
  onClose,
}: {
  device: Device | null
  buildings: Building[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [buildingId, setBuildingId] = useState<number>(0)
  const [status, setStatus] = useState<string>('正常')
  const [location, setLocation] = useState('')
  const [maintenanceContact, setMaintenanceContact] = useState('')
  const [supplier, setSupplier] = useState('')
  const [brand, setBrand] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!device

  useEffect(() => {
    if (device) {
      setName(device.name)
      setType(device.type)
      setBuildingId(device.buildingId)
      setStatus(device.status)
      setLocation(device.location ?? '')
      setMaintenanceContact(device.maintenanceContact ?? '')
      setSupplier(device.supplier ?? '')
      setBrand(device.brand ?? '')
    } else {
      setName('')
      setType('')
      setBuildingId(buildings[0]?.id ?? 0)
      setStatus('正常')
      setLocation('')
      setMaintenanceContact('')
      setSupplier('')
      setBrand('')
    }
  }, [device, buildings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body = {
        name,
        type,
        buildingId,
        status,
        location: location.trim(),
        maintenanceContact: maintenanceContact.trim(),
        supplier: supplier.trim(),
        brand: brand.trim(),
      }
      const url = isEdit ? `/api/devices/${device!.id}` : '/api/devices'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        onClose()
      } else {
        setError(json.message || '操作失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? '编辑设备' : '新增设备'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="device-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">设备名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入设备名称"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">设备类型</label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="如电梯、空调、消防"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">所属楼宇</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              required
            >
              <option value={0}>请选择楼宇</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              required
            >
              {DEVICE_STATUSES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">具体位置</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="选填"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">维修联系人</label>
            <input
              type="text"
              value={maintenanceContact}
              onChange={(e) => setMaintenanceContact(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="选填"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">厂家</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="选填"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">品牌</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="选填"
            />
          </div>
        </form>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            type="submit"
            form="device-form"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
