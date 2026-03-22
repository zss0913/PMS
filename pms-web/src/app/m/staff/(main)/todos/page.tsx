'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MStaffSubPageBar } from '@/components/m/MStaffSubPageBar'

type TodoItem = {
  id: number
  code: string
  title: string
  type: string
  status: string
}

export default function StaffTodosPage() {
  const [workOrders, setWorkOrders] = useState<TodoItem[]>([])
  const [inspectionTasks, setInspectionTasks] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/mp/my-todos', { credentials: 'include' })
        const j = await r.json()
        if (j.success && j.data) {
          setWorkOrders(j.data.workOrders ?? [])
          setInspectionTasks(j.data.inspectionTasks ?? [])
        }
      } catch {
        setWorkOrders([])
        setInspectionTasks([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="p-4 max-w-lg mx-auto pb-2">
      <MStaffSubPageBar title="待办" />
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : (
        <>
          {workOrders.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                待处理工单
              </h2>
              <ul className="space-y-2">
                {workOrders.map((item) => (
                  <li key={`wo-${item.id}`}>
                    <Link
                      href={`/m/staff/work-orders/${item.id}`}
                      className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 active:scale-[0.99] transition-transform"
                    >
                      <p className="font-medium line-clamp-2">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.code} · {item.status}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {inspectionTasks.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                巡检任务
              </h2>
              <ul className="space-y-2">
                {inspectionTasks.map((item) => (
                  <li
                    key={`it-${item.id}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
                  >
                    <p className="font-medium">{item.code || item.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.status}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {workOrders.length === 0 && inspectionTasks.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-12">暂无待办</p>
          )}
        </>
      )}
    </div>
  )
}
