'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Pencil, Trash2, Copy, Check, X } from 'lucide-react'
import { PrintTemplateForm } from './PrintTemplateForm'
import {
  DUNNING_PLACEHOLDERS,
  RECEIPT_PLACEHOLDERS,
  INVOICE_PLACEHOLDERS,
} from './print-placeholder-docs'

export type PrintTemplate = {
  id: number
  name: string
  type: string
  templateUrl?: string
  fields?: string
  status: string
}

export function PrintTemplateList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [list, setList] = useState<PrintTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [placeholderDrawerOpen, setPlaceholderDrawerOpen] = useState(false)
  const [drawerMounted, setDrawerMounted] = useState(false)

  useEffect(() => {
    setDrawerMounted(true)
  }, [])

  useEffect(() => {
    if (!placeholderDrawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [placeholderDrawerOpen])

  useEffect(() => {
    if (!placeholderDrawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaceholderDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placeholderDrawerOpen])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/print-templates', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setList(Array.isArray(json.data) ? json.data : [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const handleDelete = async (item: PrintTemplate) => {
    if (!confirm(`确定删除打印模板「${item.name}」？`)) return
    setDeleting(item.id)
    try {
      const res = await fetch(`/api/print-templates/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) fetchData()
      else alert(json.message || '删除失败')
    } finally {
      setDeleting(null)
    }
  }

  const handleEdit = (item: PrintTemplate) => {
    setPlaceholderDrawerOpen(false)
    setEditingTemplate(item)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingTemplate(null)
    fetchData()
  }

  const copyPlaceholder = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const handleToggleStatus = async (item: PrintTemplate) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active'
    try {
      const res = await fetch(`/api/print-templates/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (json.success) fetchData()
      else alert(json.message || '操作失败')
    } catch {
      alert('网络错误')
    }
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理打印模板</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setPlaceholderDrawerOpen(false)
              setFormOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            新增模板
          </button>
          <button
            type="button"
            onClick={() => setPlaceholderDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Copy className="w-4 h-4" />
            打印占位符
          </button>
        </div>
      </div>

      {drawerMounted &&
        placeholderDrawerOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="print-placeholder-drawer-title">
            <div className="flex h-full w-full">
              <aside className="flex h-full w-full max-w-lg shrink-0 flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <h2 id="print-placeholder-drawer-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  打印占位符
                </h2>
                <button
                  type="button"
                  onClick={() => setPlaceholderDrawerOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="关闭"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  按模板类型在 Word 中插入占位符；带表格的需写{' '}
                  <code className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{billList}}'}</code>{' '}
                  （导出前会转为 Word 表格）。点击下方标签可复制。
                </p>

                <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/80 dark:bg-blue-950/20 p-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">催缴单模板</h3>
                  <p className="text-xs text-blue-800/80 dark:text-blue-200/80 mb-3">
                    账单列表为 7 列表格，强调<strong>应收 / 已缴 / 待缴</strong>，合计行汇总待缴相关列。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DUNNING_PLACEHOLDERS.map((p) => (
                      <button
                        key={`dunning-${p.key}`}
                        type="button"
                        onClick={() => copyPlaceholder(p.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-blue-200/80 dark:border-blue-800 hover:border-blue-500 text-sm font-mono text-left max-w-full"
                      >
                        {copiedKey === p.key ? (
                          <Check className="w-3.5 h-3.5 shrink-0 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        )}
                        <span className="break-all">{p.key}</span>
                        <span className="text-slate-600 dark:text-slate-400 font-sans text-xs">({p.desc})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/20 p-4">
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-1">收据模板</h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mb-3">
                    账单列表为 7 列表格（含应收金额、已缴金额），强调<strong>本次收据（元）</strong>；合计行含应收、已缴与本次开具合计。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {RECEIPT_PLACEHOLDERS.map((p) => (
                      <button
                        key={`receipt-${p.key}`}
                        type="button"
                        onClick={() => copyPlaceholder(p.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200/80 dark:border-emerald-800 hover:border-emerald-500 text-sm font-mono text-left max-w-full"
                      >
                        {copiedKey === p.key ? (
                          <Check className="w-3.5 h-3.5 shrink-0 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        )}
                        <span className="break-all">{p.key}</span>
                        <span className="text-slate-600 dark:text-slate-400 font-sans text-xs">({p.desc})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 p-4">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">发票模板</h3>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mb-3">
                    当前 <code className="font-mono">{'{{billList}}'}</code> 为<strong>纯文本多行</strong>（非表格）；其它占位符与收据类似。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {INVOICE_PLACEHOLDERS.map((p) => (
                      <button
                        key={`invoice-${p.key}`}
                        type="button"
                        onClick={() => copyPlaceholder(p.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-amber-800 hover:border-amber-500 text-sm font-mono text-left max-w-full"
                      >
                        {copiedKey === p.key ? (
                          <Check className="w-3.5 h-3.5 shrink-0 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        )}
                        <span className="break-all">{p.key}</span>
                        <span className="text-slate-600 dark:text-slate-400 font-sans text-xs">({p.desc})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              </aside>
              <button
                type="button"
                className="min-h-0 min-w-0 flex-1 bg-black/40 backdrop-blur-[1px]"
                aria-label="关闭"
                onClick={() => setPlaceholderDrawerOpen(false)}
              />
            </div>
          </div>,
          document.body
        )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">模板名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium">模板类型</th>
              <th className="px-4 py-3 text-left text-sm font-medium">模板文件</th>
              <th className="px-4 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-4 py-3 text-right text-sm font-medium w-32">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  暂无打印模板，点击「新增模板」添加
                </td>
              </tr>
            ) : (
              list.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">{t.name}</td>
                  <td className="px-4 py-3">{t.type}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {t.templateUrl ? (
                      <a href={t.templateUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        查看文件
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(t)}
                      className={`px-2 py-0.5 rounded text-sm ${
                        t.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {t.status === 'active' ? '启用' : '停用'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(t)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      disabled={deleting === t.id}
                      className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <PrintTemplateForm
          template={editingTemplate}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
