import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  success: '成功',
  failed: '失败',
}

const BILL_PAYMENT_STATUS: Record<string, string> = {
  unpaid: '未缴纳',
  partial: '部分缴纳',
  paid: '已结清',
}

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/payments')

  const { id } = await params
  const paymentId = parseInt(id, 10)
  if (isNaN(paymentId)) notFound()

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, companyId: user.companyId },
    include: {
      bills: {
        include: {
          bill: {
            select: {
              id: true,
              code: true,
              feeType: true,
              period: true,
              paymentStatus: true,
              building: { select: { name: true } },
              room: { select: { name: true, roomNumber: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!payment) notFound()

  const [tenant, operator] = await Promise.all([
    prisma.tenant.findFirst({
      where: { id: payment.tenantId, companyId: user.companyId },
      select: { companyName: true },
    }),
    prisma.employee.findFirst({
      where: { id: payment.operatorId, companyId: user.companyId },
      select: { name: true, phone: true },
    }),
  ])

  const returnToBill = (billId: number) =>
    `/bills/${billId}?returnTo=${encodeURIComponent(`/payments/${payment.id}`)}`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href="/payments"
          className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <ArrowLeft className="w-4 h-4" />
          返回缴纳记录
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">缴纳记录详情</h1>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">基本信息</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">缴纳编号</dt>
            <dd className="text-slate-900 dark:text-slate-100">{payment.code}</dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">租客</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {tenant?.companyName ?? '—'}
            </dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">缴纳时间</dt>
            <dd className="text-slate-900 dark:text-slate-100">{formatDateTime(payment.paidAt)}</dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">缴纳人</dt>
            <dd className="text-slate-900 dark:text-slate-100">{payment.payer}</dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">总额</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              ¥{Number(payment.totalAmount).toFixed(2)}
            </dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">支付方式</dt>
            <dd className="text-slate-900 dark:text-slate-100">{payment.paymentMethod}</dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">状态</dt>
            <dd>
              <span
                className={`inline-flex px-2 py-0.5 rounded text-xs ${
                  payment.paymentStatus === 'success'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {PAYMENT_STATUS_LABELS[payment.paymentStatus] ?? payment.paymentStatus}
              </span>
            </dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">操作人</dt>
            <dd className="text-slate-900 dark:text-slate-100">
              {operator ? `${operator.name}（${operator.phone}）` : `ID ${payment.operatorId}`}
            </dd>
          </div>
          <div className="flex gap-2 sm:gap-4">
            <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">创建时间</dt>
            <dd className="text-slate-900 dark:text-slate-100">{formatDateTime(payment.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
        <h2 className="text-lg font-semibold mb-4">关联账单</h2>
        {payment.bills.length === 0 ? (
          <p className="text-sm text-slate-500">暂无关联账单</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 text-left">
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">账单编号</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">费用类型</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">账期</th>
                  <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">本次缴纳</th>
                  <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">缴前待缴</th>
                  <th className="pb-2 pr-3 font-medium text-right whitespace-nowrap">缴后待缴</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">楼宇</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">房源</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">结清状态</th>
                  <th className="pb-2 font-medium whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {payment.bills.map((pb) => {
                  const b = pb.bill
                  const roomLabel =
                    b?.room?.roomNumber || b?.room?.name || (b ? '—' : '—')
                  const buildingName = b?.building?.name ?? '—'
                  return (
                    <tr
                      key={pb.id}
                      className="border-b border-slate-100 dark:border-slate-700/80 align-top"
                    >
                      <td className="py-3 pr-3 font-mono text-xs">{pb.billCode}</td>
                      <td className="py-3 pr-3">{b?.feeType ?? '—'}</td>
                      <td className="py-3 pr-3 whitespace-nowrap">{b?.period ?? '—'}</td>
                      <td className="py-3 pr-3 text-right">¥{Number(pb.amount).toFixed(2)}</td>
                      <td className="py-3 pr-3 text-right text-slate-600 dark:text-slate-400">
                        ¥{Number(pb.amountDueBefore).toFixed(2)}
                      </td>
                      <td className="py-3 pr-3 text-right text-slate-600 dark:text-slate-400">
                        ¥{Number(pb.amountDueAfter).toFixed(2)}
                      </td>
                      <td className="py-3 pr-3">{buildingName}</td>
                      <td className="py-3 pr-3">{roomLabel}</td>
                      <td className="py-3 pr-3">
                        {b?.paymentStatus
                          ? BILL_PAYMENT_STATUS[b.paymentStatus] ?? b.paymentStatus
                          : '—'}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {b ? (
                          <Link
                            href={returnToBill(b.id)}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            查看账单详情
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
