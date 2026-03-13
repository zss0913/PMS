'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Copy, Check } from 'lucide-react'
import { PrintTemplateForm } from './PrintTemplateForm'

export type PrintTemplate = {
  id: number
  name: string
  type: string
  templateUrl?: string
  fields?: string
  status: string
}

const PLACEHOLDERS = [
  { key: '{{tenantName}}', desc: '租客名称' },
  { key: '{{buildingName}}', desc: '所属楼宇' },
  { key: '{{leaseArea}}', desc: '租赁面积' },
  { key: '{{roomNumber}}', desc: '房号' },
  { key: '{{billList}}', desc: '需缴纳账单列表' },
  { key: '{{totalAmount}}', desc: '需缴纳合计' },
  { key: '{{bankName}}', desc: '开户行' },
  { key: '{{accountNumber}}', desc: '银行账号' },
  { key: '{{accountHolder}}', desc: '开户名称' },
  { key: '{{propertyName}}', desc: '物业公司' },
  { key: '{{notifyTime}}', desc: '通知时间' },
]

export function PrintTemplateList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [list, setList] = useState<PrintTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showPlaceholders, setShowPlaceholders] = useState(false)

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
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            新增模板
          </button>
          <button
            onClick={() => setShowPlaceholders(!showPlaceholders)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Copy className="w-4 h-4" />
            打印占位符
          </button>
        </div>
      </div>

      {showPlaceholders && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-medium mb-3">催缴单模板可用占位符（点击复制）</h3>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                onClick={() => copyPlaceholder(p.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-blue-400 text-sm font-mono"
              >
                {copiedKey === p.key ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                {p.key}
                <span className="text-slate-500">({p.desc})</span>
              </button>
            ))}
          </div>
        </div>
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
