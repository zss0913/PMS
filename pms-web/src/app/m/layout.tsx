import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'PMS 移动端',
  description: '物业管理系统 · 租客端 / 员工端 H5',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
}

export default function MRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      {children}
    </div>
  )
}
