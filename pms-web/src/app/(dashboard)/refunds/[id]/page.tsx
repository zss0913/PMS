import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { safeReturnPath } from '@/lib/safe-return-path'
import { ArrowLeft } from 'lucide-react'

export default async function RefundDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/refunds')

  const { id } = await params
  const { returnTo } = await searchParams
  const safeReturn = safeReturnPath(returnTo)
  const backHref = safeReturn ?? '/refunds'
  const backLabel = safeReturn ? '返回' : '返回退费记录'

  const refundId = parseInt(id, 10)
  if (isNaN(refundId)) notFound()

  const refund = await prisma.refund.findFirst({
    where: { id: refundId, companyId: user.companyId },
    include: {
      bill: {
        select: {
          id: true,
          code: true,
          tenant: { select: { companyName: true } },
        },
      },
    },
  })

  if (!refund) notFound()

  const operator = await prisma.employee.findFirst({
    where: { id: refund.operatorId, companyId: user.companyId },
    select: { name: true, phone: true },
  })

  const billReturn = `/bills/${refund.billId}?returnTo=${encodeURIComponent(`/refunds/${refund.id}`)}`

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">退费详情</h1>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
        <h2 className="text-lg font-semibold mb-4">基本信息</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">退费编号</dt>
            <dd className="text-slate-900 dark:text-slate-100 font-mono">{refund.code}</dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">账单</dt>
            <dd>
              <Link href={billReturn} className="text-blue-600 hover:underline dark:text-blue-400 font-mono text-xs">
                {refund.bill.code}
              </Link>
            </dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">租客</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {refund.bill.tenant?.companyName ?? '—'}
            </dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">退费金额</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              ¥{Number(refund.amount).toFixed(2)}
            </dd>
          </div>
          <div className="flex gap-2 sm:gap-4 sm:col-span-2">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">原因</dt>
            <dd className="text-slate-900 dark:text-slate-100 min-w-0 break-words">{refund.reason}</dd>
          </div>
          {refund.remark?.trim() ? (
            <div className="flex gap-2 sm:gap-4 sm:col-span-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">备注</dt>
              <dd className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{refund.remark}</dd>
            </div>
          ) : null}
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">退费人</dt>
            <dd className="text-slate-900 dark:text-slate-100">{refund.refunder}</dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">退费时间</dt>
            <dd className="text-slate-900 dark:text-slate-100">{formatDateTime(refund.refundAt)}</dd>
          </div>
          <div className="flex gap-2 sm:gap-4 sm:col-span-2">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">操作人</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {operator ? `${operator.name}（${operator.phone}）` : `ID ${refund.operatorId}`}
            </dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">创建时间</dt>
            <dd className="text-slate-900 dark:text-slate-100">{formatDateTime(refund.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
