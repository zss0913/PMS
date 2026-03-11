'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Announcement } from './AnnouncementList'

type Building = { id: number; name: string }

export function AnnouncementForm({
  announcement,
  buildings,
  onClose,
}: {
  announcement: Announcement | null
  buildings: Building[]
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scope, setScope] = useState<'all' | 'specified'>('all')
  const [buildingIds, setBuildingIds] = useState<number[]>([])
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!announcement

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title)
      setContent(announcement.content)
      setScope((announcement.scope as 'all' | 'specified') || 'all')
      setBuildingIds(announcement.buildingIds ?? [])
      setStatus((announcement.status as 'draft' | 'published') || 'draft')
    } else {
      setTitle('')
      setContent('')
      setScope('all')
      setBuildingIds([])
      setStatus('draft')
    }
  }, [announcement])

  const toggleBuilding = (id: number) => {
    setBuildingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        title,
        content,
        scope,
        buildingIds: scope === 'specified' ? buildingIds : [],
        status,
      }

      const url = isEdit ? `/api/announcements/${announcement!.id}` : '/api/announcements'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        onClose()
      } else {
        setError(json.message || '操作失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? '编辑公告' : '新增公告'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          id="announcement-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入公告标题"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 resize-y"
              placeholder="请输入公告内容"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">发布范围</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'all' | 'specified')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="all">全部楼宇</option>
              <option value="specified">指定楼宇</option>
            </select>
          </div>
          {scope === 'specified' && (
            <div>
              <label className="block text-sm font-medium mb-1">指定楼宇</label>
              <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1">
                {buildings.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={buildingIds.includes(b.id)}
                      onChange={() => toggleBuilding(b.id)}
                    />
                    <span className="text-sm">{b.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
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
            form="announcement-form"
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
