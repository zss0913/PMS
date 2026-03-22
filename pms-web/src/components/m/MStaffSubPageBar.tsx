'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/** 员工端 H5：子页顶栏，返回首页（或指定路径） */
export function MStaffSubPageBar({
  title,
  backHref = '/m/staff',
  backLabel = '首页',
}: {
  title: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <header className="sticky top-0 z-30 py-2 mb-3 flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 -mt-1">
      <Link
        href={backHref}
        className="flex items-center gap-0.5 text-sm font-medium text-blue-600 dark:text-blue-400 shrink-0 py-1 pr-2"
      >
        <ChevronLeft className="w-5 h-5 -ml-1" strokeWidth={2.25} />
        {backLabel}
      </Link>
      <h1 className="flex-1 text-center text-base font-semibold text-slate-900 dark:text-slate-100 truncate pr-2">
        {title}
      </h1>
      <span className="w-[4.5rem] shrink-0" aria-hidden />
    </header>
  )
}
