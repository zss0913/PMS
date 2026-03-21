'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Row = {
  id: number
  location: string
  description: string
  status: string
  buildingName: string
  createdAt: string
}

export default function TenantComplaintsPage() {
  const [list, setList] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [ctx, setCtx] = useState<{
    tenantId: number | null
    buildingId: number | null
  }>({ tenantId: null, buildingId: null })
  const [desc, setDesc] = useState('')
  const [loc, setLoc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    try {
      const [c, cl] = await Promise.all([
        fetch('/api/mp/work-order-submit-context', { credentials: 'include' }).then((r) =>
          r.json()
        ),
        fetch('/api/mp/complaints', { credentials: 'include' }).then((r) => r.json()),
      ])
      if (c.success && c.data) {
        setCtx({
          tenantId: c.data.tenantId ?? null,
          buildingId: c.data.buildingId ?? null,
        })
      }
      setList(cl.list ?? [])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async () => {
    if (!ctx.tenantId || !ctx.buildingId) {
      setErr('未关联租客或楼宇，无法提交')
      return
    }
    if (!desc.trim()) {
      setErr('请填写描述')
      return
    }
    setErr('')
    setSubmitting(true)
    try {
      const r = await fetch('/api/mp/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantId: ctx.tenantId,
          buildingId: ctx.buildingId,
          location: loc.trim(),
          description: desc.trim(),
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setErr(j.message || '提交失败')
        return
      }
      setDesc('')
      setLoc('')
      await load()
    } catch {
      setErr('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <Link href="/m/tenant" className="text-sm text-slate-500">
        ← 首页
      </Link>
      <h1 className="text-lg font-semibold">卫生吐槽</h1>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
        <p className="text-sm font-medium">提交吐槽</p>
        <input
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          placeholder="位置（选填）"
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="描述问题"
          rows={3}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {submitting ? '提交中…' : '提交'}
        </button>
      </div>

      <h2 className="text-sm font-medium text-slate-500">我的记录</h2>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-4">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">暂无记录</p>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm"
            >
              <div className="flex justify-between gap-2">
                <span className="text-xs text-slate-400">{c.buildingName}</span>
                <span className="text-xs">{c.status}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{c.description}</p>
              <p className="text-xs text-slate-400 mt-2">
                {new Date(c.createdAt).toLocaleString('zh-CN')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
