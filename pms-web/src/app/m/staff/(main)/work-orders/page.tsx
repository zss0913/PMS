'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { MStaffSubPageBar } from '@/components/m/MStaffSubPageBar'

const TABS = [
  '',
  '待派单',
  '待响应',
  '处理中',
  '待员工确认费用',
  '待租客确认费用',
  '待处理',
  '待评价',
  '评价完成',
  '已取消',
]

type Row = {
  id: number
  code: string
  title: string
  status: string
  type: string
  createdAt: string
}

export default function StaffWorkOrdersPage() {
  const [tab, setTab] = useState('')
  const [list, setList] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = tab ? `?status=${encodeURIComponent(tab)}` : ''
      const r = await fetch(`/api/mp/work-orders${q}`, { credentials: 'include' })
      const j = await r.json()
      setList(j.list ?? [])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <MStaffSubPageBar title="工单管理" />
      <p className="text-xs text-slate-500 -mt-1">含指派给我与我提交的工单；管理员可见本企业全部工单</p>
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setTab(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              tab === s
                ? 'bg-slate-800 text-white dark:bg-slate-600'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {s || '全部'}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">暂无工单</p>
      ) : (
        <ul className="space-y-2">
          {list.map((w) => (
            <li key={w.id}>
              <Link
                href={`/m/staff/work-orders/${w.id}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs text-slate-500">{w.code}</span>
                  <span className="text-xs text-blue-600 shrink-0">{w.status}</span>
                </div>
                <p className="font-medium mt-1 line-clamp-2">{w.title}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {w.type} · {new Date(w.createdAt).toLocaleString('zh-CN')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
