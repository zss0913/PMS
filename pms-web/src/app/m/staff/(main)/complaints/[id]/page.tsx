'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MStaffSubPageBar } from '@/components/m/MStaffSubPageBar'

type Detail = {
  buildingName: string
  tenantName: string
  location: string
  description: string
  status: string
  createdAt: string
  result: string | null
}

export default function StaffComplaintDetailPage() {
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
        const r = await fetch(`/api/mp/complaints/${id}`, { credentials: 'include' })
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
      <MStaffSubPageBar title="卫生吐槽" backHref="/m/staff/messages" backLabel="消息" />
      <Link href="/m/staff/messages" className="text-xs text-sky-500">
        返回消息
      </Link>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : err ? (
        <p className="text-sm text-red-500 text-center py-8">{err}</p>
      ) : d ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3 text-sm">
          <p>
            <span className="text-slate-500">楼宇 </span>
            {d.buildingName}
          </p>
          <p>
            <span className="text-slate-500">租客 </span>
            {d.tenantName}
          </p>
          <p>
            <span className="text-slate-500">位置 </span>
            {d.location}
          </p>
          <p>
            <span className="text-slate-500">状态 </span>
            {d.status}
          </p>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <p className="text-slate-500 text-xs mb-1">内容</p>
            <p className="whitespace-pre-wrap">{d.description}</p>
          </div>
          {d.result ? (
            <div>
              <p className="text-slate-500 text-xs mb-1">处理结果</p>
              <p className="whitespace-pre-wrap">{d.result}</p>
            </div>
          ) : null}
          <p className="text-xs text-slate-400">
            {new Date(d.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
