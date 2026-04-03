'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MStaffSubPageBar } from '@/components/m/MStaffSubPageBar'

type Assignee = { id: number; name: string }

type Detail = {
  buildingName: string
  tenantName: string
  location: string
  description: string
  status: string
  createdAt: string
  handledAt: string | null
  images: string[]
  result: string | null
  resultImages: string[]
  assignedTo: number | null
  assignedToName: string | null
  handledByName: string | null
  assignees?: Assignee[]
  currentUserId?: number
}

function mediaUrl(path: string) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return path.startsWith('/') ? path : `/${path}`
}

export default function StaffComplaintDetailPage() {
  const params = useParams()
  const id = params?.id as string | undefined
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const [showAccept, setShowAccept] = useState(false)
  const [assigneeId, setAssigneeId] = useState(0)

  const [showFinish, setShowFinish] = useState(false)
  const [finishResult, setFinishResult] = useState('')
  const [finishImages, setFinishImages] = useState<string[]>([])
  const [finishUploading, setFinishUploading] = useState(false)
  const finishFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setErr('')
    try {
      const r = await fetch(`/api/mp/complaints/${id}`, { credentials: 'include' })
      const j = (await r.json()) as {
        success?: boolean
        data?: Detail
        message?: string
      }
      if (j.success && j.data) {
        const data = {
          ...j.data,
          images: j.data.images ?? [],
          resultImages: j.data.resultImages ?? [],
        }
        setD(data)
        const first = data.assignees?.[0]?.id ?? 0
        setAssigneeId(first)
      } else {
        setErr(j.message || '加载失败')
        setD(null)
      }
    } catch {
      setErr('网络错误')
      setD(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (!id) {
      setErr('无效 ID')
      setLoading(false)
      return
    }
    void load()
  }, [id, load])

  const canAccept = d?.status === '待处理'
  const canFinish =
    d?.status === '处理中' &&
    d.assignedTo != null &&
    d.currentUserId != null &&
    d.assignedTo === d.currentUserId

  const uploadOne = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/work-orders/upload-image', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    })
    const j = (await r.json()) as { success?: boolean; data?: { url?: string }; message?: string }
    if (j.success && j.data?.url) return j.data.url
    throw new Error(j.message || '上传失败')
  }

  const submitAccept = async () => {
    if (!id || !assigneeId) {
      setMsg('请选择处理人')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch(`/api/mp/complaints/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: '处理中', assignedTo: assigneeId }),
      })
      const j = (await r.json()) as { success?: boolean; message?: string }
      if (j.success) {
        setShowAccept(false)
        await load()
      } else {
        setMsg(j.message || '操作失败')
      }
    } catch {
      setMsg('网络错误')
    } finally {
      setBusy(false)
    }
  }

  const submitFinish = async () => {
    const text = finishResult.trim()
    if (!id || !text) {
      setMsg('请填写处理结果')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch(`/api/mp/complaints/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: '已处理',
          result: text,
          resultImages: finishImages.length ? finishImages : undefined,
        }),
      })
      const j = (await r.json()) as { success?: boolean; message?: string }
      if (j.success) {
        setShowFinish(false)
        setFinishResult('')
        setFinishImages([])
        await load()
      } else {
        setMsg(j.message || '操作失败')
      }
    } catch {
      setMsg('网络错误')
    } finally {
      setBusy(false)
    }
  }

  const onPickFinishFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setFinishUploading(true)
    setMsg('')
    try {
      const next: string[] = []
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (!f) continue
        next.push(await uploadOne(f))
      }
      setFinishImages((prev) => [...prev, ...next])
    } catch (er) {
      setMsg(er instanceof Error ? er.message : '上传失败')
    } finally {
      setFinishUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-28">
      <MStaffSubPageBar title="卫生吐槽" backHref="/m/staff/messages" backLabel="消息" />
      <Link href="/m/staff/messages" className="text-xs text-sky-500">
        返回消息
      </Link>
      {loading ? (
        <p className="text-sm text-slate-500 text-center py-8">加载中…</p>
      ) : err ? (
        <p className="text-sm text-red-500 text-center py-8">{err}</p>
      ) : d ? (
        <>
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
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{d.status}</span>
            </p>
            {d.assignedToName ? (
              <p>
                <span className="text-slate-500">处理人 </span>
                {d.assignedToName}
              </p>
            ) : null}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-slate-500 text-xs mb-1">内容</p>
              <p className="whitespace-pre-wrap">{d.description}</p>
            </div>
            {d.images?.length ? (
              <div>
                <p className="text-slate-500 text-xs mb-2">附图</p>
                <div className="flex flex-col gap-2">
                  {d.images.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={u}
                      src={mediaUrl(u)}
                      alt=""
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600"
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {d.result ? (
              <div>
                <p className="text-slate-500 text-xs mb-1">处理结果</p>
                <p className="whitespace-pre-wrap">{d.result}</p>
                {d.handledAt ? (
                  <p className="text-xs text-slate-400 mt-1">
                    处理时间 {new Date(d.handledAt).toLocaleString('zh-CN')}
                  </p>
                ) : null}
                {d.handledByName ? (
                  <p className="text-xs text-slate-400">处理人 {d.handledByName}</p>
                ) : null}
              </div>
            ) : null}
            {d.resultImages?.length ? (
              <div>
                <p className="text-slate-500 text-xs mb-2">处理附图</p>
                <div className="flex flex-col gap-2">
                  {d.resultImages.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={u}
                      src={mediaUrl(u)}
                      alt=""
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600"
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <p className="text-xs text-slate-400">
              提交时间 {new Date(d.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>

          {msg ? <p className="text-sm text-amber-600 dark:text-amber-400">{msg}</p> : null}

          {(canAccept || canFinish) && (
            <div className="fixed bottom-0 left-0 right-0 p-4 max-w-lg mx-auto flex flex-col gap-2 bg-slate-50/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800 safe-area-pb">
              {canAccept ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowAccept(true)}
                  className="w-full rounded-xl bg-sky-600 text-white py-3 text-sm font-medium disabled:opacity-50"
                >
                  受理为处理中
                </button>
              ) : null}
              {canFinish ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setFinishResult('')
                    setFinishImages([])
                    setShowFinish(true)
                  }}
                  className="w-full rounded-xl bg-emerald-600 text-white py-3 text-sm font-medium disabled:opacity-50"
                >
                  办结（已处理）
                </button>
              ) : null}
            </div>
          )}

          {showAccept ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
              role="presentation"
              onClick={() => !busy && setShowAccept(false)}
            >
              <div
                className="w-full max-w-lg rounded-t-2xl bg-white dark:bg-slate-900 p-4 space-y-3"
                role="dialog"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">指派处理人</p>
                <select
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(Number(e.target.value))}
                >
                  {(d.assignees ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm text-slate-600"
                    disabled={busy}
                    onClick={() => setShowAccept(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white disabled:opacity-50"
                    disabled={busy || !(d.assignees ?? []).length}
                    onClick={() => void submitAccept()}
                  >
                    确定
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showFinish ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
              role="presentation"
              onClick={() => !busy && !finishUploading && setShowFinish(false)}
            >
              <div
                className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-slate-900 p-4 space-y-3"
                role="dialog"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">办结说明</p>
                <textarea
                  className="w-full min-h-[120px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  placeholder="请填写处理结果（必填）"
                  value={finishResult}
                  onChange={(e) => setFinishResult(e.target.value)}
                  maxLength={2000}
                />
                <input
                  ref={finishFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onPickFinishFiles}
                />
                <button
                  type="button"
                  disabled={finishUploading || busy}
                  onClick={() => finishFileRef.current?.click()}
                  className="text-sm text-sky-600"
                >
                  {finishUploading ? '上传中…' : '上传处理附图（选填）'}
                </button>
                {finishImages.length ? (
                  <div className="flex flex-wrap gap-2">
                    {finishImages.map((u, i) => (
                      <div key={u + i} className="relative w-20 h-20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl(u)} alt="" className="w-full h-full object-cover rounded-lg" />
                        <button
                          type="button"
                          className="absolute top-0 right-0 text-[10px] bg-black/50 text-white px-1 rounded"
                          onClick={() => setFinishImages((prev) => prev.filter((_, j) => j !== i))}
                        >
                          删
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm text-slate-600"
                    disabled={busy || finishUploading}
                    onClick={() => setShowFinish(false)}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                    disabled={busy || finishUploading}
                    onClick={() => void submitFinish()}
                  >
                    提交办结
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
