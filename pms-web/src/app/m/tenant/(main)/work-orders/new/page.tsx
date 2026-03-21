'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function TenantWorkOrderNewPage() {
  const router = useRouter()
  const [category, setCategory] = useState<'报事' | '报修'>('报修')
  const [facilityScope, setFacilityScope] = useState<'公共设施' | '套内设施'>('公共设施')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [feeAck, setFeeAck] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const uploadFile = async (file: File) => {
    setUploading(true)
    setErr('')
    try {
      const fd = new FormData()
      fd.set('file', file)
      const r = await fetch('/api/work-orders/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const j = await r.json()
      if (!j.success) {
        setErr(j.message || '上传失败')
        return
      }
      setImages((prev) => [...prev, j.data.url])
    } catch {
      setErr('上传失败')
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    setErr('')
    if (facilityScope === '套内设施' && !feeAck) {
      setErr('套内报修请勾选费用知情确认')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/mp/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category,
          facilityScope,
          title: title.trim(),
          description: description.trim(),
          location: location.trim() || undefined,
          images: images.length ? images : undefined,
          feeNoticeAcknowledged: facilityScope === '套内设施' ? feeAck : undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) {
        setErr(j.message || '提交失败')
        return
      }
      router.replace(`/m/tenant/work-orders/${j.id}`)
    } catch {
      setErr('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <Link href="/m/tenant/work-orders" className="text-sm text-slate-500">
        ← 返回列表
      </Link>
      <h1 className="text-lg font-semibold">报事报修</h1>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">类型</p>
          <div className="flex gap-2">
            {(['报事', '报修'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  category === c
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">设施范围</p>
          <div className="flex gap-2">
            {(['公共设施', '套内设施'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFacilityScope(c)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  facilityScope === c
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {facilityScope === '套内设施' && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={feeAck}
              onChange={(e) => setFeeAck(e.target.checked)}
              className="mt-1"
            />
            <span>我已了解套内报修可能产生费用，同意物业确认费用后继续维修</span>
          </label>
        )}

        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400">标题</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5"
            placeholder="简要说明"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400">问题描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5"
            placeholder="请描述具体情况"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-400">位置（选填）</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5"
          />
        </div>

        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">图片（选填）</p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            disabled={uploading || images.length >= 9}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void uploadFile(f)
              e.target.value = ''
            }}
            className="text-sm"
          />
          {images.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">已选 {images.length} 张</p>
          )}
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={submitting || uploading}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50"
      >
        {submitting ? '提交中…' : '提交工单'}
      </button>
    </div>
  )
}
