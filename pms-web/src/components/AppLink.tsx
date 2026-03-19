'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode, ComponentPropsWithoutRef } from 'react'

/**
 * 使用 router.push 的导航组件，替代 next/link 以规避浏览器扩展导致的点击无响应问题
 * 支持 target="_blank" 时使用原生 <a> 标签打开新标签页
 */
export function AppLink({
  href,
  children,
  className,
  target,
  ...props
}: {
  href: string
  children: ReactNode
  className?: string
  target?: string
} & Omit<ComponentPropsWithoutRef<'span'>, 'onClick'>) {
  const router = useRouter()

  // 如果指定了 target="_blank"，使用原生 <a> 标签
  if (target === '_blank') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`cursor-pointer ${className ?? ''}`}
        {...props}
      >
        {children}
      </a>
    )
  }

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
