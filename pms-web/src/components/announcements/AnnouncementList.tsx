'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { AnnouncementForm } from './AnnouncementForm'

export type Announcement = {
  id: number
  title: string
  content: string
  images: string | null
  scope: string
  buildingIds: number[]
  publishTime: string | null
  status: string
  readCount: number
}

type Building = { id: number; name: string }

type ApiData = {
  list: Announcement[]
  buildings: Building[]
}

export function AnnouncementList() {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/announcements')
      const json = await res.json()
      if (!json.success) {
        setError(json.message || '加载失败')
        setData(null)
        return
      }
      setData(json.data)
    } catch (e) {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除该公告吗？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        fetchData()
      } else {
        alert(json.message || '删除失败')
      }
    } catch (e) {
      alert('网络错误')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingAnnouncement(null)
    fetchData()
  }

  const getScopeText = (a: Announcement) => {
    if (a.scope === 'all') return '全部楼宇'
    if (a.buildingIds?.length) {
      const names = a.buildingIds
        .map((id) => data?.buildings.find((b) => b.id === id)?.name)
        .filter(Boolean)
      return names.length ? `指定: ${names.join('、')}` : '指定楼宇'
    }
    return '指定楼宇'
  }

  const formatTime = (s: string | null) => {
    if (!s) return '-'
    const d = new Date(s)
    return d.toLocaleString('zh-CN')
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

  const list = data?.list ?? []
  const filtered = list.filter(
    (a) => !keyword || a.title.includes(keyword)
  )

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索公告标题"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingAnnouncement(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增公告
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">标题</th>
              <th className="text-left p-4 font-medium">发布范围</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium">发布时间</th>
              <th className="text-left p-4 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium max-w-[300px] truncate">{a.title}</td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                  {getScopeText(a)}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      a.status === 'published'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {a.status === 'published' ? '已发布' : '草稿'}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                  {formatTime(a.publishTime)}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(a)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-50"
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
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无数据，点击「新增公告」添加
        </div>
      )}
      {formOpen && (
        <AnnouncementForm
          announcement={editingAnnouncement}
          buildings={data?.buildings ?? []}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
