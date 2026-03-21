/** 工单详情页横向流程节点（当前及之前节点高亮） */

const STEP_LABELS = [
  '创建',
  '派单',
  '响应',
  '处理',
  '费用确认',
  '待评价',
  '完成',
] as const

export type WorkOrderFlowStepState = {
  /** 当前所在步骤下标（含）；该下标及之前的节点点亮 */
  activeIndex: number
  cancelled: boolean
}

export function getWorkOrderFlowStepState(status: string): WorkOrderFlowStepState {
  if (status === '已取消') {
    return { activeIndex: -1, cancelled: true }
  }
  const map: Record<string, number> = {
    待派单: 1,
    待响应: 2,
    处理中: 3,
    待确认费用: 4,
    待评价: 5,
    评价完成: 6,
  }
  return { activeIndex: map[status] ?? 0, cancelled: false }
}

export function WorkOrderFlowStepBar({ status }: { status: string }) {
  const { activeIndex, cancelled } = getWorkOrderFlowStepState(status)

  if (cancelled) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200">
        工单已取消，流程已终止。
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-1 -mx-1">
      <div className="flex items-center min-w-max px-1 py-2">
        {STEP_LABELS.map((label, i) => {
          const done = i <= activeIndex
          const lineDone = i < activeIndex
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center w-[4.5rem] sm:w-[5.25rem] shrink-0">
                <div
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 text-xs sm:text-sm font-semibold transition-colors ${
                    done
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600'
                      : 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`mt-2 text-center text-[11px] sm:text-xs leading-tight px-0.5 ${
                    done
                      ? 'font-medium text-blue-800 dark:text-blue-300'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`h-0.5 w-4 sm:w-8 shrink-0 rounded-full mb-6 transition-colors ${
                    lineDone
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-slate-200 dark:bg-slate-600'
                  }`}
                  aria-hidden
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
