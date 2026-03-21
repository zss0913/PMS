'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, X } from 'lucide-react'

export type AssigneeEmployee = { id: number; name: string; phone: string }

function optionLabel(e: AssigneeEmployee) {
  return `${e.name} ${e.phone}`.trim()
}

export function EmployeeAssigneeSelect({
  employees,
  value,
  onChange,
  disabled,
  placeholder = '请选择处理人',
}: {
  employees: AssigneeEmployee[]
  value: number | null
  onChange: (id: number | null) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(
    () => employees.find((e) => e.id === value) ?? null,
    [employees, value]
  )

  const filtered = useMemo(() => {
    const raw = search.trim().toLowerCase()
    if (!raw) return employees
    return employees.filter((e) => {
      const name = e.name.toLowerCase()
      const phone = e.phone.replace(/\s/g, '')
      return name.includes(raw) || phone.includes(raw)
    })
  }, [employees, search])

  useEffect(() => {
    if (!open) return
    const onDoc = (ev: MouseEvent) => {
      if (rootRef.current?.contains(ev.target as Node)) return
      setOpen(false)
      setSearch('')
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setOpen(false)
        setSearch('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openPanel = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setSearch('')
  }, [disabled])

  const pick = (id: number) => {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={rootRef} className="relative">
      {!open ? (
        <div
          className={`flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 ${
            disabled ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={openPanel}
            className="flex-1 min-w-0 text-left px-3 py-2 text-sm rounded-l-lg hover:bg-slate-50 dark:hover:bg-slate-600/30 disabled:pointer-events-none"
          >
            <span
              className={`block truncate ${selected ? '' : 'text-slate-400 dark:text-slate-500'}`}
            >
              {selected ? optionLabel(selected) : placeholder}
            </span>
          </button>
          {selected && !disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="shrink-0 p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500"
              aria-label="清除选择"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={openPanel}
            className="shrink-0 p-2 rounded-r-lg hover:bg-slate-50 dark:hover:bg-slate-600/30 text-slate-400 disabled:pointer-events-none"
            aria-label="展开选项"
          >
            <ChevronDown className="w-4 h-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-lg overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入姓名或手机号筛选"
            className="w-full px-3 py-2 text-sm border-b border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          <ul className="max-h-52 overflow-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">
                无匹配员工（仅显示本物业公司启用账号）
              </li>
            ) : (
              filtered.map((e) => (
                <li key={e.id} role="option">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-600/50"
                    onClick={() => pick(e.id)}
                  >
                    {optionLabel(e)}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
