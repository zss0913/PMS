'use client'

import { useEffect, useState } from 'react'
import {
  fileNameFromAttachmentUrl,
  isLikelyImageUrl,
  parseUrlArrayFromWorkOrderLogValue,
} from '@/lib/work-order-log-display'

function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal
      aria-label="图片预览"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 right-4 z-[201] rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
        onClick={onClose}
      >
        关闭
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="max-h-[90vh] max-w-full object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

function AttachmentSide({
  label,
  urls,
  onPreview,
}: {
  label: string
  urls: string[]
  onPreview: (url: string) => void
}) {
  if (urls.length === 0) {
    return (
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <span className="text-sm text-slate-400">（无）</span>
      </div>
    )
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <ul className="flex flex-wrap gap-2">
        {urls.map((u) => {
          const name = fileNameFromAttachmentUrl(u)
          if (isLikelyImageUrl(u)) {
            return (
              <li key={u}>
                <button
                  type="button"
                  title={name}
                  onClick={() => onPreview(u)}
                  className="block h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 hover:opacity-90 dark:border-slate-600 dark:bg-slate-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
                <div className="mt-0.5 max-w-[5.5rem] truncate text-[11px] text-slate-500 dark:text-slate-400" title={name}>
                  {name}
                </div>
              </li>
            )
          }
          return (
            <li key={u} className="max-w-full">
              <a
                href={u}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-blue-600 hover:underline dark:border-slate-600 dark:bg-slate-800 dark:text-blue-400"
                title={u}
              >
                <span className="truncate">{name}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 操作日志中「图片附件」变更：缩略图 + 文件名；图片可点击放大 */
export function WorkOrderImagesChangeDisplay({ from, to }: { from: string; to: string }) {
  const [preview, setPreview] = useState<string | null>(null)
  const fromUrls = parseUrlArrayFromWorkOrderLogValue(from)
  const toUrls = parseUrlArrayFromWorkOrderLogValue(to)

  if (fromUrls === null || toUrls === null) {
    return (
      <div className="mt-1 rounded border border-amber-200 bg-amber-50/80 p-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="mb-1 font-medium text-amber-900 dark:text-amber-200">图片附件（原始记录）</p>
        <p className="break-all font-mono text-amber-950/80 dark:text-amber-100/80">
          <span className="text-slate-600 dark:text-slate-400">变更前：</span>
          {from}
        </p>
        <p className="mt-1 break-all font-mono text-amber-950/80 dark:text-amber-100/80">
          <span className="text-slate-600 dark:text-slate-400">变更后：</span>
          {to}
        </p>
        <p className="mt-1 text-[11px] text-amber-800/90 dark:text-amber-300/90">
          若为早期截断记录，无法解析为列表；新产生的编辑记录将显示缩略图。
        </p>
      </div>
    )
  }

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <AttachmentSide label="变更前" urls={fromUrls} onPreview={setPreview} />
        <div className="hidden self-center text-slate-300 dark:text-slate-600 sm:block">→</div>
        <AttachmentSide label="变更后" urls={toUrls} onPreview={setPreview} />
      </div>
      {preview ? <ImageLightbox url={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  )
}
