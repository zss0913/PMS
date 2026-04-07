'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, User, X, ChevronLeft, ChevronRight } from 'lucide-react'

function isMediaVideoUrl(path: string) {
  return /\.(mp4|mov|webm)(\?.*)?$/i.test(path)
}

/** 吐槽附图 / 处理附图：网格展示图片+视频，全屏左右切换预览 */
function ComplaintMediaGallery({ urls }: { urls: string[] }) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const openAt = (i: number) => {
    setLightboxIndex(i)
    setLightboxOpen(true)
  }

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i - 1 + urls.length) % urls.length)
  }, [urls.length])

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i + 1) % urls.length)
  }, [urls.length])

  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxOpen, goPrev, goNext])

  if (!urls.length) return null

  const current = urls[lightboxIndex]

  return (
    <>
      <div className="flex flex-wrap gap-3 pt-2">
        {urls.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => openAt(i)}
            className="relative block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-[200px] h-[200px] bg-slate-100 dark:bg-slate-900 shrink-0 text-left"
          >
            {isMediaVideoUrl(url) ? (
              <video
                src={url}
                className="w-full h-full object-cover pointer-events-none"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="w-full h-full object-cover" />
            )}
            {isMediaVideoUrl(url) && (
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-black/60 text-white">
                视频
              </span>
            )}
          </button>
        ))}
      </div>

      {lightboxOpen && (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 z-0 w-full h-full bg-black/88 cursor-default border-0 p-0"
            aria-label="关闭预览"
            onClick={() => setLightboxOpen(false)}
          />
          <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
            <div className="flex items-center justify-between px-4 py-3 text-white/90 pointer-events-auto shrink-0">
              <span className="text-sm">
                {lightboxIndex + 1} / {urls.length}
              </span>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-white/10"
                aria-label="关闭"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 relative flex items-center justify-center min-h-0 px-2 md:px-10 pointer-events-none">
              {urls.length > 1 && (
                <button
                  type="button"
                  className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/90 hover:bg-white/10 z-20 pointer-events-auto"
                  aria-label="上一张"
                  onClick={(e) => {
                    e.stopPropagation()
                    goPrev()
                  }}
                >
                  <ChevronLeft className="w-9 h-9 md:w-10 md:h-10" />
                </button>
              )}
              <div className="max-w-[min(96vw,1200px)] max-h-[min(85vh,calc(100vh-100px))] flex items-center justify-center pointer-events-auto">
                {isMediaVideoUrl(current) ? (
                  <video
                    key={lightboxIndex}
                    src={current}
                    controls
                    playsInline
                    className="max-h-[min(85vh,calc(100vh-100px))] max-w-full rounded-lg shadow-lg"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={lightboxIndex}
                    src={current}
                    alt=""
                    className="max-h-[min(85vh,calc(100vh-100px))] max-w-full object-contain rounded-lg shadow-lg"
                  />
                )}
              </div>
              {urls.length > 1 && (
                <button
                  type="button"
                  className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/90 hover:bg-white/10 z-20 pointer-events-auto"
                  aria-label="下一张"
                  onClick={(e) => {
                    e.stopPropagation()
                    goNext()
                  }}
                >
                  <ChevronRight className="w-9 h-9 md:w-10 md:h-10" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

type TimelineItem = {
  id: number | null
  action: string
  summary: string
  operatorType: string
  operatorName: string | null
  operatorId: number | null
  createdAt: string
  synthetic?: boolean
}

type DetailData = {
  id: number
  code: string
  status: string
  location: string
  description: string
  images: string[]
  result: string | null
  resultImages: string[]
  buildingName: string
  tenantName: string
  tenantRooms: { floorName: string; roomNumber: string; roomName: string }[]
  reporter: { id: number; name: string; phone: string }
  assignedToName: string | null
  handledByName: string | null
  handledAt: string | null
  createdAt: string
  timeline: TimelineItem[]
}

export function ComplaintDetail({ id }: { id: string }) {
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const res = await fetch(`/api/complaints/${id}`, { credentials: 'include' })
        const json = await res.json()
        if (!json.success) {
          if (!cancelled) setErr(json.message || '加载失败')
          return
        }
        if (!cancelled) setData(json.data)
      } catch {
        if (!cancelled) setErr('网络错误')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('zh-CN')
    } catch {
      return iso
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-500">加载中...</div>
    )
  }
  if (err || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{err || '无数据'}</p>
        <Link href="/complaints" className="text-blue-600 mt-4 inline-block">
          返回列表
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/complaints"
          className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" />
          返回卫生吐槽
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          吐槽详情 {data.code}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          状态：<span className="font-medium text-slate-700 dark:text-slate-300">{data.status}</span>
        </p>
      </div>

      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <h2 className="text-lg font-semibold border-b border-slate-200 dark:border-slate-600 pb-2">
          基本信息
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">租客主体</dt>
            <dd className="font-medium">{data.tenantName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">楼宇</dt>
            <dd className="font-medium">{data.buildingName}</dd>
          </div>
          {data.tenantRooms.length === 1 ? (
            <>
              <div>
                <dt className="text-slate-500">楼层</dt>
                <dd className="font-medium">{data.tenantRooms[0].floorName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">房间号</dt>
                <dd className="font-medium">{data.tenantRooms[0].roomNumber}</dd>
              </div>
            </>
          ) : data.tenantRooms.length > 1 ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">楼层与房间（共 {data.tenantRooms.length} 间）</dt>
              <dd className="font-medium mt-1">
                <ul className="list-disc list-inside space-y-1 text-slate-800 dark:text-slate-200">
                  {data.tenantRooms.map((tr, i) => (
                    <li key={i}>
                      {tr.floorName} · {tr.roomNumber}
                      {tr.roomName && tr.roomName !== tr.roomNumber ? (
                        <span className="text-slate-500 font-normal">（{tr.roomName}）</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : (
            <>
              <div>
                <dt className="text-slate-500">楼层</dt>
                <dd className="text-slate-400">未关联</dd>
              </div>
              <div>
                <dt className="text-slate-500">房间号</dt>
                <dd className="text-slate-400">未关联</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-slate-500">提交人（租客账号）</dt>
            <dd className="font-medium">
              {data.reporter.name}
              {data.reporter.phone ? (
                <span className="text-slate-500 font-normal ml-2">{data.reporter.phone}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">提交时间</dt>
            <dd>{fmt(data.createdAt)}</dd>
          </div>
          {data.assignedToName && (
            <div>
              <dt className="text-slate-500">指派处理人</dt>
              <dd className="font-medium">{data.assignedToName}</dd>
            </div>
          )}
          {data.status === '已处理' && data.handledByName && (
            <div>
              <dt className="text-slate-500">办结人 / 办结时间</dt>
              <dd>
                {data.handledByName}
                {data.handledAt ? ` · ${fmt(data.handledAt)}` : ''}
              </dd>
            </div>
          )}
        </dl>
        {data.location ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="text-slate-500">位置说明：</span>
            {data.location}
          </p>
        ) : null}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
        <h2 className="text-lg font-semibold border-b border-slate-200 dark:border-slate-600 pb-2">
          吐槽内容（租客提交）
        </h2>
        <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
          {data.description || '（无文字说明）'}
        </p>
        <ComplaintMediaGallery urls={data.images} />
      </section>

      {data.status === '已处理' && (data.result || data.resultImages.length > 0) && (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
          <h2 className="text-lg font-semibold border-b border-slate-200 dark:border-slate-600 pb-2">
            处理结果
          </h2>
          {data.result ? (
            <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {data.result}
            </p>
          ) : null}
          <ComplaintMediaGallery urls={data.resultImages} />
        </section>
      )}

      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <h2 className="text-lg font-semibold border-b border-slate-200 dark:border-slate-600 pb-2">
          操作日志
        </h2>
        <p className="text-xs text-slate-500">
          按时间顺序展示：自提交起的处理动作。上线后新数据为精确日志；旧记录在无任何日志时由系统根据当前字段推断并标注。
        </p>
        <ul className="space-y-0 border-l-2 border-slate-200 dark:border-slate-600 ml-2 pl-4">
          {data.timeline.map((item, idx) => (
            <li key={item.id ?? `syn-${idx}`} className="relative pb-8 last:pb-0">
              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-800" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <time className="text-slate-500">{fmt(item.createdAt)}</time>
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium">
                  {item.action}
                </span>
                {item.synthetic && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">（推断）</span>
                )}
              </div>
              <p className="mt-2 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                {item.summary}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <User className="w-3.5 h-3.5" />
                {item.operatorType === 'tenant' ? '租客' : item.operatorType === 'employee' ? '员工' : '系统'}
                ：{item.operatorName ?? '—'}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
