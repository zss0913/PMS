import type { ReactNode } from 'react'
import { getAuthUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fetchBillActivityLogsForBill } from '@/lib/bill-activity-log-db'
import { formatBillRoomsDisplay } from '@/lib/bill-merged-rooms'
import { getBillRelatedRoomsForDetail } from '@/lib/bill-room-resolve'
import { formatDateTime } from '@/lib/utils'
import { safeReturnPath } from '@/lib/safe-return-path'
import { BillDetailTabs } from '@/components/bills/BillDetailTabs'
import { BillAttachmentsPanel } from '@/components/bills/BillAttachmentsPanel'
import { ArrowLeft } from 'lucide-react'

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '未缴纳',
  partial: '部分缴纳',
  paid: '已结清',
}
const STATUS_LABELS: Record<string, string> = {
  open: '开启',
  closed: '关闭',
}

const ACTION_LABELS: Record<string, string> = {
  create: '创建账单',
  update: '修改账单',
  delete: '删除账单',
  payment: '线下缴费',
  refund: '退费',
  receipt_export: '生成收据',
  dunning_export: '生成催缴单',
  reminder_record: '催缴记录',
}

type ChangeEntry = { field: string; label: string; from: string; to: string }

function parseChanges(json: string | null): ChangeEntry[] {
  if (!json?.trim()) return []
  try {
    const v = JSON.parse(json) as unknown
    return Array.isArray(v) ? (v as ChangeEntry[]) : []
  } catch {
    return []
  }
}

