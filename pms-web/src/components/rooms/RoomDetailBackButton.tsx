'use client'

import { useSyncExternalStore } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { safeReturnPath } from '@/lib/safe-return-path'

interface RoomDetailBackButtonProps {
  /** 站内相对路径，优先返回到此页（如 /bills/123） */
  returnTo?: string
  from?: string
  tenantId?: string
}

// 使用 useSyncExternalStore 替代 useEffect + useState 来避免 React 19 的 setState-in-effect 错误
function useIsNewTab() {
  return useSyncExternalStore(
    () => () => {}, // 无需订阅，因为 window.opener 不会变化
    () => typeof window !== 'undefined' && !!window.opener,
    () => false // SSR 默认值
  )
}

export function RoomDetailBackButton({ returnTo, from, tenantId }: RoomDetailBackButtonProps) {
  const isNewTab = useIsNewTab()

  const handleClick = () => {
    // 如果是新标签页打开的，关闭当前标签
    if (isNewTab) {
      window.close()
      return
    }

    const safe = safeReturnPath(returnTo)
    if (safe) {
      window.location.href = safe
      return
    }

    // 有 from 参数，返回到来源页面
    if (from === 'tenant' && tenantId) {
      window.location.href = `/tenants/${tenantId}`
      return
    }

    // 默认返回房源列表
    window.location.href = '/rooms'
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600"
    >
      {isNewTab ? <X className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
      {isNewTab ? '关闭' : '返回'}
    </button>
  )
}
