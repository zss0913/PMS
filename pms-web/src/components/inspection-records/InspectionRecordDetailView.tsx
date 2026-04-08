'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  inspectionSeverityLabel,
  parseInspectionRecordDetail,
} from '@/lib/inspection-record-detail'

type RecordDto = {
  id: number
  taskId: number
  taskCode: string
  planName: string | null
  buildingId: number | null
  buildingName: string | null
  inspectionType: string
  tagId: string
  location: string
  checkedAt: string
  checkedBy: number
  checkedByName: string
  status: string
  detail: string | null
  linkedWorkOrder?: { id: number; code: string } | null
}

const statusLabel: Record<string, string> = {
  normal: '正常',
  abnormal: '异常',
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString('zh-CN')
  } catch {
    return s
  }
}

export function InspectionRecordDetailView({
  recordId,
  backHref = '/inspection-records',
  backLabel = '返回巡检记录列表',
}: {
  recordId: number
  /** 返回链接，默认巡检记录列表 */
  backHref?: string
  /** 返回文案（不含「←」前缀） */
  backLabel?: string
}) {
  const [data, setData] = useState<RecordDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [gallery, setGallery] = useState<{ urls: string[]; index: number } | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setErr('')
      try {
        const res = await fetch(`/api/inspection-records/${recordId}`, { credentials: 'include' })
        const json = await res.json()
        if (!json.success) {
          setErr(json.message || '加载失败')
          setData(null)
          return
        }
        setData(json.data as RecordDto)
      } catch {
        setErr('网络错误')
        setData(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [recordId])

  const openGallery = useCallback((urls: string[], index: number) => {
    if (urls.length === 0) return
    setGallery({ urls, index: Math.min(Math.max(0, index), urls.length - 1) })
  }, [])

  useEffect(() => {
    if (!gallery) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGallery(null)
      if (gallery.urls.length < 2) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setGallery((g) =>
          g ? { urls: g.urls, index: (g.index - 1 + g.urls.length) % g.urls.length } : null
        )
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setGallery((g) => (g ? { urls: g.urls, index: (g.index + 1) % g.urls.length } : null))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gallery])

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中…
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <p className="text-red-600 dark:text-red-400">{err || '无数据'}</p>
        <Link
          href={backHref}
          className="inline-block mt-4 text-sm text-blue-600 hover:underline"
        >
          {backLabel}
        </Link>
      </div>
    )
  }

  const parsed = parseInspectionRecordDetail(data.detail)

  const renderImages = (urls: string[]) => {
    if (urls.length === 0) return <p className="text-sm text-slate-500">无现场照片</p>
    return (
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            title="点击放大，支持左右切换"
            onClick={() => openGallery(urls, i)}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="text-sm text-blue-600 hover:underline">
          ← {backLabel}
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          巡检记录详情
        </h1>

        <section className="space-y-2 text-sm">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            任务与位置
          </h2>
          <dl className="grid gap-2 sm:grid-cols-2 text-slate-700 dark:text-slate-300">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">记录 ID</dt>
              <dd className="font-medium">{data.id}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">任务编号</dt>
              <dd className="font-medium">{data.taskCode}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">巡检计划</dt>
              <dd>{data.planName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">楼宇</dt>
              <dd>{data.buildingName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">巡检类型</dt>
              <dd>{data.inspectionType}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">巡检结果</dt>
              <dd className="font-medium">
                {statusLabel[data.status] ?? data.status}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">NFC 标签</dt>
              <dd className="font-mono text-xs break-all">{data.tagId}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">位置</dt>
              <dd>{data.location}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">检查时间</dt>
              <dd>{formatDate(data.checkedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">检查人</dt>
              <dd>{data.checkedByName}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3 text-sm border-t border-slate-200 dark:border-slate-700 pt-6">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            现场填报内容
          </h2>

          {parsed.kind === 'empty' && (
            <p className="text-slate-500">暂无附加填报信息</p>
          )}

          {parsed.kind === 'raw' && (
            <pre className="text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
              {parsed.text}
            </pre>
          )}

          {parsed.kind === 'normal' && (
            <div className="space-y-4">
              {parsed.remark != null && parsed.remark !== '' && (
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">情况说明</div>
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {parsed.remark}
                  </p>
                </div>
              )}
              <div>
                <div className="text-slate-500 dark:text-slate-400 mb-2">现场照片</div>
                {renderImages(parsed.images)}
              </div>
            </div>
          )}

          {parsed.kind === 'abnormal' && (
            <div className="space-y-4">
              {parsed.pointName && (
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">巡检点名称</div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {parsed.pointName}
                  </p>
                </div>
              )}
              <div>
                <div className="text-slate-500 dark:text-slate-400 mb-1">异常说明</div>
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {parsed.description || '—'}
                </p>
              </div>
              {parsed.severity && (
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">紧急程度</div>
                  <p>{inspectionSeverityLabel(parsed.severity)}</p>
                </div>
              )}
              <div>
                <div className="text-slate-500 dark:text-slate-400 mb-1">是否生成工单</div>
                {data.linkedWorkOrder ? (
                  <p className="text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-2">
                    <span>是</span>
                    <Link
                      href={`/work-orders/${data.linkedWorkOrder.id}`}
                      className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {data.linkedWorkOrder.code}
                    </Link>
                  </p>
                ) : parsed.submitWorkOrder ? (
                  <p>是</p>
                ) : (
                  <p>否</p>
                )}
              </div>
              {parsed.remark != null && parsed.remark !== '' && (
                <div>
                  <div className="text-slate-500 dark:text-slate-400 mb-1">补充说明</div>
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {parsed.remark}
                  </p>
                </div>
              )}
              <div>
                <div className="text-slate-500 dark:text-slate-400 mb-2">现场照片</div>
                {renderImages(parsed.images)}
              </div>
            </div>
          )}
        </section>
      </div>

      {gallery && gallery.urls.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/92"
          role="dialog"
          aria-modal="true"
          aria-label="现场照片预览"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white text-sm shrink-0">
            <span className="tabular-nums">
              {gallery.index + 1} / {gallery.urls.length}
            </span>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 hover:bg-white/10 text-white"
              onClick={() => setGallery(null)}
            >
              关闭
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center relative px-10 sm:px-14 min-h-0"
            onClick={() => setGallery(null)}
          >
            <button
              type="button"
              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-25"
              disabled={gallery.urls.length < 2}
              onClick={(e) => {
                e.stopPropagation()
                setGallery((g) =>
                  g
                    ? {
                        urls: g.urls,
                        index: (g.index - 1 + g.urls.length) % g.urls.length,
                      }
                    : null
                )
              }}
              aria-label="上一张"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              type="button"
              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-full hover:bg-white/10 disabled:opacity-25"
              disabled={gallery.urls.length < 2}
              onClick={(e) => {
                e.stopPropagation()
                setGallery((g) =>
                  g ? { urls: g.urls, index: (g.index + 1) % g.urls.length } : null
                )
              }}
              aria-label="下一张"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
            <img
              src={gallery.urls[gallery.index]}
              alt=""
              className="max-h-[min(85vh,100%)] max-w-full object-contain select-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <p className="text-center text-white/55 text-xs py-2 shrink-0">Esc 关闭，← → 切换</p>
        </div>
      )}
    </div>
  )
}
