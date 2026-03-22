'use client'

import { useEffect, useState } from 'react'

type AnnouncementRow = {
  id: number
  title: string
  content: string
  publishTime: string | Date
}

/** 消息通知：物业公告与重要通知（与后台发布公告同源） */
export default function TenantMessagesPage() {
  const [list, setList] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/mp/announcements', { credentials: 'include' })
        const j = await r.json()
        setList(j.list ?? [])
      } catch {
        setList([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-semibold">消息通知</h1>
      <p className="text-xs text-slate-500 dark:text-slate-400">物业公告与重要通知</p>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">暂无消息</p>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
            >
              <p className="font-medium">{a.title}</p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(a.publishTime).toLocaleString('zh-CN')}
              </p>
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                {a.content}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
