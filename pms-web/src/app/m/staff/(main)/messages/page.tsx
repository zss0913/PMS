'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type MessageKind = 'announcement' | 'work_order' | 'inspection_task' | 'complaint'

type MyMessageItem = {
  kind: MessageKind
  id: number
  title: string
  summary: string
  time: string
  link?: { type: 'work_order' | 'inspection_task' | 'complaint'; id: number }
  content?: string
}

const kindLabel: Record<MessageKind, string> = {
  announcement: '公告',
  work_order: '报事报修',
  inspection_task: '巡检',
  complaint: '卫生吐槽',
}

function hrefForLink(link: MyMessageItem['link']): string | null {
  if (!link) return null
  if (link.type === 'work_order') return `/m/staff/work-orders/${link.id}`
  if (link.type === 'inspection_task') return `/m/staff/inspection/${link.id}`
  if (link.type === 'complaint') return `/m/staff/complaints/${link.id}`
  return null
}

/** 消息通知：公告 + 报事报修 / 巡检 / 卫生吐槽等业务通知 */
export default function StaffMessagesPage() {
  const [list, setList] = useState<MyMessageItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/mp/my-messages', { credentials: 'include' })
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
      <p className="text-xs text-slate-500 dark:text-slate-400">
        物业公告、报事报修、巡检任务与卫生吐槽等业务通知
      </p>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">暂无消息</p>
      ) : (
        <ul className="space-y-3">
          {list.map((item, idx) => {
            const href = item.kind === 'announcement' ? null : hrefForLink(item.link)
            const inner = (
              <>
                <div className="flex justify-between items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                    {kindLabel[item.kind]}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(item.time).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{item.summary}</p>
                {item.kind === 'announcement' && item.content ? (
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap border-t border-slate-200 dark:border-slate-700 pt-3">
                    {item.content}
                  </div>
                ) : null}
              </>
            )
            return (
              <li key={`${item.kind}-${item.id}-${idx}`}>
                {href ? (
                  <Link
                    href={href}
                    className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 active:opacity-90"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                    {inner}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
