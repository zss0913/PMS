'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { NfcTag } from './NfcTagList'

const INSPECTION_TYPES = [
  { value: '工程', label: '工程' },
  { value: '安保', label: '安保' },
  { value: '设备', label: '设备' },
  { value: '绿化', label: '绿化' },
] as const

type Building = { id: number; name: string }

export function NfcTagForm({
  tag,
  buildings,
  onClose,
}: {
  tag: NfcTag | null
  buildings: Building[]
  onClose: () => void
}) {
  const [tagId, setTagId] = useState('')
  const [buildingId, setBuildingId] = useState<number>(0)
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [inspectionType, setInspectionType] = useState<string>('工程')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!tag

  useEffect(() => {
    if (tag) {
      setTagId(tag.tagId)
      setBuildingId(tag.buildingId)
      setLocation(tag.location)
      setDescription(tag.description ?? '')
      setInspectionType(tag.inspectionType)
    } else {
      setTagId('')
      setBuildingId(buildings[0]?.id ?? 0)
      setLocation('')
      setDescription('')
      setInspectionType('工程')
    }
  }, [tag, buildings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body = {
        tagId,
        buildingId,
        location,
        description,
        inspectionType,
      }
      const url = isEdit ? `/api/nfc-tags/${tag!.id}` : '/api/nfc-tags'
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
            {isEdit ? '编辑NFC标签' : '新增NFC标签'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="nfc-tag-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">NFC ID</label>
            <input
              type="text"
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入NFC标签ID"
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
            <label className="block text-sm font-medium mb-1">位置名称</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入具体位置"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">说明</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="选填"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">巡检类型</label>
            <select
              value={inspectionType}
              onChange={(e) => setInspectionType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              required
            >
              {INSPECTION_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
            form="nfc-tag-form"
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
