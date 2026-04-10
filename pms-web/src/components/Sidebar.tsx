'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2,
  LayoutDashboard,
  Building,
  Layers,
  MapPin,
  LocateFixed,
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
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wallet,
  FileType,
  BellRing,
  ScrollText,
  Landmark,
  UserCircle,
  History,
  Smartphone,
} from 'lucide-react'
import type { AuthUser } from '@/lib/auth'
import { MENU_PATH_TO_ID } from '@/lib/menu-config'
import { useRolePermissions } from '@/hooks/useRolePermissions'
import { cn } from '@/lib/utils'

// Flower Spinner Icon - 来自 epic-spinners（缩小尺寸）
function FlowerSpinnerIcon({ className }: { className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <style jsx>{`
        .flower-spinner {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
        }
        .flower-spinner .dots-container {
          height: 10px;
          width: 10px;
        }
        .flower-spinner .smaller-dot {
          background: #3b82f6;
          height: 100%;
          width: 100%;
          border-radius: 50%;
          animation: flower-spinner-smaller-dot-animation 2.5s 0s infinite both;
        }
        .flower-spinner .bigger-dot {
          background: #3b82f6;
          height: 100%;
          width: 100%;
          padding: 10%;
          border-radius: 50%;
          animation: flower-spinner-bigger-dot-animation 2.5s 0s infinite both;
        }
        @keyframes flower-spinner-bigger-dot-animation {
          0% {
            box-shadow: #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px,
              #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px;
          }
          25%, 75% {
            box-shadow: #3b82f6 12px 0px 0px, #3b82f6 -12px 0px 0px, #3b82f6 0px 12px 0px, #3b82f6 0px -12px 0px,
              #3b82f6 9px -9px 0px, #3b82f6 9px 9px 0px, #3b82f6 -9px -9px 0px, #3b82f6 -9px 9px 0px;
          }
          50% {
            transform: rotate(180deg);
          }
          100% {
            transform: rotate(360deg);
            box-shadow: #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px,
              #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px, #3b82f6 0px 0px 0px;
          }
        }
        @keyframes flower-spinner-smaller-dot-animation {
          0% {
            box-shadow: #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px,
              #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px;
          }
          25%, 75% {
            box-shadow: #06b6d4 7px 0px 0px, #06b6d4 -7px 0px 0px, #06b6d4 0px 7px 0px, #06b6d4 0px -7px 0px,
              #06b6d4 5px -5px 0px, #06b6d4 5px 5px 0px, #06b6d4 -5px -5px 0px, #06b6d4 -5px 5px 0px;
          }
          100% {
            box-shadow: #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px,
              #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px, #06b6d4 0px 0px 0px;
          }
        }
      `}</style>
      <div className="flower-spinner">
        <div className="dots-container">
          <div className="bigger-dot">
            <div className="smaller-dot"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

const menuItems = [
  { href: '/', label: '首页', icon: LayoutDashboard },
  { href: '/sectional-view', label: '剖面图', icon: Layers },
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
    label: '财务设置',
    icon: Wallet,
    children: [
      { href: '/accounts', label: '收款账户管理', icon: Wallet },
      { href: '/bill-rules', label: '账单规则', icon: FileText },
      { href: '/print-templates', label: '催缴打印模板管理', icon: FileType },
      { href: '/auto-reminder-settings', label: '自动催缴设置', icon: BellRing },
    ],
  },
  {
    label: '收费管理',
    icon: CreditCard,
    children: [
      { href: '/bills', label: '账单管理', icon: Receipt },
      { href: '/invoice-records', label: '开票记录', icon: Landmark },
      { href: '/receipt-records', label: '收据记录', icon: ScrollText },
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
      { href: '/inspection-points', label: '巡检点', icon: LocateFixed },
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
      { href: '/device-maintenance-records', label: '设备维保记录', icon: History },
      { href: '/complaints', label: '卫生吐槽', icon: MessageSquare },
      { href: '/announcements', label: '公告管理', icon: Bell },
    ],
  },
  {
    label: '系统管理',
    icon: Settings,
    children: [
      { href: '/companies', label: '物业公司', icon: Building2 },
      { href: '/platform/mp-settings', label: '全局小程序配置', icon: Smartphone },
      { href: '/departments', label: '部门管理', icon: Building },
      { href: '/roles', label: '角色管理', icon: UserCog },
      { href: '/employees', label: '员工账号', icon: Users },
      { href: '/tenant-users', label: '租客账号', icon: UserCircle },
    ],
  },
]

interface SidebarProps {
  user: AuthUser
  collapsed?: boolean
  onCollapseChange?: (collapsed: boolean) => void
}

export function Sidebar({ user, collapsed: propCollapsed, onCollapseChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { canMenu } = useRolePermissions()
  const [collapsed, setCollapsed] = useState(propCollapsed ?? false)

  // 从 localStorage 读取折叠状态（首帧与 SSR 均为默认展开，避免 hydration 不一致；不整段隐藏侧栏以免主区误占满宽挡点击）
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) {
      const isCollapsed = saved === 'true'
      setCollapsed(isCollapsed)
      onCollapseChange?.(isCollapsed)
    }
  }, [])

  // 同步外部状态
  useEffect(() => {
    if (propCollapsed !== undefined && propCollapsed !== collapsed) {
      setCollapsed(propCollapsed)
    }
  }, [propCollapsed])

  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed
    setCollapsed(newCollapsed)
    localStorage.setItem('sidebar-collapsed', String(newCollapsed))
    onCollapseChange?.(newCollapsed)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
    router.refresh()
  }

  const handleNavigate = (href: string) => {
    if (pathname !== href) {
      router.push(href)
    }
  }

  const isSuperAdmin = user.type === 'super_admin'
  const restrictEmployeeMenu = user.type === 'employee' && !isSuperAdmin

  const menuHrefAllowed = (href: string) => {
    if (!restrictEmployeeMenu) return true
    const mid = MENU_PATH_TO_ID[href]
    if (mid == null) return true
    return canMenu(mid)
  }

  return (
    <aside
      className={cn(
        'shrink-0 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-300 ease-in-out relative',
        collapsed ? 'w-16' : 'w-52'
      )}
    >
      {/* 折叠/展开按钮 */}
      <button
        onClick={handleToggleCollapse}
        className={cn(
          'absolute -right-3 top-6 z-50 w-6 h-6 rounded-full bg-slate-700 border border-slate-600',
          'flex items-center justify-center text-slate-400 hover:bg-slate-600 hover:text-white transition',
          'shadow-lg cursor-pointer'
        )}
        title={collapsed ? '展开菜单' : '收起菜单'}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Logo区域 */}
      <div className={cn('p-4 border-b border-slate-800', collapsed && 'p-3')}>
        <div
          onClick={() => handleNavigate('/')}
          className={cn(
            'flex items-center cursor-pointer hover:opacity-80 transition',
            collapsed ? 'justify-center' : 'gap-2'
          )}
          title={collapsed ? '物业管理系统' : undefined}
        >
          <FlowerSpinnerIcon className={cn('shrink-0', collapsed ? 'scale-50' : 'scale-[0.65]')} />
          {!collapsed && <span className="font-semibold text-white text-lg tracking-wide ml-1">物业管理系统</span>}
        </div>
      </div>

      {/* 导航菜单 - 透明滚动条，融合到菜单背景 */}
      <nav className={cn('flex-1 overflow-y-auto scrollbar-transparent', collapsed ? 'p-1' : 'p-2')}>
        {menuItems.map((item) => {
          if ('children' in item) {
            const children = item.children ?? []
            const filtered = isSuperAdmin
              ? children
              : children.filter(
                  (c) => c.href !== '/companies' && c.href !== '/platform/mp-settings'
                )
            const visible = filtered.filter((c) => menuHrefAllowed(c.href))
            const hasActive = visible.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
            if (visible.length === 0) return null

            return (
              <div key={item.label} className={cn('mb-1', collapsed && 'mb-2')}>
                {/* 分组标题 - 折叠时隐藏 */}
                {!collapsed && (
                  <div
                    className={cn(
                      'px-3 py-2 text-xs font-medium text-slate-500 uppercase',
                      hasActive && 'text-slate-400'
                    )}
                  >
                    {item.label}
                  </div>
                )}
                {/* 折叠时显示分组图标作为视觉分隔 */}
                {collapsed && hasActive && (
                  <div className="h-px bg-slate-700/50 mx-2 my-2" />
                )}

                {visible.map((child) => {
                  const Icon = child.icon
                  const isActive =
                    pathname === child.href || pathname.startsWith(`${child.href}/`)
                  return (
                    <button
                      key={child.href}
                      onClick={() => handleNavigate(child.href)}
                      className={cn(
                        'flex items-center transition cursor-pointer select-none',
                        'hover:bg-slate-800 hover:text-white',
                        collapsed
                          ? 'w-10 h-10 mx-auto rounded-lg justify-center text-slate-400 mb-1'
                          : 'w-full gap-2 px-3 py-2 rounded-lg text-sm text-left text-slate-400',
                        isActive && (collapsed ? 'bg-blue-600/30 text-blue-400' : 'bg-blue-600/20 text-blue-400')
                      )}
                      title={collapsed ? child.label : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span>{child.label}</span>}
                    </button>
                  )
                })}
              </div>
            )
          }

          const Icon = item.icon
          const isActive = pathname === item.href
          if (!menuHrefAllowed(item.href)) return null
          return (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className={cn(
                'flex items-center transition cursor-pointer select-none mb-1',
                'hover:bg-slate-800 hover:text-white',
                collapsed
                  ? 'w-10 h-10 mx-auto rounded-lg justify-center text-slate-400'
                  : 'w-full gap-2 px-3 py-2 rounded-lg text-sm text-left text-slate-400',
                isActive && (collapsed ? 'bg-blue-600/30 text-blue-400' : 'bg-blue-600/20 text-blue-400')
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* 底部用户信息 */}
      <div className={cn('border-t border-slate-800', collapsed ? 'p-2' : 'p-4')}>
        {/* 用户信息 */}
        <div className={cn('flex items-center text-sm', collapsed ? 'justify-center' : 'gap-2 px-3 py-2')}>
          <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center shrink-0">
            <span className="text-blue-400 font-medium">{user.name?.charAt(0) || 'U'}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-500 truncate">{user.phone}</div>
            </div>
          )}
        </div>

        {/* 退出登录 */}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center transition text-slate-400 hover:bg-slate-800 hover:text-red-400',
            collapsed
              ? 'w-10 h-10 mx-auto mt-2 rounded-lg justify-center'
              : 'w-full gap-2 mt-2 px-3 py-2 rounded-lg text-sm'
          )}
          title={collapsed ? '退出登录' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>退出登录</span>}
        </button>
      </div>
    </aside>
  )
}