export default async function BillDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/bills')

  const { id } = await params
  const { returnTo } = await searchParams
  const safeReturn = safeReturnPath(returnTo)
  const billId = parseInt(id, 10)
  if (isNaN(billId)) notFound()

  const bill = await prisma.bill.findFirst({
    where: { id: billId, companyId: user.companyId },
    include: {
      tenant: { select: { id: true, companyName: true } },
      room: { select: { id: true, name: true, roomNumber: true } },
      building: { select: { id: true, name: true } },
      rule: { select: { id: true, name: true, code: true } },
      account: {
        select: {
          id: true,
          bankName: true,
          accountNumber: true,
          accountHolder: true,
        },
      },
      payments: { include: { payment: true } },
      refunds: true,
    },
  })

  if (!bill) notFound()

  const [rooms, activityLogs] = await Promise.all([
    getBillRelatedRoomsForDetail(prisma, user.companyId, bill),
    fetchBillActivityLogsForBill(prisma, user.companyId, bill.id),
  ])

  const roomsDisplay = formatBillRoomsDisplay(bill.remark, bill.room)
  const dunningCount = activityLogs.filter((l) => l.action === 'dunning_export').length
  const receiptCount = activityLogs.filter((l) => l.action === 'receipt_export').length

  const backHref = safeReturn ?? '/bills'
  const backLabel = safeReturn ? '返回' : '返回账单列表'
  /** 从缴纳详情进入时带上 returnTo，子页面（如房源）返回仍能回到账单再回缴纳详情 */
  const billSelfPath = safeReturn
    ? `/bills/${bill.id}?returnTo=${encodeURIComponent(safeReturn)}`
    : `/bills/${bill.id}`

  const infoRows: { label: string; value: ReactNode }[] = [
    { label: '账单编号', value: bill.code },
    { label: '租客', value: bill.tenant.companyName },
    { label: '楼宇', value: bill.building?.name ?? '—' },
    { label: '房源（汇总）', value: roomsDisplay },
    { label: '费用类型', value: bill.feeType },
    {
      label: '总量',
      value:
        bill.quantityTotal != null && bill.quantityTotal !== undefined
          ? String(Number(bill.quantityTotal))
          : '—',
    },
    {
      label: '单价（元）',
      value:
        bill.unitPrice != null && bill.unitPrice !== undefined
          ? Number(bill.unitPrice).toFixed(2)
          : '—',
    },
    { label: '账期', value: bill.period },
    {
      label: '应收',
      value: `¥${Number(bill.accountReceivable).toFixed(2)}`,
    },
    {
      label: '已缴',
      value: `¥${Number(bill.amountPaid).toFixed(2)}`,
    },
    {
      label: '待缴',
      value: `¥${Number(bill.amountDue).toFixed(2)}`,
    },
    {
      label: '已开收据',
      value: `¥${Number(bill.receiptIssuedAmount ?? 0).toFixed(2)}`,
    },
    {
      label: '状态',
      value: STATUS_LABELS[bill.status] ?? bill.status,
    },
    {
      label: '结清状态',
      value: PAYMENT_STATUS_LABELS[bill.paymentStatus] ?? bill.paymentStatus,
    },
    {
      label: '应收日期',
      value: bill.dueDate.toISOString().slice(0, 10),
    },
    {
      label: '账单规则',
      value: bill.rule ? `${bill.ruleName}（${bill.rule.code}）` : bill.ruleName,
    },
    {
      label: '收款账户',
      value: bill.account
        ? `${bill.account.bankName} ${bill.account.accountNumber} ${bill.account.accountHolder ?? ''}`.trim()
        : '-',
    },
    {
      label: '创建时间',
      value: formatDateTime(bill.createdAt),
    },
    {
      label: '更新时间',
      value: formatDateTime(bill.updatedAt),
    },
    {
      label: '备注',
      value: bill.remark?.trim() ? (
        <span className="whitespace-pre-wrap">{bill.remark}</span>
      ) : (
        '-'
      ),
    },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">账单详情</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        生成催缴单累计 <span className="font-medium text-slate-700 dark:text-slate-200">{dunningCount}</span> 次；
        生成收据累计 <span className="font-medium text-slate-700 dark:text-slate-200">{receiptCount}</span> 次（以操作日志为准）
      </p>

      <BillDetailTabs attachmentsSlot={<BillAttachmentsPanel billId={bill.id} />}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {infoRows.map((row) => (
            <div key={row.label} className="flex gap-2 sm:gap-4">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">{row.label}</dt>
              <dd className="text-slate-900 dark:text-slate-100 min-w-0 break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      </BillDetailTabs>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">关联房源</h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-slate-500">
            {bill.billSource === 'manual' && !bill.buildingId
              ? '手工账单未关联楼宇与房源（可选填总量、单价说明计费依据）'
              : '暂无房源数据'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 text-left">
                  <th className="pb-2 pr-4 font-medium">楼宇</th>
                  <th className="pb-2 pr-4 font-medium">楼层</th>
                  <th className="pb-2 pr-4 font-medium">房号</th>
                  <th className="pb-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 dark:border-slate-700/80"
                  >
                    <td className="py-2 pr-4">{r.building.name}</td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-400">
                      {r.floor?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-4">{r.roomNumber || r.name || '-'}</td>
                    <td className="py-2">
                      <Link
                        href={`/rooms/${r.id}?buildingId=${r.buildingId}&returnTo=${encodeURIComponent(billSelfPath)}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        查看房源详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(bill.payments.length > 0 || bill.refunds.length > 0) && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">缴费与退费</h2>
          {bill.payments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">缴费记录</h3>
              <ul className="text-sm space-y-1">
                {bill.payments.map((pb) => (
                  <li key={pb.id}>
                    缴费单 {pb.payment.code}：¥{Number(pb.amount).toFixed(2)}（
                    {formatDateTime(pb.payment.paidAt)}，{pb.payment.paymentMethod}）
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bill.refunds.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">退费记录</h3>
              <ul className="text-sm space-y-1">
                {bill.refunds.map((rf) => (
                  <li key={rf.id}>
                    {rf.code}：¥{Number(rf.amount).toFixed(2)}（{formatDateTime(rf.refundAt)}）
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
        <h2 className="text-lg font-semibold mb-4">操作日志</h2>
        {activityLogs.length === 0 ? (
          <p className="text-sm text-slate-500">暂无操作记录（新功能上线后的操作将从此处记录）</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 text-left">
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">时间</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">操作类型</th>
                  <th className="pb-2 pr-3 font-medium">操作人</th>
                  <th className="pb-2 pr-3 font-medium">账号</th>
                  <th className="pb-2 font-medium min-w-[200px]">说明 / 字段变更</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((log) => {
                  const changes = parseChanges(log.changesJson)
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-slate-100 dark:border-slate-700/80 align-top"
                    >
                      <td className="py-3 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </td>
                      <td className="py-3 pr-3">{log.operatorName ?? '-'}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{log.operatorPhone ?? '-'}</td>
                      <td className="py-3">
                        {log.summary && (
                          <p className="text-slate-800 dark:text-slate-200 mb-1">{log.summary}</p>
                        )}
                        {changes.length > 0 && (
                          <ul className="mt-1 space-y-1 text-slate-600 dark:text-slate-400">
                            {changes.map((c) => (
                              <li key={c.field}>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {c.label}
                                </span>
                                ：{c.from} → {c.to}
                              </li>
                            ))}
                          </ul>
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
