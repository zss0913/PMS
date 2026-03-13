'use client'

import { useState, useEffect } from 'react'

type Setting = {
  id: number
  isEnabled: boolean
  sendDay: number
  sendTime: string
}

export function AutoReminderSettingForm({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [setting, setSetting] = useState<Setting | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEnabled, setIsEnabled] = useState(false)
  const [sendDay, setSendDay] = useState(1)
  const [sendTime, setSendTime] = useState('09:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auto-reminder-settings', { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        setSetting(d)
        setIsEnabled(d.isEnabled)
        setSendDay(d.sendDay)
        setSendTime(d.sendTime)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) fetchData()
  }, [isSuperAdmin])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auto-reminder-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isEnabled,
          sendDay,
          sendTime,
        }),
      })
      const json = await res.json()

      if (json.success) {
        setSuccess('保存成功')
        setSetting(json.data)
      } else {
        setError(json.message || '保存失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (isSuperAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
        <p className="font-medium">超级管理员账号无法配置自动催缴</p>
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
    <div className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm">
            {success}
          </div>
        )}

        <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="font-medium">启用自动催缴</span>
          </label>
          <span className="text-sm text-slate-500">
            每月定时对逾期账单发送催缴通知
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">每月发送日期</label>
            <select
              value={sendDay}
              onChange={(e) => setSendDay(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  每月 {d} 号
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">选择 1-28 号，避免月末日期差异</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">发送时间</label>
            <input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>
    </div>
  )
}
