'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MStaffSubPageBar } from '@/components/m/MStaffSubPageBar'

type CheckItem = { name: string; nfcTagId: number; tagId: string; location: string }

type Detail = {
  code: string
  planName: string
  status: string
  canExecute: boolean
  checkItems: CheckItem[]
  doneTagIds: string[]
}

function normBizTag(s: string) {
  return s.trim().toUpperCase().replace(/\s/g, '')
}

export default function StaffInspectionExecutePage() {
  const params = useParams()
  const id = params?.id as string | undefined
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [pick, setPick] = useState<CheckItem | null>(null)
  const [scanned, setScanned] = useState('')
  const [remark, setRemark] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setErr('')
    try {
      const r = await fetch(`/api/mp/inspection-tasks/${id}`, { credentials: 'include' })
      const j = await r.json()
      if (j.success && j.data) {
        setDetail(j.data)
        if (!j.data.canExecute) setErr('无执行权限')
      } else {
        setErr(j.message || '加载失败')
      }
    } catch {
      setErr('网络错误')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const doneSet = new Set((detail?.doneTagIds ?? []).map(normBizTag))
  const pending =
    detail?.checkItems.filter((c) => c.tagId && !doneSet.has(normBizTag(c.tagId))) ?? []

  async function submit() {
    if (!id || !pick || !scanned.trim()) return
    setBusy(true)
    try {
      const r = await fetch(`/api/mp/inspection-tasks/${id}/checkpoint`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scannedTagId: scanned.trim(),
          remark: remark.trim() || undefined,
        }),
      })
      const j = await r.json()
      if (j.success) {
        setPick(null)
        setScanned('')
        setRemark('')
        await load()
      } else {
        alert(j.message || '提交失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      <MStaffSubPageBar title="执行巡检" backHref={`/m/staff/inspection/${id}`} backLabel="详情" />
      <Link href="/m/staff/inspection" className="text-xs text-sky-500">
        返回列表
      </Link>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : err && !detail ? (
        <p className="text-sm text-red-500 text-center py-8">{err}</p>
      ) : detail ? (
        <>
          {err && <p className="text-sm text-amber-600">{err}</p>}
          <p className="font-semibold">{detail.planName}</p>
          <p className="text-xs text-slate-500">{detail.code}</p>
          {pending.length === 0 ? (
            <p className="text-green-600 text-sm py-6">所有检查点已完成</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setPick(c)
                      setScanned('')
                      setRemark('')
                    }}
                    className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-xs text-slate-500 mt-1">NFC {c.tagId}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {pick && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-xl">
            <p className="font-medium">{pick.name}</p>
            <p className="text-xs text-slate-500">期望编号 {pick.tagId}</p>
            <input
              value={scanned}
              onChange={(e) => setScanned(e.target.value)}
              placeholder="读卡编号（忽略大小写）"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
            />
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="情况说明（选填）"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPick(null)}
                className="flex-1 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className="flex-1 py-2 rounded-lg bg-sky-600 text-white text-sm disabled:opacity-50"
              >
                {busy ? '提交中…' : '提交此点'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
