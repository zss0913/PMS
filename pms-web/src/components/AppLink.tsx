'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode, ComponentPropsWithoutRef } from 'react'

/**
 * 使用 router.push 的导航组件，替代 next/link 以规避浏览器扩展导致的点击无响应问题
 */
export function AppLink({
  href,
  children,
  className,
  ...props
}: {
  href: string
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<'span'>, 'onClick'>) {
  const router = useRouter()
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault()
        router.push(href)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(href)
        }
      }}
      className={`cursor-pointer ${className ?? ''}`}
      {...props}
    >
      {children}
    </span>
  )
}
