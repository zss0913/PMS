'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/** 从维保详情等入口进入工单前写入，返回时优先回到该路径（如带 ?detail= 的维保页） */
export const WORK_ORDER_RETURN_PATH_KEY = 'pms_work_order_return_path'

export function rememberWorkOrderReturnPath(path: string) {
  if (typeof window === 'undefined') return
  try {
    if (path.startsWith('/') && !path.startsWith('//')) {
      sessionStorage.setItem(WORK_ORDER_RETURN_PATH_KEY, path)
    }
  } catch {
    /* 隐私模式等 */
  }
}

/**
 * 单一「返回」：URL 显式 returnTo（站内）优先，其次 sessionStorage（维保等），再 history.back，最后 fallback。
 */
export function WorkOrderDetailBackButton({
  fallbackHref = '/work-orders',
  presetReturnHref,
}: {
  fallbackHref?: string
  /** 从列表等入口经 ?returnTo= 传入，已在校验层净化 */
  presetReturnHref?: string | null
}) {
  const router = useRouter()

  const handleBack = () => {
    if (presetReturnHref) {
      router.push(presetReturnHref)
      return
    }
    try {
      const stored = sessionStorage.getItem(WORK_ORDER_RETURN_PATH_KEY)
      if (stored) {
        sessionStorage.removeItem(WORK_ORDER_RETURN_PATH_KEY)
        router.push(stored)
        return
      }
    } catch {
      /* ignore */
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
    >
      <ArrowLeft className="w-4 h-4" />
      返回
    </button>
  )
}
