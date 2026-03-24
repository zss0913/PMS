'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorkOrderImageUpload } from '@/components/work-orders/WorkOrderImageUpload'

/**
 * PC 端编辑工单：与新建页一致，仅展示当前接口允许修改的字段（标题、描述、图片）。
 * 楼宇、类型、租客等不可改，不在此页展示。
 */
export function WorkOrderEditForm({
  workOrderId,
  code,
  title: initialTitle,
  description: initialDescription,
  imageUrls: initialImageUrls,
}: {
  workOrderId: number
  code: string
  title: string
  description: string
  imageUrls: string[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [imageUrls, setImageUrls] = useState<string[]>(initialImageUrls)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      alert('标题不能为空')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        router.push(`/work-orders/${workOrderId}`)
        router.refresh()
      } else {
        alert(json.message || '保存失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-w-2xl">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
        本页与「新建工单」相同，仅包含可编辑项：<strong>标题、描述、现场图片</strong>。楼宇、工单类型、房源、租客等创建后不可在此修改，请在工单详情中查看。
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
        工单编号{' '}
        <span className="font-mono text-slate-800 dark:text-slate-100">{code}</span>
      </p>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">标题 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">图片（选填）</label>
          <WorkOrderImageUpload urls={imageUrls} onChange={setImageUrls} />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/work-orders/${workOrderId}`)}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            返回详情
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
