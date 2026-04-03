'use client'

import { useState, useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Plus, Pencil, Trash2, Search, Eye, Upload, Download, X } from 'lucide-react'
import { AnnouncementForm } from './AnnouncementForm'
import QRCode from 'qrcode'
import Image from 'next/image'

export type Announcement = {
  id: number
  title: string
  content: string
  images: string | null
  scope: string
  buildingIds: number[]
  publishTime: string | null
  createdAt: string
  status: 'draft' | 'published' | 'offline'
  publisherName?: string | null
  publisherId?: number | null
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
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailAnnouncement, setDetailAnnouncement] = useState<Announcement | null>(null)
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
      setSelectedIds([])
    } catch {
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
    } catch {
      alert('网络错误')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEdit = (announcement: Announcement) => {
    if (announcement.status === 'offline') return
    setEditingAnnouncement(announcement)
    setFormOpen(true)
  }

  const handleViewDetail = (announcement: Announcement) => {
    setDetailAnnouncement(announcement)
    setDetailOpen(true)
  }

  const handleChangeStatus = async (
    announcement: Announcement,
    status: 'published' | 'offline'
  ) => {
    const actionText = status === 'published' ? '发布' : '下架'
    if (!confirm(`确定要${actionText}该公告吗？`)) return
    setChangingStatusId(announcement.id)
    try {
      const res = await fetch(`/api/announcements/${announcement.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.success) {
        await fetchData()
      } else {
        alert(json.message || `${actionText}失败`)
      }
    } catch {
      alert('网络错误')
    } finally {
      setChangingStatusId(null)
    }
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingAnnouncement(null)
    fetchData()
  }

  const list = data?.list ?? []
  const filtered = list.filter(
    (a) => !keyword || a.title.includes(keyword)
  )
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const allVisibleIds = paginatedItems.map((item) => item.id)
  const allChecked = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id))

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

  const getStatusText = (status: Announcement['status']) => {
    if (status === 'published') return '已发布'
    if (status === 'offline') return '已下架'
    return '草稿'
  }

  const getStatusStyle = (status: Announcement['status']) => {
    if (status === 'published') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    }
    if (status === 'offline') {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
  }

  const toggleRowChecked = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleAllVisible = () => {
    if (allChecked) {
      setSelectedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)))
      return
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])))
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
        <div className="text-sm text-slate-500">已勾选 {selectedIds.length} 条</div>
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
              <th className="text-left p-4 font-medium w-12">
                <input type="checkbox" checked={allChecked} onChange={toggleAllVisible} />
              </th>
              <th className="text-left p-4 font-medium">标题</th>
              <th className="text-left p-4 font-medium">发布范围</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium">发布时间</th>
              <th className="text-left p-4 font-medium w-[280px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((a) => (
              <tr
                key={a.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(a.id)}
                    onChange={() => toggleRowChecked(a.id)}
                  />
                </td>
                <td className="p-4 font-medium max-w-[300px] truncate">
                  <button
                    className="hover:text-blue-600 text-left"
                    onClick={() => handleViewDetail(a)}
                    type="button"
                  >
                    {a.title}
                  </button>
                </td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                  {getScopeText(a)}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusStyle(a.status)}`}
                  >
                    {getStatusText(a.status)}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                  {formatTime(a.publishTime || (a.status === 'draft' ? a.createdAt : null))}
                </td>
                <td className="p-4">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleViewDetail(a)}
                      className="px-2.5 py-1.5 text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded text-xs inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      详情
                    </button>
                    <button
                      onClick={() => handleEdit(a)}
                      disabled={a.status === 'offline'}
                      className="px-2.5 py-1.5 text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded text-xs inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      编辑
                    </button>
                    {a.status === 'draft' && (
                      <button
                        onClick={() => handleChangeStatus(a, 'published')}
                        disabled={changingStatusId === a.id}
                        className="px-2.5 py-1.5 text-green-700 border border-green-300 hover:bg-green-50 rounded text-xs inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        发布
                      </button>
                    )}
                    {a.status === 'published' && (
                      <button
                        onClick={() => handleChangeStatus(a, 'offline')}
                        disabled={changingStatusId === a.id}
                        className="px-2.5 py-1.5 text-orange-700 border border-orange-300 hover:bg-orange-50 rounded text-xs inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        下架
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id || a.status === 'offline'}
                      className="px-2.5 py-1.5 text-red-600 border border-red-200 hover:bg-red-50 rounded text-xs inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
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
      {filtered.length > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
      {formOpen && (
        <AnnouncementForm
          announcement={editingAnnouncement}
          buildings={data?.buildings ?? []}
          onClose={handleFormClose}
        />
      )}
      {detailOpen && detailAnnouncement && (
        <AnnouncementDetailModal
          announcement={detailAnnouncement}
          onClose={() => {
            setDetailOpen(false)
            setDetailAnnouncement(null)
          }}
          formatTime={formatTime}
        />
      )}
    </div>
  )
}

function AnnouncementDetailModal({
  announcement,
  onClose,
  formatTime,
}: {
  announcement: Announcement
  onClose: () => void
  formatTime: (s: string | null) => string
}) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const previewUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/preview/announcements/${announcement.id}`

  useEffect(() => {
    let active = true
    const buildQr = async () => {
      if (!previewUrl) return
      try {
        const url = await QRCode.toDataURL(previewUrl, {
          width: 220,
          margin: 1,
        })
        if (active) setQrDataUrl(url)
      } catch {
        if (active) setQrDataUrl('')
      }
    }
    void buildQr()
    return () => {
      active = false
    }
  }, [previewUrl])

  const publishTime =
    announcement.publishTime || (announcement.status === 'draft' ? announcement.createdAt : null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">公告详情与手机预览</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h3 className="text-base font-semibold mb-3">公告信息</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-slate-500">标题：</span>
                <span className="font-medium">{announcement.title}</span>
              </div>
              <div>
                <span className="text-slate-500">发布人：</span>
                <span>{announcement.publisherName || '待发布'}</span>
              </div>
              <div>
                <span className="text-slate-500">发布时间：</span>
                <span>{formatTime(publishTime)}</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 max-h-[46vh] overflow-y-auto">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: announcement.content || '<p>（无内容）</p>' }}
              />
            </div>
          </section>
          <section className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <h3 className="text-base font-semibold mb-3">手机端预览二维码</h3>
            <p className="text-sm text-slate-500 mb-3">
              手机扫码可打开移动端样式预览页，查看该公告在手机上的展示效果。
            </p>
            <div className="flex justify-center mb-3">
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="公告预览二维码"
                  width={208}
                  height={208}
                  unoptimized
                  className="w-52 h-52 border border-slate-200 rounded"
                />
              ) : (
                <div className="w-52 h-52 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 text-sm">
                  二维码生成中...
                </div>
              )}
            </div>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-xs break-all text-blue-600 underline"
            >
              {previewUrl}
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
