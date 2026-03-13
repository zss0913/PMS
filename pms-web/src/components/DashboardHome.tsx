import { TodoCard, CompaniesLink } from './DashboardHomeClient'
import {
  DollarSign,
  FileText,
  Wrench,
  ClipboardCheck,
  AlertCircle,
  Building2,
  CreditCard,
  Users,
  Home,
} from 'lucide-react'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** 根据数据权限获取楼宇ID过滤条件 */
async function getBuildingFilter(user: AuthUser): Promise<{ buildingIds?: number[] }> {
  if (user.companyId <= 0) return {}
  const dataScope = user.dataScope ?? 'all'
  if (dataScope === 'all') return {}

  if (dataScope === 'project' && user.projectId) {
    const ids = await prisma.building.findMany({
      where: { companyId: user.companyId, projectId: user.projectId },
      select: { id: true },
    })
    return { buildingIds: ids.map((b) => b.id) }
  }

  if (dataScope === 'department' && user.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: user.departmentId },
    })
    if (!dept?.buildingIds) return {}
    try {
      const ids = JSON.parse(dept.buildingIds) as number[]
      return { buildingIds: ids.length ? ids : undefined }
    } catch {
      return {}
    }
  }

  return {}
}

async function getStats(user: AuthUser) {
  const companyId = user.companyId
  if (companyId <= 0) return null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1, 23, 59, 59, 999)

  const buildingFilter = await getBuildingFilter(user)
  const buildingIdsFilter = buildingFilter.buildingIds?.length ? buildingFilter.buildingIds : null

  // 当前总面积：当前物业公司下所有楼宇的管理面积之和（= 所有房源管理面积之和，与楼宇管理列表的「管理面积」一致）
  const allRoomsForArea = await prisma.room.findMany({
    where: { companyId },
    select: { area: true },
  })
  const totalArea = allRoomsForArea.reduce((s, r) => s + Number(r.area), 0)

  // 物业费统计：按数据权限过滤楼宇
  const buildings = await prisma.building.findMany({
    where: {
      companyId,
      ...(buildingIdsFilter ? { id: { in: buildingIdsFilter } } : {}),
    },
    select: { id: true, area: true },
  })
  const buildingIds = buildings.map((b) => b.id)

  const rooms = await prisma.room.findMany({
    where: { companyId, buildingId: { in: buildingIds } },
    select: { id: true, area: true, status: true },
  })
  const leasedArea = rooms.filter((r) => r.status === '已租').reduce((s, r) => s + Number(r.area), 0)
  const selfUseArea = rooms.filter((r) => r.status === '自用').reduce((s, r) => s + Number(r.area), 0)

  // 在租租户数：有已租房源的租客(type=租客)
  const leasedRoomIds = rooms.filter((r) => r.status === '已租').map((r) => r.id)
  const selfUseRoomIds = rooms.filter((r) => r.status === '自用').map((r) => r.id)

  const [leasedTenantCount, selfUseTenantCount] = await Promise.all([
    leasedRoomIds.length
      ? prisma.tenantRoom.findMany({ where: { roomId: { in: leasedRoomIds } }, select: { tenantId: true } })
      : [],
    selfUseRoomIds.length
      ? prisma.tenantRoom.findMany({ where: { roomId: { in: selfUseRoomIds } }, select: { tenantId: true } })
      : [],
  ])

  const leasedTenantIds = [...new Set(leasedTenantCount.map((t) => t.tenantId))]
  const selfUseTenantIds = [...new Set(selfUseTenantCount.map((t) => t.tenantId))]

  const [activeLeasedCount, activeSelfUseCount] = await Promise.all([
    leasedTenantIds.length
      ? prisma.tenant.count({
          where: { id: { in: leasedTenantIds }, type: '租客', companyId },
        })
      : 0,
    selfUseTenantIds.length
      ? prisma.tenant.count({
          where: { id: { in: selfUseTenantIds }, type: '业主', companyId },
        })
      : 0,
  ])

  // 物业费实时均价 = 物业费总额(本月已收款) / 租赁面积
  const paymentsThisMonth = await prisma.payment.findMany({
    where: {
      companyId,
      paidAt: { gte: monthStart, lte: monthEnd },
      paymentStatus: 'success',
    },
    select: { totalAmount: true },
  })
  const paidAmountThisMonth = paymentsThisMonth.reduce((s, p) => s + Number(p.totalAmount), 0)
  const avgFeePerSqm = leasedArea > 0 ? paidAmountThisMonth / leasedArea : 0

  // 数据统计（按数据权限）
  const billWhere = {
    companyId,
    ...(buildingIds.length > 0 ? { buildingId: { in: buildingIds } } : {}),
  }

  // 本月按费用类型统计已收款：物业费、水费、电费、其他
  const paymentBillsThisMonth = await prisma.paymentBill.findMany({
    where: {
      payment: {
        companyId,
        paidAt: { gte: monthStart, lte: monthEnd },
        paymentStatus: 'success',
      },
    },
    include: { bill: { select: { feeType: true } } },
  })
  const monthFeeByType = {
    物业费: 0,
    水费: 0,
    电费: 0,
    其他: 0,
  }
  for (const pb of paymentBillsThisMonth) {
    const amt = Number(pb.amount)
    const ft = pb.bill.feeType
    if (ft === '物业费') monthFeeByType.物业费 += amt
    else if (ft === '水费') monthFeeByType.水费 += amt
    else if (ft === '电费') monthFeeByType.电费 += amt
    else if (ft === '水电费') {
      // 水电费按 50/50 拆分到水费和电费，或可全部计入电费，此处拆分为水费+电费各半
      monthFeeByType.水费 += amt / 2
      monthFeeByType.电费 += amt / 2
    } else monthFeeByType.其他 += amt // 租金、其他等
  }

  const [allUnpaidBills, payments, refunds, workOrdersThisMonth, inspectionRecordsThisMonth] =
    await Promise.all([
      prisma.bill.findMany({
        where: { ...billWhere, status: 'open', paymentStatus: { not: 'paid' } },
        select: { accountReceivable: true, dueDate: true },
      }),
      prisma.payment.findMany({
        where: {
          companyId,
          paidAt: { gte: monthStart, lte: monthEnd },
          paymentStatus: 'success',
        },
        select: { totalAmount: true },
      }),
      prisma.refund.findMany({
        where: {
          companyId,
          refundAt: { gte: monthStart, lte: monthEnd },
        },
        select: { amount: true },
      }),
      prisma.workOrder.count({
        where: {
          companyId,
          ...(buildingIds.length > 0 ? { buildingId: { in: buildingIds } } : {}),
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

  // 本月应收款：PRD 3.1.1.2 当前角色能看到的所有未结清账单的应收金额
  const monthReceivable = allUnpaidBills.reduce((s, b) => s + Number(b.accountReceivable), 0)
  const monthPaid = payments.reduce((s, p) => s + Number(p.totalAmount), 0)
  const monthRefund = refunds.reduce((s, r) => s + Number(r.amount), 0)
  const overdueBills = allUnpaidBills.filter((b) => new Date(b.dueDate) < now)

  // 待办事项：只展示分配给当前用户的数据
  const userId = user.id
  const isLeader = user.isLeader ?? false

  const [pendingAssignCount, pendingProcessCount, pendingInspectionCount] = await Promise.all([
    // 待派工单：status=待派单/pending，且（组长可见 或 有派单权限）
    prisma.workOrder.count({
      where: {
        companyId,
        status: { in: ['pending', '待派单'] },
        ...(buildingIds.length > 0 ? { buildingId: { in: buildingIds } } : {}),
        ...(isLeader ? {} : { id: -1 }), // 非组长不显示待派工单
      },
    }),
    // 待处理工单：assignedTo=当前用户，status in (待响应, 处理中)
    prisma.workOrder.count({
      where: {
        companyId,
        assignedTo: userId,
        status: { in: ['assigned', 'processing', '待响应', '处理中'] },
      },
    }),
    // 待巡检任务：status=待巡检/pending，userIds 包含当前用户
    prisma.inspectionTask.findMany({
      where: {
        companyId,
        status: { in: ['待巡检', 'pending'] },
      },
      select: { userIds: true },
    }).then((tasks) => {
      return tasks.filter((t) => {
        if (!t.userIds) return false
        try {
          const ids = JSON.parse(t.userIds) as number[]
          return ids.includes(userId)
        } catch {
          return false
        }
      }).length
    }),
  ])

  return {
    // 物业统计
    totalArea,
    leasedArea,
    selfUseArea,
    activeLeasedCount,
    activeSelfUseCount,
    avgFeePerSqm,
    // 数据统计
    monthReceivable,
    monthPaid,
    monthRefund,
    workOrdersThisMonth,
    inspectionRecordsThisMonth,
    // 待办
    pendingAssignCount,
    pendingProcessCount,
    pendingInspectionCount,
    overdueCount: overdueBills.length,
    // 本月按费用类型
    monthFeeProperty: monthFeeByType.物业费,
    monthFeeWater: monthFeeByType.水费,
    monthFeeElectric: monthFeeByType.电费,
    monthFeeOther: monthFeeByType.其他,
  }
}

export async function DashboardHome({ user }: { user: AuthUser }) {
  const stats = user.companyId > 0 ? await getStats(user) : null

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">
        欢迎回来，{user.name}
      </h1>

      {stats ? (
        <>
          {/* 物业统计（顶部） */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">物业统计</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <StatCard title="当前总面积" value={formatArea(stats.totalArea)} icon={Building2} />
              <StatCard title="租赁面积" value={formatArea(stats.leasedArea)} icon={Home} />
              <StatCard title="自用面积" value={formatArea(stats.selfUseArea)} icon={Home} />
              <StatCard title="在租租户数" value={stats.activeLeasedCount} icon={Users} />
              <StatCard title="在用业主数" value={stats.activeSelfUseCount} icon={Users} />
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard
                title="物业费实时均价"
                value={stats.leasedArea > 0 ? `¥${stats.avgFeePerSqm.toFixed(2)}/㎡` : '¥0/㎡'}
                icon={DollarSign}
              />
              <StatCard title="本月物业费" value={`¥${stats.monthFeeProperty.toLocaleString()}`} icon={DollarSign} />
              <StatCard title="本月水费" value={`¥${stats.monthFeeWater.toLocaleString()}`} icon={DollarSign} />
              <StatCard title="本月电费" value={`¥${stats.monthFeeElectric.toLocaleString()}`} icon={DollarSign} />
              <StatCard title="本月其他费用" value={`¥${stats.monthFeeOther.toLocaleString()}`} icon={DollarSign} />
            </div>
          </div>

          {/* 数据统计（中部） */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">数据统计（本月）</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard title="本月应收款金额" value={`¥${stats.monthReceivable.toLocaleString()}`} icon={DollarSign} />
              <StatCard title="本月已收款金额" value={`¥${stats.monthPaid.toLocaleString()}`} icon={CreditCard} />
              <StatCard title="本月退款金额" value={`¥${stats.monthRefund.toLocaleString()}`} icon={DollarSign} />
              <StatCard title="本月工单数" value={stats.workOrdersThisMonth} icon={Wrench} />
              <StatCard title="本月巡检记录数" value={stats.inspectionRecordsThisMonth} icon={ClipboardCheck} />
            </div>
          </div>

          {/* 待办事项（底部） */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold mb-4">待办事项</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <TodoCard href="/work-orders?status=pending" title="待派工单" count={stats.pendingAssignCount} />
              <TodoCard href="/work-orders?status=assigned,processing" title="待处理工单" count={stats.pendingProcessCount} />
              <TodoCard href="/inspection-tasks?status=pending" title="待巡检任务" count={stats.pendingInspectionCount} iconType="clipboard" />
              <TodoCard href="/bills?overdue=1" title="逾期账单" count={stats.overdueCount} iconType="alert" />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-500">超级管理员模式，请选择物业公司或使用员工账号查看数据</p>
          <CompaniesLink />
        </div>
      )}
    </div>
  )
}

/** 面积展示：超过1万用万㎡，否则直接展示数值+㎡ */
function formatArea(area: number): string {
  if (area >= 10000) {
    return `${(area / 10000).toFixed(2)} 万㎡`
  }
  return `${Math.round(area)} ㎡`
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
    <div className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-slate-400 shrink-0" />
      <div>
        <div className="text-sm text-slate-500">{title}</div>
        <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{value}</div>
      </div>
    </div>
  )
}

