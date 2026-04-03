'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MStaffSubPageBar } from '@/components/m/MStaffSubPageBar'

type Task = {
  id: number
  code: string
  planName: string
  inspectionType: string
  scheduledDate: string
  status: string
  buildingName?: string | null
}

export default function StaffInspectionPage() {
  const [list, setList] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/mp/inspection-tasks', { credentials: 'include' })
        const j = await r.json()
        setList(j.data?.list ?? [])
      } catch {
        setList([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <MStaffSubPageBar title="巡检任务" />
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">暂无任务</p>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <li key={t.id}>
              <Link
                href={`/m/staff/inspection/${t.id}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/80"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">{t.code}</span>
                  <span className="text-xs shrink-0">{t.status}</span>
                </div>
                <p className="font-medium mt-1">{t.planName}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {t.inspectionType} · {new Date(t.scheduledDate).toLocaleString('zh-CN')}
                </p>
                {t.buildingName && (
                  <p className="text-xs text-slate-500 mt-1">楼宇：{t.buildingName}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
