'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { PrintTemplate } from './PrintTemplateList'

const TEMPLATE_TYPES = [
  { value: '催缴单', label: '催缴单' },
  { value: '收据', label: '收据' },
]

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
  const [status, setStatus] = useState('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!template

  useEffect(() => {
    if (template) {
      setName(template.name)
      setType(template.type)
      setTemplateUrl(template.templateUrl ?? '')
      setStatus(template.status)
    } else {
      setName('')
      setType('催缴单')
      setTemplateUrl('')
      setStatus('active')
    }
  }, [template])

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
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">模板文件 URL</label>
            <input
              type="text"
              value={templateUrl}
              onChange={(e) => setTemplateUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="DOCX 文件路径或 URL，选填"
            />
            <p className="text-xs text-slate-500 mt-1">上传 DOCX 后填写文件路径，或留空后续配置</p>
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
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '提交中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
