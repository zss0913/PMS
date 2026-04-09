'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { zhCN } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PopoverDateRangeValue = { start: string; end: string }

type PopoverDateRangeFieldProps = {
  label: string
  start: string
  end: string
  onChange: (next: PopoverDateRangeValue) => void
  className?: string
  /** 占位与 Ant Design RangePicker 类似 */
  startPlaceholder?: string
  endPlaceholder?: string
}

function ymdToDate(ymd: string): Date | undefined {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function dateToYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeFromStrings(start: string, end: string): DateRange | undefined {
  const from = ymdToDate(start)
  const to = ymdToDate(end)
  if (!from && !to) return undefined
  if (from && !end.trim()) return { from, to: undefined }
  if (from && end.trim() && to) return { from, to }
  if (from && end.trim() && !to) return { from, to: undefined }
  if (!from && to) return { from: to, to: undefined }
  return undefined
}

/**
 * 单输入框 + 弹出双月日历的范围选择（类似 Ant Design RangePicker）。
 */
export function PopoverDateRangeField({
  label,
  start,
  end,
  onChange,
  className = '',
  startPlaceholder = '开始日期',
  endPlaceholder = '结束日期',
}: PopoverDateRangeFieldProps) {
  const [open, setOpen] = useState(false)
  const [monthCount, setMonthCount] = useState(2)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerId = useId()
  const labelId = useId()

  const selected = rangeFromStrings(start, end)

  const defaultMonth = ymdToDate(start) ?? ymdToDate(end) ?? new Date()

  useEffect(() => {
    const update = () => setMonthCount(typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 2)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onChange({ start: '', end: '' })
      return
    }
    const s = dateToYmd(range.from)
    const e = range.to ? dateToYmd(range.to) : ''
    onChange({ start: s, end: e })
    if (range.from && range.to) {
      setOpen(false)
    }
  }

  const displayStart = start || null
  const displayEnd = end || null

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <label id={labelId} htmlFor={triggerId} className="block text-xs text-slate-500 mb-1 dark:text-slate-400">
        {label}
      </label>
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${triggerId}-panel` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          /* 与巡检任务页面上方 select（px-3 py-2）同一视觉高度 */
          'flex w-full items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-left',
          'dark:border-slate-600 dark:bg-slate-700',
          'hover:border-slate-400 dark:hover:border-slate-500',
          'focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30'
        )}
      >
        <span className="relative min-w-0 flex-1 truncate">
          {displayStart ? (
            <span className="text-slate-900 dark:text-slate-100">{displayStart}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{startPlaceholder}</span>
          )}
          {open && !displayStart ? (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400"
              aria-hidden
            />
          ) : null}
        </span>
        <span className="mx-2 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden>
          →
        </span>
        <span className="relative min-w-0 flex-1 truncate text-right">
          {displayEnd ? (
            <span className="text-slate-900 dark:text-slate-100">{displayEnd}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{endPlaceholder}</span>
          )}
          {open && Boolean(displayStart) && !displayEnd ? (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400"
              aria-hidden
            />
          ) : null}
        </span>
        <CalendarDays className="ml-2 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
      </button>

      {open ? (
        <div
          id={`${triggerId}-panel`}
          role="dialog"
          aria-labelledby={labelId}
          className={cn(
            'absolute left-0 top-full z-50 mt-1 rounded-xl border border-slate-200 dark:border-slate-600',
            'bg-white dark:bg-slate-900 shadow-lg',
            '[--rdp-accent-color:#2563eb] [--rdp-accent-background-color:#eff6ff]',
            'dark:[--rdp-accent-color:#60a5fa] dark:[--rdp-accent-background-color:rgba(30,58,138,0.35)]'
          )}
        >
          <div className="p-2 sm:p-3">
            <DayPicker
              mode="range"
              locale={zhCN}
              numberOfMonths={monthCount}
              defaultMonth={defaultMonth}
              selected={selected}
              onSelect={handleSelect}
              showOutsideDays
            />
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700 pt-2 mt-1">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  onChange({ start: '', end: '' })
                  close()
                }}
              >
                清空
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500"
                onClick={close}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
