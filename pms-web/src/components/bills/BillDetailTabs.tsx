'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'info' | 'attachments'

export function BillDetailTabs({
  children,
  attachmentsSlot,
}: {
  children: ReactNode
  attachmentsSlot: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('info')

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
        tab === id
          ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
          : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 mb-8">
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-600 mb-4">
        {tabBtn('info', '基本信息')}
        {tabBtn('attachments', '附件')}
      </div>
      {tab === 'info' ? children : attachmentsSlot}
    </section>
  )
}
