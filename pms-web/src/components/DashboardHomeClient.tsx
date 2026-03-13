'use client'

import { AppLink } from '@/components/AppLink'
import { FileText, ClipboardCheck, AlertCircle } from 'lucide-react'

const ICON_MAP = {
  default: FileText,
  clipboard: ClipboardCheck,
  alert: AlertCircle,
} as const

export function TodoCard({
  href,
  title,
  count,
  iconType = 'default',
}: {
  href: string
  title: string
  count: number
  iconType?: keyof typeof ICON_MAP
}) {
  const Icon = ICON_MAP[iconType]
  return (
    <AppLink
      href={href}
      className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
    >
      <Icon className="w-8 h-8 text-blue-500" />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-2xl font-bold text-blue-600">{count}</div>
      </div>
    </AppLink>
  )
}

export function CompaniesLink() {
  return (
    <AppLink
      href="/companies"
      className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
    >
      管理物业公司
    </AppLink>
  )
}
