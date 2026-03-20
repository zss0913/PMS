'use client'

export type DateRangeValue = { start: string; end: string }

type DateRangeFieldProps = {
  /** 整段控件标题（一个标签对应起止） */
  label: string
  start: string
  end: string
  onChange: (next: DateRangeValue) => void
  /** 辅助说明：inline 显示在控件下方；tooltip 仅悬停在外框上；none 不展示（可由外部单独写说明） */
  hint?: string
  hintMode?: 'inline' | 'tooltip' | 'none'
  className?: string
  /** 无障碍：起止输入的简短说明 */
  startAriaLabel?: string
  endAriaLabel?: string
}

/**
 * 单组件形式的日期范围：同一外框内选择开始、结束，避免两个独立日期块。
 */
export function DateRangeField({
  label,
  start,
  end,
  onChange,
  hint,
  hintMode = 'inline',
  className = '',
  startAriaLabel = '开始日期',
  endAriaLabel = '结束日期',
}: DateRangeFieldProps) {
  const showHintBelow = Boolean(hint) && hintMode === 'inline'
  const hintTitle = hint && hintMode === 'tooltip' ? hint : undefined

  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1 min-h-[1rem] leading-tight">{label}</label>
      <div
        title={hintTitle}
        className="flex min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500/50"
        role="group"
        aria-label={label}
      >
        <input
          type="date"
          aria-label={startAriaLabel}
          value={start}
          onChange={(e) => onChange({ start: e.target.value, end })}
          className="flex-1 min-w-0 min-h-[2.5rem] px-2 py-2 text-sm border-0 bg-transparent dark:bg-slate-700 focus:outline-none focus:ring-0"
        />
        <span
          className="flex shrink-0 items-center px-2 text-sm text-slate-400 dark:text-slate-500 border-x border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50"
          aria-hidden
        >
          至
        </span>
        <input
          type="date"
          aria-label={endAriaLabel}
          value={end}
          onChange={(e) => onChange({ start, end: e.target.value })}
          className="flex-1 min-w-0 min-h-[2.5rem] px-2 py-2 text-sm border-0 bg-transparent dark:bg-slate-700 focus:outline-none focus:ring-0"
        />
      </div>
      {showHintBelow ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</p>
      ) : null}
    </div>
  )
}
