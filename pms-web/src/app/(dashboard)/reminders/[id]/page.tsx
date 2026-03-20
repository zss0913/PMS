import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'

function parseJsonIds(s: string | null): number[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.filter((x: unknown) => typeof x === 'number') : []
  } catch {
    return []
  }
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '未缴纳',
  partial: '部分缴纳',
  paid: '已结清',
}

export default async function ReminderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/reminders')

  const { id } = await params
  const rid = parseInt(id, 10)
  if (isNaN(rid)) notFound()

  const reminder = await prisma.paymentReminder.findFirst({
    where: { id: rid, companyId: user.companyId },
  })
  if (!reminder) notFound()

  const billIds = parseJsonIds(reminder.billIds)
  const bills =
    billIds.length > 0
      ? await prisma.bill.findMany({
          where: { id: { in: billIds }, companyId: user.companyId },
          include: {
            tenant: { select: { id: true, companyName: true } },
            building: { select: { id: true, name: true } },
          },
          orderBy: { id: 'asc' },
        })
      : []

  const returnTo = encodeURIComponent(`/reminders/${rid}`)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link
          href="/reminders"
          className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <ArrowLeft className="w-4 h-4" />
          返回催缴管理
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">催缴详情</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        催缴编号 <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{reminder.code}</span>
      </p>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-8 space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-slate-500 dark:text-slate-400">催缴方式</span>
            <p className="mt-0.5 text-slate-900 dark:text-slate-100">{reminder.method}</p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">发送时间</span>
            <p className="mt-0.5 text-slate-900 dark:text-slate-100">
              {new Date(reminder.sentAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">状态</span>
            <p className="mt-0.5">
              <span
                className={`inline-flex px-2 py-0.5 rounded text-xs ${
                  reminder.status === 'success'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                }`}
              >
                {reminder.status === 'success' ? '已发送' : reminder.status}
              </span>
            </p>
          </div>
          {reminder.content?.trim() ? (
            <div className="sm:col-span-2">
              <span className="text-slate-500 dark:text-slate-400">备注</span>
              <p className="mt-0.5 text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{reminder.content}</p>
            </div>
          ) : null}
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">关联账单</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left p-3 font-medium">账单编号</th>
              <th className="text-left p-3 font-medium">租客</th>
              <th className="text-left p-3 font-medium">费用类型</th>
              <th className="text-left p-3 font-medium">账期</th>
              <th className="text-right p-3 font-medium">待缴</th>
              <th className="text-left p-3 font-medium">结清状态</th>
              <th className="text-left p-3 font-medium w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr
                key={b.id}
                className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="p-3 font-mono">{b.code}</td>
                <td className="p-3">
                  {b.tenant ? (
                    <Link
                      href={`/tenants/${b.tenant.id}?returnTo=${returnTo}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {b.tenant.companyName}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3">{b.feeType}</td>
                <td className="p-3 text-slate-600 dark:text-slate-400">{b.period}</td>
                <td className="p-3 text-right">¥{Number(b.amountDue).toFixed(2)}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs ${
                      b.paymentStatus === 'paid'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : b.paymentStatus === 'partial'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {PAYMENT_STATUS_LABELS[b.paymentStatus] ?? b.paymentStatus}
                  </span>
                </td>
                <td className="p-3">
                  <Link
                    href={`/bills/${b.id}?returnTo=${returnTo}`}
                    className="text-blue-600 hover:underline dark:text-blue-400 text-xs"
                  >
                    查看账单
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bills.length === 0 && (
          <div className="p-8 text-center text-slate-500">暂无关联账单</div>
        )}
      </div>
    </div>
  )
}
