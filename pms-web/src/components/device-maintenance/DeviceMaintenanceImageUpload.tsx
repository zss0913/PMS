'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Upload, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

const MAX_FILES = 50
const MAX_BYTES = 10 * 1024 * 1024
const SWIPE_PX = 56

export function parseMaintenanceImageUrls(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const j = JSON.parse(raw) as unknown
    if (Array.isArray(j)) return j.filter((x): x is string => typeof x === 'string')
  } catch {
    /* 忽略非 JSON 旧数据 */
  }
  return []
}

type Props = {
  urls: string[]
  onChange: (urls: string[]) => void
  disabled?: boolean
}

function validateClient(file: File): string | null {
  if (file.size > MAX_BYTES) return '单张图片不能超过 10MB'
  const lower = file.name.toLowerCase()
  const byName =
    lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')
  const byType =
    !file.type ||
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    file.type === 'image/webp'
  if (!byName && file.type && !file.type.startsWith('image/')) {
    return '仅支持 PNG、JPG、WebP 格式'
  }
  if (file.type && !byType) return '仅支持 PNG、JPG、WebP 格式'
  if (!byName && !file.type) return '请使用 .png / .jpg / .jpeg / .webp 扩展名的图片'
  return null
}

export function DeviceMaintenanceImageUpload({ urls, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const touchStartX = useRef<number | null>(null)

  const closePreview = useCallback(() => setPreviewIndex(null), [])

  const goPrev = useCallback(() => {
    setPreviewIndex((i) => {
      if (i === null || urls.length === 0) return null
      return (i - 1 + urls.length) % urls.length
    })
  }, [urls.length])

  const goNext = useCallback(() => {
    setPreviewIndex((i) => {
      if (i === null || urls.length === 0) return null
      return (i + 1) % urls.length
    })
  }, [urls.length])

  useEffect(() => {
    if (previewIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePreview()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [previewIndex, closePreview, goPrev, goNext])

  useEffect(() => {
    if (previewIndex !== null && previewIndex >= urls.length) {
      setPreviewIndex(urls.length > 0 ? urls.length - 1 : null)
    }
  }, [previewIndex, urls.length])

  const uploadOne = async (file: File): Promise<string | null> => {
    const err = validateClient(file)
    if (err) {
      alert(err)
      return null
    }
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/device-maintenance-records/upload-image', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    })
    const json = await res.json()
    if (!json.success) {
      alert(json.message || '上传失败')
      return null
    }
    return json.data.url as string
  }

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length || disabled) return
    const remaining = MAX_FILES - urls.length
    if (remaining <= 0) {
      alert(`最多上传 ${MAX_FILES} 张图片`)
      return
    }
    const files = Array.from(fileList).slice(0, remaining)
    setUploading(true)
    try {
      let acc = [...urls]
      for (const file of files) {
        if (acc.length >= MAX_FILES) break
        const url = await uploadOne(file)
        if (url) {
          acc = [...acc, url]
          onChange(acc)
        }
      }
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeAt = (index: number) => {
    if (disabled) return
    onChange(urls.filter((_, i) => i !== index))
  }

  const canAdd = urls.length < MAX_FILES && !disabled

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || urls.length < 2) {
      touchStartX.current = null
      return
    }
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < SWIPE_PX) return
    if (dx > 0) goPrev()
    else goNext()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative w-24 h-24 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 group"
          >
            <button
              type="button"
              onClick={() => setPreviewIndex(i)}
              className="absolute inset-0 block w-full h-full p-0 border-0 bg-transparent cursor-zoom-in"
              title="点击查看大图，左右键或按钮切换"
              aria-label={`查看第 ${i + 1} 张`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeAt(i)
                }}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="删除"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {canAdd && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            disabled={uploading || disabled}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading || disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? '上传中…' : '上传图片'}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            选填；PNG、JPG、WebP，单张不超过 10MB，最多 {MAX_FILES} 张。点击缩略图可放大，左右箭头或滑动切换。
          </p>
        </div>
      )}
      {!canAdd && urls.length >= MAX_FILES && (
        <p className="text-xs text-slate-500">已达到 {MAX_FILES} 张上限</p>
      )}

      {previewIndex !== null &&
        urls.length > 0 &&
        previewIndex < urls.length &&
        previewIndex >= 0 && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/88 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            onClick={closePreview}
          >
            <button
              type="button"
              className="absolute top-3 right-3 z-10 rounded-full p-2 text-white/90 hover:bg-white/10"
              aria-label="关闭"
              onClick={closePreview}
            >
              <X className="w-6 h-6" />
            </button>
            {urls.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/90 hover:bg-white/10 md:left-6"
                  aria-label="上一张"
                  onClick={(e) => {
                    e.stopPropagation()
                    goPrev()
                  }}
                >
                  <ChevronLeft className="w-9 h-9 md:w-10 md:h-10" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/90 hover:bg-white/10 md:right-6"
                  aria-label="下一张"
                  onClick={(e) => {
                    e.stopPropagation()
                    goNext()
                  }}
                >
                  <ChevronRight className="w-9 h-9 md:w-10 md:h-10" />
                </button>
              </>
            )}
            <div
              className="relative max-h-[85vh] max-w-[min(96vw,960px)] flex items-center justify-center touch-pan-y"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[previewIndex]}
                alt=""
                className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-lg select-none"
                draggable={false}
              />
            </div>
            <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/85">
              {previewIndex + 1} / {urls.length}
            </p>
          </div>
        )}
    </div>
  )
}
