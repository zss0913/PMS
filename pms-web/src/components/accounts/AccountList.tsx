'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { AccountForm } from './AccountForm'

export type Account = {
  id: number
  name: string
  bankName: string
  accountNumber: string
  accountHolder?: string
}

export function AccountList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [list, setList] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounts', { credentials: 'include' })
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

  const handleDelete = async (item: Account) => {
    if (!confirm(`确定删除收款账户「${item.name}」？`)) return
    setDeleting(item.id)
    try {
      const res = await fetch(`/api/accounts/${item.id}`, {
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

  const handleEdit = (item: Account) => {
    setEditingAccount(item)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingAccount(null)
    fetchData()
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理收款账户</p>
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增账户
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">账户名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium">开户行</th>
              <th className="px-4 py-3 text-left text-sm font-medium">银行账号</th>
              <th className="px-4 py-3 text-left text-sm font-medium">开户名称</th>
              <th className="px-4 py-3 text-right text-sm font-medium w-24">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  暂无收款账户，点击「新增账户」添加
                </td>
              </tr>
            ) : (
              list.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3">{a.bankName}</td>
                  <td className="px-4 py-3 font-mono text-sm">{a.accountNumber}</td>
                  <td className="px-4 py-3">{a.accountHolder || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(a)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      disabled={deleting === a.id}
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
        <AccountForm
          account={editingAccount}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
