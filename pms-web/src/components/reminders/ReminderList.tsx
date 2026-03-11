'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'

type Reminder = {
  id: number
  code: string
  billIds: number[]
  billCodes: string
  method: string
  content: string | null
  status: string
  sentAt: string
  createdAt: string
}

type ApiData = {
  list: Reminder[]
}

const REMINDER_METHODS = ['微信', '短信', '邮件', '线下'] as const

export function ReminderList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reminders')
      const json = await res.json()
      if (json.success) setData(json.data)
      else setData(null)
    } catch {
      setError('网络错误')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法管理催缴</p>
        <p className="text-sm mt-1">请使用员工账号登录后操作。</p>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-red-500">
        {error}
      </div>
    )
  }

  const list = data?.list ?? []

  const formatDateTime = (s: string) => {
    try {
      const d = new Date(s)
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return s
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-end">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
        >
          <Plus className="w-4 h-4" />
          新建催缴
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-4 font-medium">催缴编号</th>
              <th className="text-left p-4 font-medium">关联账单</th>
              <th className="text-left p-4 font-medium">催缴方式</th>
              <th className="text-left p-4 font-medium">状态</th>
              <th className="text-left p-4 font-medium">发送时间</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-4 font-medium">{r.code}</td>
                <td className="p-4 max-w-[300px] truncate" title={r.billCodes}>{r.billCodes || '-'}</td>
                <td className="p-4">{r.method}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs ${
                    r.status === 'success'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {r.status === 'success' ? '已发送' : r.status}
                  </span>
                </td>
                <td className="p-4">{formatDateTime(r.sentAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          暂无催缴记录，点击「新建催缴」或从账单管理发起催缴
        </div>
      )}

      {createOpen && (
        <CreateReminderModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); fetchData() }}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
    </div>
  )
}

function CreateReminderModal({
  onClose,
  onSuccess,
  submitting,
  setSubmitting,
}: {
  onClose: () => void
  onSuccess: () => void
  submitting: boolean
  setSubmitting: (v: boolean) => void
}) {
  const [bills, setBills] = useState<{ id: number; code: string; amountDue: number; tenant?: { companyName: string } }[]>([])
  const [selectedBillIds, setSelectedBillIds] = useState<Set<number>>(new Set())
  const [method, setMethod] = useState('微信')
  const [content, setContent] = useState('')

  useEffect(() => {
    fetch('/api/bills')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const unpaid = (json.data.list ?? []).filter(
            (b: { paymentStatus: string }) => b.paymentStatus !== 'paid'
          )
          setBills(unpaid)
          setSelectedBillIds(new Set(unpaid.map((b: { id: number }) => b.id)))
        }
      })
  }, [])

  const toggleBill = (id: number) => {
    setSelectedBillIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedBillIds.size === 0) {
      alert('请至少选择一个账单')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billIds: Array.from(selectedBillIds),
          method,
          content: content || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        alert('催缴已发送')
        onSuccess()
      } else {
        alert(json.message || '催缴失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold">新建催缴</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            ×
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">选择账单（待缴）</label>
            <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-48 overflow-y-auto">
              {bills.map((b) => (
                <label key={b.id} className="flex items-center gap-2 p-2 border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBillIds.has(b.id)}
                    onChange={() => toggleBill(b.id)}
                  />
                  <span className="text-sm">{b.code} - {b.tenant?.companyName} 待缴 ¥{b.amountDue?.toFixed(2)}</span>
                </label>
              ))}
              {bills.length === 0 && (
                <div className="p-4 text-slate-500 text-sm">暂无待缴账单</div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">催缴方式 *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {REMINDER_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">催缴内容（选填）</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="选填"
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedBillIds.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '发送中...' : '发送催缴'}
          </button>
        </div>
      </div>
    </div>
  )
}
