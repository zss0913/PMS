'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2,
  LayoutDashboard,
  Building,
  MapPin,
  Home,
  Users,
  UserCog,
  Settings,
  FileText,
  Receipt,
  CreditCard,
  AlertCircle,
  Wrench,
  ClipboardList,
  Nfc,
  Bell,
  MessageSquare,
  Cpu,
  ChevronDown,
  LogOut,
} from 'lucide-react'
import type { AuthUser } from '@/lib/auth'
import { cn } from '@/lib/utils'

const menuItems = [
  { href: '/', label: '首页', icon: LayoutDashboard },
  {
    label: '基础信息',
    icon: Building,
    children: [
      { href: '/buildings', label: '楼宇管理', icon: Building },
      { href: '/projects', label: '项目管理', icon: MapPin },
      { href: '/rooms', label: '房源管理', icon: Home },
      { href: '/tenants', label: '租客管理', icon: Users },
    ],
  },
  {
    label: '收费管理',
    icon: CreditCard,
    children: [
      { href: '/bill-rules', label: '账单规则', icon: FileText },
      { href: '/bills', label: '账单管理', icon: Receipt },
      { href: '/payments', label: '缴纳记录', icon: CreditCard },
      { href: '/refunds', label: '退费记录', icon: AlertCircle },
      { href: '/reminders', label: '催缴管理', icon: Bell },
    ],
  },
  {
    label: '物业服务设置',
    icon: Settings,
    children: [
      { href: '/nfc-tags', label: 'NFC标签', icon: Nfc },
      { href: '/devices', label: '设备台账', icon: Cpu },
      { href: '/work-order-types', label: '工单类型', icon: Wrench },
    ],
  },
  {
    label: '物业服务',
    icon: ClipboardList,
    children: [
      { href: '/work-orders', label: '工单管理', icon: Wrench },
      { href: '/inspection-plans', label: '巡检计划', icon: ClipboardList },
      { href: '/inspection-tasks', label: '巡检任务', icon: ClipboardList },
      { href: '/inspection-records', label: '巡检记录', icon: ClipboardList },
      { href: '/complaints', label: '卫生吐槽', icon: MessageSquare },
      { href: '/announcements', label: '公告管理', icon: Bell },
    ],
  },
  {
    label: '系统管理',
    icon: Settings,
    children: [
      { href: '/companies', label: '物业公司', icon: Building2 },
      { href: '/departments', label: '部门管理', icon: Building },
      { href: '/roles', label: '角色管理', icon: UserCog },
      { href: '/employees', label: '员工管理', icon: Users },
    ],
  },
]

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
    router.refresh()
  }

  const isSuperAdmin = user.type === 'super_admin'

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
      <div className="p-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="w-8 h-8 text-blue-400" />
          <span className="font-semibold text-white">PMS 物业</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {menuItems.map((item) => {
          if ('children' in item) {
            const hasActive = item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
            const filtered = isSuperAdmin
              ? item.children
              : item.children.filter((c) => c.href !== '/companies')
            if (filtered.length === 0) return null
            return (
              <div key={item.label} className="mb-1">
                <div className={cn(
                  'px-3 py-2 text-xs font-medium text-slate-500 uppercase',
                  hasActive && 'text-slate-400'
                )}>
                  {item.label}
                </div>
                {filtered.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition',
                      pathname === child.href
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                    )}
                  >
                    <child.icon className="w-4 h-4" />
                    {child.label}
                  </Link>
                ))}
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition mb-1',
                pathname === item.href
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2 px-3 py-2 text-sm">
          <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center">
            <span className="text-blue-400 font-medium">
              {user.name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate">{user.name}</div>
            <div className="text-xs text-slate-500 truncate">{user.phone}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full mt-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
