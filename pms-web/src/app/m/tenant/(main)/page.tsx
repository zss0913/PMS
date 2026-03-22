'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function TenantHomePage() {
  const [name, setName] = useState('')
  const [ctx, setCtx] = useState<{
    tenantName: string | null
    buildingName: string | null
    roomLabel: string | null
  } | null>(null)

  useEffect(() => {
    void (async () => {
      const me = await fetch('/api/mp/me', { credentials: 'include' }).then((r) => r.json())
      if (me.user?.name) setName(me.user.name)
      const c = await fetch('/api/mp/work-order-submit-context', { credentials: 'include' }).then(
        (r) => r.json()
      )
      if (c.success && c.data) {
        setCtx({
          tenantName: c.data.tenantName,
          buildingName: c.data.buildingName,
          roomLabel: c.data.roomLabel,
        })
      }
    })()
  }, [])

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <header className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 shadow">
        <p className="text-sm opacity-90">租客端</p>
        <h1 className="text-xl font-semibold mt-1">{name ? `${name}，你好` : '欢迎'}</h1>
        {ctx && (
          <div className="mt-3 text-sm opacity-95 space-y-0.5">
            {ctx.tenantName && <p>企业：{ctx.tenantName}</p>}
            {ctx.buildingName && <p>楼宇：{ctx.buildingName}</p>}
            {ctx.roomLabel && <p>房源：{ctx.roomLabel}</p>}
            {!ctx.tenantName && <p className="opacity-80">暂未关联租客，请联系物业绑定后再报修</p>}
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/m/tenant/work-orders/new"
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <p className="font-medium text-blue-600 dark:text-blue-400">报事报修</p>
          <p className="text-xs text-slate-500 mt-1">提交工单</p>
        </Link>
        <Link
          href="/m/tenant/bills"
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <p className="font-medium">我的账单</p>
          <p className="text-xs text-slate-500 mt-1">查看与缴费</p>
        </Link>
        <Link
          href="/m/tenant/complaints"
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <p className="font-medium">卫生吐槽</p>
          <p className="text-xs text-slate-500 mt-1">提交与进度</p>
        </Link>
        <Link
          href="/m/tenant/messages"
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <p className="font-medium">消息通知</p>
          <p className="text-xs text-slate-500 mt-1">物业公告与通知</p>
        </Link>
      </div>

      <p className="text-xs text-slate-400 text-center pt-2">
        数据与 PC 管理端实时同步；报修进度可在报事报修提交后于工单列表查看
      </p>
    </div>
  )
}
