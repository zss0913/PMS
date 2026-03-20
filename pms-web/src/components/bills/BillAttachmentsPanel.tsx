'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDateTime } from '@/lib/utils'
import { previewKind } from '@/lib/bill-attachments'
import { FileText, ImageIcon, Loader2, Trash2, Download, Eye } from 'lucide-react'

const PAGE_SIZE = 5

type Row = {
  id: number
  originalName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function BillAttachmentsPanel({ billId }: { billId: number }) {
  const [list, setList] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [maxCount, setMaxCount] = useState(50)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<
    | { type: 'image' | 'pdf'; url: string; title: string }
    | { type: 'csv'; text: string; title: string }
    | { type: 'office'; url: string; title: string }
    | null
  >(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fileUrl = (id: number, download?: boolean) =>
    `/api/bills/${billId}/attachments/${id}/file${download ? '?download=1' : ''}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/bills/${billId}/attachments?page=${page}&pageSize=${PAGE_SIZE}`
      )
      const j = await res.json()
      if (j.success && j.data) {
        setList(j.data.list)
        setTotal(j.data.total)
        setMaxCount(j.data.maxCount ?? 50)
      }
    } finally {
      setLoading(false)
    }
  }, [billId, page])

  useEffect(() => {
    void load()
  }, [load])

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(`/api/bills/${billId}/attachments`, {
          method: 'POST',
          body: fd,
        })
        const j = await res.json()
        if (!j.success) {
          alert(j.message || '上传失败')
          break
        }
      }
      if (page !== 1) setPage(1)
      else await load()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const onDelete = async (id: number, name: string) => {
    if (!window.confirm(`确定删除「${name}」？`)) return
    const res = await fetch(`/api/bills/${billId}/attachments/${id}`, { method: 'DELETE' })
    const j = await res.json()
    if (!j.success) {
      alert(j.message || '删除失败')
      return
    }
    const newTotal = total - 1
    const maxPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
    if (page > maxPage) setPage(maxPage)
    else await load()
  }

  const openPreview = async (row: Row) => {
    const kind = previewKind(row.mimeType)
    const title = row.originalName
    const url = fileUrl(row.id)

    if (kind === 'image' || kind === 'pdf') {
      setPreview({ type: kind, url, title })
      return
    }
    if (row.mimeType.toLowerCase().includes('csv') || /\.csv$/i.test(row.originalName)) {
      try {
        const res = await fetch(url)
        const text = await res.text()
        setPreview({ type: 'csv', text, title })
      } catch {
        alert('无法读取文件内容')
      }
      return
    }
    if (kind === 'office') {
      setPreview({ type: 'office', url, title })
      return
    }
    window.open(fileUrl(row.id, true), '_blank')
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canUpload = total < maxCount

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.doc,.docx,.xls,.xlsx,.csv"
          onChange={onPickFiles}
          disabled={uploading || !canUpload}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !canUpload}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          上传附件
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          已上传 {total} / {maxCount}，支持图片、PDF、Word、Excel、CSV；单文件 ≤ 20MB
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-8 text-center">加载中...</p>
      ) : total === 0 ? (
        <p className="text-sm text-slate-500 py-6">暂无附件</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 text-left">
                  <th className="p-3 font-medium">文件名</th>
                  <th className="p-3 font-medium whitespace-nowrap">大小</th>
                  <th className="p-3 font-medium whitespace-nowrap">上传时间</th>
                  <th className="p-3 font-medium whitespace-nowrap w-48">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => {
                  const k = previewKind(row.mimeType)
                  const canPreview =
                    k === 'image' ||
                    k === 'pdf' ||
                    k === 'office' ||
                    row.mimeType.toLowerCase().includes('csv') ||
                    /\.csv$/i.test(row.originalName)
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 dark:border-slate-700/80 align-top"
                    >
                      <td className="p-3">
                        <span className="inline-flex items-center gap-2 min-w-0 break-all">
                          {k === 'image' ? (
                            <ImageIcon className="w-4 h-4 shrink-0 text-slate-400" />
                          ) : (
                            <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                          )}
                          {row.originalName}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {formatBytes(row.sizeBytes)}
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {canPreview ? (
                            <button
                              type="button"
                              onClick={() => openPreview(row)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400 text-sm"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              预览
                            </button>
                          ) : null}
                          <a
                            href={fileUrl(row.id, true)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400 text-sm"
                            download
                          >
                            <Download className="w-3.5 h-3.5" />
                            下载
                          </a>
                          <button
                            type="button"
                            onClick={() => onDelete(row.id, row.originalName)}
                            className="inline-flex items-center gap-1 text-red-600 hover:underline dark:text-red-400 text-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
              >
                上一页
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-600">
              <h3 className="text-sm font-medium truncate min-w-0">{preview.title}</h3>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="shrink-0 px-3 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 min-h-[200px]">
              {preview.type === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt=""
                  className="max-w-full max-h-[70vh] mx-auto object-contain"
                />
              )}
              {preview.type === 'pdf' && (
                <iframe
                  title="pdf"
                  src={preview.url}
                  className="w-full min-h-[70vh] rounded border border-slate-200 dark:border-slate-600"
                />
              )}
              {preview.type === 'csv' && (
                <pre className="text-xs whitespace-pre-wrap break-words max-h-[70vh] overflow-auto bg-slate-50 dark:bg-slate-900/50 p-3 rounded">
                  {preview.text}
                </pre>
              )}
              {preview.type === 'office' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Word / Excel 在浏览器中可能无法直接预览，请使用下载后在本地打开。
                  </p>
                  <iframe
                    title="office"
                    src={preview.url}
                    className="w-full min-h-[50vh] rounded border border-slate-200 dark:border-slate-600"
                  />
                  <a
                    href={`${preview.url}?download=1`}
                    className="inline-flex text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    下载文件
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
