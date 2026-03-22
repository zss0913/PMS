'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { Home, Bell, User } from 'lucide-react'

const nav = [
  { href: '/m/staff', label: '首页', icon: Home, exact: true },
  { href: '/m/staff/messages', label: '消息通知', icon: Bell, exact: false },
  { href: '/m/staff/me', label: '我的', icon: User, exact: false },
]

function isTabActive(pathname: string, href: string, exact: boolean) {
  if (exact) {
    return pathname === href || pathname === `${href}/`
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function StaffMainShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/mp/me', { credentials: 'include' })
        const j = await r.json()
        if (cancelled) return
        if (!r.ok || j.user?.type !== 'employee') {
          router.replace('/m/staff/login')
          return
        }
        setReady(true)
      } catch {
        if (!cancelled) router.replace('/m/staff/login')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-slate-500 text-sm">
        加载中…
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] pb-[4.5rem]">
      {children}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        <ul className="flex justify-around items-stretch max-w-lg mx-auto">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = isTabActive(pathname, href, exact)
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                    active
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
