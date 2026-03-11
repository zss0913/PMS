'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'

type InspectionPlan = {
  id: number
  name: string
  inspectionType: string
  cycleType: string
  cycleValue: number
  userIds: number[]
  checkItems: { name: string }[]
  status: string
}

type Employee = { id: number; name: string }

export function InspectionPlanForm({
  plan,
  employees,
  inspectionTypes,
  cycleTypes,
  onClose,
}: {
  plan: InspectionPlan | null
  employees: Employee[]
  inspectionTypes: string[]
  cycleTypes: string[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [inspectionType, setInspectionType] = useState('')
  const [cycleType, setCycleType] = useState('')
  const [cycleValue, setCycleValue] = useState(1)
  const [userIds, setUserIds] = useState<number[]>([])
  const [checkItems, setCheckItems] = useState<{ name: string }[]>([])
  const [status, setStatus] = useState('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!plan

  useEffect(() => {
    if (plan) {
      setName(plan.name)
      setInspectionType(plan.inspectionType)
      setCycleType(plan.cycleType)
      setCycleValue(plan.cycleValue)
      setUserIds(plan.userIds)
      setCheckItems(plan.checkItems?.length ? plan.checkItems : [{ name: '' }])
      setStatus(plan.status)
    } else {
      setName('')
      setInspectionType(inspectionTypes[0] || '')
      setCycleType(cycleTypes[0] || '')
      setCycleValue(1)
      setUserIds([])
      setCheckItems([{ name: '' }])
      setStatus('active')
    }
  }, [plan, inspectionTypes, cycleTypes])

  useEffect(() => {
    if (!isEdit && inspectionTypes.length && !inspectionType) {
      setInspectionType(inspectionTypes[0])
    }
    if (!isEdit && cycleTypes.length && !cycleType) {
      setCycleType(cycleTypes[0])
    }
  }, [isEdit, inspectionTypes, cycleTypes, inspectionType, cycleType])

  const addCheckItem = () => {
    setCheckItems((prev) => [...prev, { name: '' }])
  }

  const removeCheckItem = (idx: number) => {
    setCheckItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateCheckItem = (idx: number, name: string) => {
    setCheckItems((prev) => {
      const next = [...prev]
      next[idx] = { name }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('计划名称必填')
      return
    }
    const validItems = checkItems.filter((c) => c.name?.trim())
    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        inspectionType: inspectionType || inspectionTypes[0],
        cycleType: cycleType || cycleTypes[0],
        cycleValue,
        userIds,
        checkItems: validItems,
        ...(isEdit && { status }),
      }
      const url = isEdit ? `/api/inspection-plans/${plan!.id}` : '/api/inspection-plans'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        onClose()
      } else {
        setError(json.message || '保存失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUserId = (id: number) => {
    setUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? '编辑巡检计划' : '新建巡检计划'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          id="inspection-plan-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">计划名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="请输入计划名称"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">巡检类型 *</label>
            <select
              value={inspectionType}
              onChange={(e) => setInspectionType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              required
            >
              {inspectionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">周期类型 *</label>
              <select
                value={cycleType}
                onChange={(e) => setCycleType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                required
              >
                {cycleTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">周期值</label>
              <input
                type="number"
                min={1}
                value={cycleValue}
                onChange={(e) => setCycleValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">巡检人员</label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 max-h-32 overflow-y-auto space-y-2">
              {employees.length === 0 ? (
                <p className="text-sm text-slate-500">暂无员工</p>
              ) : (
                employees.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userIds.includes(e.id)}
                      onChange={() => toggleUserId(e.id)}
                      className="rounded"
                    />
                    <span>{e.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">检查项目</label>
              <button
                type="button"
                onClick={addCheckItem}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
            <div className="space-y-2">
              {checkItems.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateCheckItem(idx, e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    placeholder="检查项名称"
                  />
                  <button
                    type="button"
                    onClick={() => removeCheckItem(idx)}
                    className="p-2 text-slate-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          {isEdit && (
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
          )}
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
            form="inspection-plan-form"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
