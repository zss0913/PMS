'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { WorkOrderType } from './WorkOrderTypeList'

export function WorkOrderTypeForm({
  type,
  onClose,
}: {
  type: WorkOrderType | null
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [sort, setSort] = useState(0)
  const [enabled, setEnabled] = useState(true)
  const [responseTimeoutHours, setResponseTimeoutHours] = useState<number | ''>('')
  const [notifyLeaderOnTimeout, setNotifyLeaderOnTimeout] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!type

  useEffect(() => {
    if (type) {
      setName(type.name)
      setSort(type.sort)
      setEnabled(type.enabled)
      setResponseTimeoutHours(type.responseTimeoutHours ?? '')
      setNotifyLeaderOnTimeout(type.notifyLeaderOnTimeout ?? false)
    } else {
      setName('')
      setSort(0)
      setEnabled(true)
      setResponseTimeoutHours('')
      setNotifyLeaderOnTimeout(false)
    }
  }, [type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body = {
        name,
        sort,
        enabled,
        responseTimeoutHours:
          responseTimeoutHours === '' || Number(responseTimeoutHours) <= 0 ? null : Number(responseTimeoutHours),
        notifyLeaderOnTimeout,
      }
      const url = isEdit ? `/api/work-order-types/${type!.id}` : '/api/work-order-types'
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
            {isEdit ? '编辑工单类型' : '新增工单类型'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="work-order-type-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">类型名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入类型名称"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">排序</label>
            <input
              type="number"
              value={sort}
              onChange={(e) => setSort(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="数字越小越靠前"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">是否启用</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="text-sm">启用</span>
            </label>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4 space-y-4">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">超时设置</p>
            <div>
              <label className="block text-sm font-medium mb-1">响应超时（小时）</label>
              <input
                type="number"
                min={0}
                value={responseTimeoutHours}
                onChange={(e) => {
                  const v = e.target.value
                  setResponseTimeoutHours(v === '' ? '' : Math.max(0, Number(v)))
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                placeholder="不填或0表示不启用超时"
              />
              <p className="text-xs text-slate-500 mt-1">派单后多久未响应视为超时，留空或0表示不启用</p>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyLeaderOnTimeout}
                  onChange={(e) => setNotifyLeaderOnTimeout(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">超时时提醒组长</span>
              </label>
              <p className="text-xs text-slate-500 mt-1">超时后是否通知组长</p>
            </div>
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
            form="work-order-type-form"
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
