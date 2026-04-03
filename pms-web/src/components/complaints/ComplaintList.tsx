'use client'

import { useState, useEffect, useRef } from 'react'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { Search, UserPlus, CheckCircle } from 'lucide-react'

type Complaint = {
  id: number
  tenantId: number
  complainant: string
  description: string
  buildingId: number
  buildingName: string
  status: string
  images: string[]
  assignedTo: number | null
  assignedToName: string | null
  handledByName: string | null
  result: string | null
  createdAt: string
}

type Employee = { id: number; name: string }

type ApiData = {
  list: Complaint[]
  employees: Employee[]
  currentUserId: number
}

export function ComplaintList({
  isSuperAdmin = false,
}: {
  isSuperAdmin?: boolean
}) {
  const [keyword, setKeyword] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [acceptOpen, setAcceptOpen] = useState<Complaint | null>(null)
  const [acceptAssignee, setAcceptAssignee] = useState(0)

  const [finishOpen, setFinishOpen] = useState<Complaint | null>(null)
  const [finishResult, setFinishResult] = useState('')
  const [finishImages, setFinishImages] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/complaints', { credentials: 'include' })
      const json = await res.json()
      if (!json.success) {
        setError(json.message || '加载失败')
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const list = data?.list ?? []
  const employees = data?.employees ?? []
  const currentUserId = data?.currentUserId ?? 0

  const filtered = list.filter(
    (c) =>
      !keyword ||
      `C${String(c.id).padStart(5, '0')}`.toUpperCase().includes(keyword.toUpperCase()) ||
      c.complainant.includes(keyword) ||
      c.description.includes(keyword) ||
      c.buildingName.includes(keyword) ||
      c.status.includes(keyword)
  )
  const { page, pageSize, total, paginatedItems, handlePageChange, handlePageSizeChange } =
    usePagination(filtered, 15)

  const openAccept = (c: Complaint) => {
    setAcceptOpen(c)
    setAcceptAssignee(employees[0]?.id ?? 0)
  }

  const submitAccept = async () => {
    if (!acceptOpen || !acceptAssignee) {
      alert('请选择处理人')
      return
    }
    setBusyId(acceptOpen.id)
    try {
      const res = await fetch(`/api/complaints/${acceptOpen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: '处理中', assignedTo: acceptAssignee }),
      })
      const json = await res.json()
      if (json.success) {
        setAcceptOpen(null)
        fetchData()
      } else {
        alert(json.message || '操作失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setBusyId(null)
    }
  }

  const openFinish = (c: Complaint) => {
    setFinishOpen(c)
    setFinishResult('')
    setFinishImages([])
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const next = [...finishImages]
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/work-orders/upload-image', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        })
        const json = await res.json()
        if (json.success && json.data?.url) next.push(json.data.url as string)
      } catch {
        /* skip */
      }
    }
    setFinishImages(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  const submitFinish = async () => {
    if (!finishOpen || !finishResult.trim()) {
      alert('请填写处理结果')
      return
    }
    setBusyId(finishOpen.id)
    try {
      const res = await fetch(`/api/complaints/${finishOpen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: '已处理',
          result: finishResult.trim(),
          ...(finishImages.length > 0 ? { resultImages: finishImages } : {}),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setFinishOpen(null)
        fetchData()
      } else {
        alert(json.message || '操作失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setBusyId(null)
    }
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理卫生吐槽</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
      </div>
    )
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

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('zh-CN')
    } catch {
      return s
    }
  }

  const complaintCode = (id: number) => 'C' + String(id).padStart(5, '0')

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索编号、租客、内容、楼宇、状态"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <p className="text-sm text-slate-500">租客仅可在租客端提交吐槽</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">编号</th>
              <th className="text-left p-4 font-medium">租客</th>
              <th className="text-left p-4 font-medium">内容</th>
              <th className="text-left p-4 font-medium">楼宇</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium">处理人</th>
              <th className="text-left p-4 font-medium">创建时间</th>
              <th className="text-left p-4 font-medium w-44">操作</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((c) => (
              <tr
                key={c.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{complaintCode(c.id)}</td>
                <td className="p-4">{c.complainant}</td>
                <td className="p-4 max-w-[220px]">
                  <p className="truncate" title={c.description}>
                    {c.description}
                  </p>
                  {c.images.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">{c.images.length} 张图</p>
                  )}
                </td>
                <td className="p-4">{c.buildingName}</td>
                <td className="p-4">{c.status}</td>
                <td className="p-4 text-sm">
                  {c.status === '处理中' || c.status === '已处理' ? (
                    <span>{c.assignedToName ?? '-'}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-4">{formatDate(c.createdAt)}</td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    {c.status === '待处理' && (
                      <button
                        type="button"
                        onClick={() => openAccept(c)}
                        disabled={busyId === c.id}
                        className="flex items-center gap-1 text-sm text-amber-600 hover:underline disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                        受理并指派
                      </button>
                    )}
                    {c.status === '处理中' && c.assignedTo === currentUserId && (
                      <button
                        type="button"
                        onClick={() => openFinish(c)}
                        disabled={busyId === c.id}
                        className="flex items-center gap-1 text-sm text-green-600 hover:underline disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        办结
                      </button>
                    )}
                    {c.status === '处理中' && c.assignedTo !== currentUserId && (
                      <span className="text-xs text-slate-500">待指派人处理</span>
                    )}
                    {c.status === '已处理' && c.result && (
                      <span className="text-xs text-slate-500 line-clamp-2" title={c.result}>
                        结果：{c.result}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-12 text-center text-slate-500">暂无卫生吐槽</div>
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

      {acceptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-4 shadow-xl space-y-3">
            <h3 className="font-semibold">受理为处理中</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {complaintCode(acceptOpen.id)} · {acceptOpen.complainant}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">指派处理人 *</label>
              <select
                value={acceptAssignee}
                onChange={(e) => setAcceptAssignee(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                <option value={0}>请选择</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcceptOpen(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitAccept()}
                disabled={busyId != null}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white disabled:opacity-50"
              >
                确认受理
              </button>
            </div>
          </div>
        </div>
      )}

      {finishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-4 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">办结（已处理）</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {complaintCode(finishOpen.id)} · 请填写处理结果说明（必填）
            </p>
            <textarea
              value={finishResult}
              onChange={(e) => setFinishResult(e.target.value)}
              rows={4}
              placeholder="处理情况说明"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            />
            <div>
              <label className="block text-sm font-medium mb-1">处理现场图片（选填）</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                multiple
                onChange={(e) => void uploadFiles(e.target.files)}
                className="text-sm"
              />
              {finishImages.length > 0 && (
                <ul className="mt-2 text-xs text-slate-500 space-y-1">
                  {finishImages.map((u, i) => (
                    <li key={i} className="truncate">
                      {u}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFinishOpen(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitFinish()}
                disabled={busyId != null}
                className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50"
              >
                确认办结
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
