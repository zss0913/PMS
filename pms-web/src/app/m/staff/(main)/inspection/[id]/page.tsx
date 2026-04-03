'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MStaffSubPageBar } from '@/components/m/MStaffSubPageBar'

type CheckItem = { name: string; tagId: string; location: string }

type Detail = {
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  buildingName: string | null
  canExecute?: boolean
  checkItems?: CheckItem[]
  progress?: { total: number; done: number }
  doneTagIds?: string[]
}

export default function StaffInspectionDetailPage() {
  const params = useParams()
  const id = params?.id as string | undefined
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!id) {
      setErr('无效 ID')
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const r = await fetch(`/api/mp/inspection-tasks/${id}`, { credentials: 'include' })
        const j = await r.json()
        if (j.success && j.data) {
          setD(j.data)
        } else {
          setErr(j.message || '加载失败')
        }
      } catch {
        setErr('网络错误')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <MStaffSubPageBar title="巡检详情" backHref="/m/staff/messages" backLabel="消息" />
      <Link href="/m/staff/inspection" className="text-xs text-sky-500">
        返回巡检列表
      </Link>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : err ? (
        <p className="text-sm text-red-500 text-center py-8">{err}</p>
      ) : d ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 text-sm">
          <p className="text-xs text-slate-400">{d.code}</p>
          <p className="font-semibold text-lg">{d.planName}</p>
          <p>
            <span className="text-slate-500">类型 </span>
            {d.inspectionType}
          </p>
          <p>
            <span className="text-slate-500">楼宇 </span>
            {d.buildingName ?? '—'}
          </p>
          <p>
            <span className="text-slate-500">计划日期 </span>
            {new Date(d.scheduledDate).toLocaleString('zh-CN')}
          </p>
          <p>
            <span className="text-slate-500">状态 </span>
            {d.status}
          </p>
          {d.progress != null && (
            <p>
              <span className="text-slate-500">进度 </span>
              {d.progress.done}/{d.progress.total}
            </p>
          )}
          {d.checkItems && d.checkItems.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 text-xs mb-2">检查项与 NFC</p>
              <ul className="space-y-2 text-xs">
                {d.checkItems.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className={
                        d.doneTagIds?.includes(c.tagId) ? 'text-green-600' : 'text-slate-400'
                      }
                    >
                      {d.doneTagIds?.includes(c.tagId) ? '✓' : '○'}
                    </span>
                    <span>
                      {c.name} — {c.tagId}（{c.location || '—'}）
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.canExecute && d.status !== '已完成' && (
            <Link
              href={`/m/staff/inspection/${id}/execute`}
              className="block w-full text-center py-3 rounded-lg bg-sky-600 text-white text-sm font-medium"
            >
              执行巡检
            </Link>
          )}
        </div>
      ) : null}
    </div>
  )
}
