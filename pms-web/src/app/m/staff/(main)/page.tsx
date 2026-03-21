'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function StaffHomePage() {
  const [name, setName] = useState('')
  const [todos, setTodos] = useState<{
    pendingAssign: number
    pendingProcess: number
    pendingInspection: number
    overdueBills: number
  } | null>(null)

  useEffect(() => {
    void (async () => {
      const [me, td] = await Promise.all([
        fetch('/api/mp/me', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/mp/my-todos', { credentials: 'include' }).then((r) => r.json()),
      ])
      if (me.user?.name) setName(me.user.name)
      if (td.success && td.todos) setTodos(td.todos)
    })()
  }, [])

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <header className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 shadow">
        <p className="text-sm opacity-80">员工端</p>
        <h1 className="text-xl font-semibold mt-1">{name ? `${name}，你好` : '欢迎'}</h1>
      </header>

      {todos && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-2xl font-semibold text-amber-600">{todos.pendingAssign}</p>
            <p className="text-xs text-slate-500 mt-1">待派工单（组长）</p>
          </div>
          <Link
            href="/m/staff/work-orders"
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 active:scale-[0.98] transition-transform"
          >
            <p className="text-2xl font-semibold text-blue-600">{todos.pendingProcess}</p>
            <p className="text-xs text-slate-500 mt-1">待我处理工单</p>
          </Link>
          <Link
            href="/m/staff/inspection"
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4"
          >
            <p className="text-2xl font-semibold text-emerald-600">{todos.pendingInspection}</p>
            <p className="text-xs text-slate-500 mt-1">待巡检任务</p>
          </Link>
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-2xl font-semibold text-red-600">{todos.overdueBills}</p>
            <p className="text-xs text-slate-500 mt-1">逾期账单（公司）</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/m/staff/work-orders"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-center font-medium"
        >
          工单列表
        </Link>
        <Link
          href="/m/staff/inspection"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-center font-medium"
        >
          巡检任务
        </Link>
      </div>
    </div>
  )
}
