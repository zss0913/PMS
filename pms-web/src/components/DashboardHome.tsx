import Link from 'next/link'
import {
  DollarSign,
  FileText,
  Wrench,
  ClipboardCheck,
  AlertCircle,
  Building2,
  CreditCard,
} from 'lucide-react'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getStats(companyId: number) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [buildingCount, roomCount, tenantCount, bills, payments, refunds, workOrders, inspections] =
    await Promise.all([
      prisma.building.count({ where: { companyId } }),
      prisma.room.count({ where: { companyId } }),
      prisma.tenant.count({ where: { companyId } }),
      prisma.bill.findMany({
        where: { companyId, status: 'open', paymentStatus: { not: 'paid' } },
      }),
      prisma.payment.findMany({
        where: {
          companyId,
          paidAt: { gte: monthStart, lte: monthEnd },
          paymentStatus: 'success',
        },
      }),
      prisma.refund.findMany({
        where: {
          companyId,
          refundAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.workOrder.count({
        where: {
          companyId,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.inspectionRecord.count({
        where: {
          companyId,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      }),
    ])

  const totalReceivable = bills.reduce((s, b) => s + Number(b.amountDue), 0)
  const totalPaid = payments.reduce((s, p) => s + Number(p.totalAmount), 0)
  const totalRefund = refunds.reduce((s, r) => s + Number(r.amount), 0)
  const overdueCount = bills.filter(
    (b) => new Date(b.dueDate) < now && b.paymentStatus !== 'paid'
  ).length

  return {
    buildingCount,
    roomCount,
    tenantCount,
    totalReceivable,
    totalPaid,
    totalRefund,
    workOrders,
    inspections,
    overdueCount,
    pendingWorkOrders: await prisma.workOrder.count({
      where: { companyId, status: 'pending' },
    }),
  }
}

export async function DashboardHome({ user }: { user: AuthUser }) {
  const companyId = user.companyId
  const stats = companyId > 0 ? await getStats(companyId) : null

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">
        欢迎回来，{user.name}
      </h1>

      {stats ? (
        <>
          {/* 物业费统计 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard
              title="楼宇数量"
              value={stats.buildingCount}
              icon={Building2}
            />
            <StatCard
              title="房源数量"
              value={stats.roomCount}
              icon={Building2}
            />
            <StatCard
              title="租客数量"
              value={stats.tenantCount}
              icon={CreditCard}
            />
          </div>

          {/* 数据统计 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard
              title="本月应收"
              value={`¥${stats.totalReceivable.toLocaleString()}`}
              icon={DollarSign}
            />
            <StatCard
              title="本月已收"
              value={`¥${stats.totalPaid.toLocaleString()}`}
              icon={CreditCard}
            />
            <StatCard
              title="本月退款"
              value={`¥${stats.totalRefund.toLocaleString()}`}
              icon={DollarSign}
            />
            <StatCard
              title="本月工单"
              value={stats.workOrders}
              icon={Wrench}
            />
            <StatCard
              title="本月巡检"
              value={stats.inspections}
              icon={ClipboardCheck}
            />
          </div>

          {/* 待办事项 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold mb-4">待办事项</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <TodoCard
                href="/work-orders?status=pending"
                title="待派工单"
                count={stats.pendingWorkOrders}
              />
              <TodoCard
                href="/bills?overdue=1"
                title="逾期账单"
                count={stats.overdueCount}
                icon={AlertCircle}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-500">超级管理员模式，请选择物业公司或使用员工账号查看数据</p>
          <Link
            href="/companies"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            管理物业公司
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string | number
  icon: React.ElementType
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{title}</span>
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </div>
    </div>
  )
}

function TodoCard({
  href,
  title,
  count,
  icon: Icon = FileText,
}: {
  href: string
  title: string
  count: number
  icon?: React.ElementType
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
    >
      <Icon className="w-8 h-8 text-blue-500" />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-2xl font-bold text-blue-600">{count}</div>
      </div>
    </Link>
  )
}
