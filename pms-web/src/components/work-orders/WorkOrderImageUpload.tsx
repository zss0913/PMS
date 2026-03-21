'use client'

import { useRef, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'

const MAX_FILES = 10
const MAX_BYTES = 10 * 1024 * 1024

type Props = {
  urls: string[]
  onChange: (urls: string[]) => void
  disabled?: boolean
}

function validateClient(file: File): string | null {
  if (file.size > MAX_BYTES) return '单张图片不能超过 10MB'
  const lower = file.name.toLowerCase()
  const byName = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')
  const byType =
    !file.type ||
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg'
  if (!byName && file.type && !file.type.startsWith('image/')) {
    return '仅支持 PNG、JPG、JPEG 格式'
  }
  if (file.type && !byType) return '仅支持 PNG、JPG、JPEG 格式'
  if (!byName && !file.type) return '请使用 .png / .jpg / .jpeg 扩展名的图片'
  return null
}

export function WorkOrderImageUpload({ urls, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const uploadOne = async (file: File): Promise<string | null> => {
    const err = validateClient(file)
    if (err) {
      alert(err)
      return null
    }
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/work-orders/upload-image', {
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative w-24 h-24 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover" />
            {!disabled && (
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
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
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
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
            {uploading ? '上传中…' : '选择图片'}
          </button>
          <p className="text-xs text-slate-500 mt-2">
            支持 PNG、JPG、JPEG，单张不超过 10MB，最多 {MAX_FILES} 张（选填）
          </p>
        </div>
      )}
      {!canAdd && urls.length >= MAX_FILES && (
        <p className="text-xs text-slate-500">已达到 {MAX_FILES} 张上限</p>
      )}
    </div>
  )
}
