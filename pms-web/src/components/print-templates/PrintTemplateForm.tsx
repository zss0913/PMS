'use client'

import { useState, useEffect, useRef } from 'react'
import { X, FileUp, ExternalLink, Trash2 } from 'lucide-react'
import type { PrintTemplate } from './PrintTemplateList'

const TEMPLATE_TYPES = [
  { value: '催缴单', label: '催缴单' },
  { value: '收据', label: '收据' },
]

const DOCX_ACCEPT = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** 上传存储名形如 uuid_原名.docx，展示时去掉 uuid 前缀 */
function displayNameFromStoredPath(url: string): string {
  const seg = decodeURIComponent(url.split('/').pop() ?? '')
  const m = seg.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_(.+)$/i)
  return m ? m[1] : seg || '已上传.docx'
}

export function PrintTemplateForm({
  template,
  onClose,
}: {
  template: PrintTemplate | null
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('催缴单')
  const [templateUrl, setTemplateUrl] = useState('')
  const [displayFileName, setDisplayFileName] = useState('')
  const [status, setStatus] = useState('active')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEdit = !!template

  useEffect(() => {
    if (template) {
      setName(template.name)
      setType(template.type === '发票' ? '催缴单' : template.type)
      setTemplateUrl(template.templateUrl ?? '')
      setDisplayFileName(template.templateUrl ? displayNameFromStoredPath(template.templateUrl) : '')
      setStatus(template.status)
    } else {
      setName('')
      setType('催缴单')
      setTemplateUrl('')
      setDisplayFileName('')
      setStatus('active')
    }
    setError('')
  }, [template])

  const uploadFile = async (file: File) => {
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await fetch('/api/print-templates/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data?.templateUrl) {
        setTemplateUrl(json.data.templateUrl)
        setDisplayFileName(json.data.originalName || file.name)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setError(json.message || '上传失败')
      }
    } finally {
      setUploading(false)
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void uploadFile(file)
  }

  const clearFile = () => {
    setTemplateUrl('')
    setDisplayFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        type,
        templateUrl: templateUrl.trim() || undefined,
        status,
      }
      const url = isEdit ? `/api/print-templates/${template!.id}` : '/api/print-templates'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        onClose()
      } else {
        setError(json.message || '操作失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? '编辑打印模板' : '新增打印模板'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="template-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">模板名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="如：标准催缴单"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">模板类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {TEMPLATE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              {type === '催缴单' && '账单列表占位符请使用 {{billList}}（导出为 7 列待缴表格）。完整说明见列表页「打印占位符」→ 催缴单模板。'}
              {type === '收据' &&
                '账单列表请使用 {{billList}}（导出为含应收金额、已缴金额、本次收据等列的表格）。完整说明见列表页「打印占位符」→ 收据模板。'}
            </p>
            {isEdit && template?.type === '发票' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                该记录原为「发票」类型（已下线）。请选择「催缴单」或「收据」后保存。
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">模板文件（Word）</label>
            <input
              ref={fileInputRef}
              type="file"
              accept={DOCX_ACCEPT}
              className="hidden"
              onChange={onFileChange}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                <FileUp className="w-4 h-4" />
                {uploading ? '上传中…' : templateUrl ? '重新选择 Word' : '选择 Word 文档'}
              </button>
              {templateUrl && (
                <>
                  <a
                    href={templateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline max-w-[220px] truncate"
                    title={displayFileName}
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    {displayFileName || '已上传文件'}
                  </a>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="移除文件"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              每个模板仅支持 1 个 .docx 文件；重新选择将覆盖当前文件。可不传文件，稍后再配置。
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </div>
        </form>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            取消
          </button>
          <button
            type="submit"
            form="template-form"
            disabled={submitting || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
