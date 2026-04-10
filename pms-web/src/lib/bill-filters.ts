/**
 * 与 GET /api/bills 查询参数一致，供列表、催缴导出、统计等复用
 * paymentStatus：单值或逗号分隔多值（如 unpaid,partial），与「仅逾期」组合时取交集
 */
export type BillWhereParams = {
  buildingId?: string | null
  /** 精确租客 ID（如从链接 tenantId= 进入）；与 tenantKeyword 二选一，优先 tenantId */
  tenantId?: string | null
  /** 租客公司名称模糊（contains） */
  tenantKeyword?: string | null
  status?: string | null
  paymentStatus?: string | null
  overdue?: string | null
  /** 费用类型精确（旧参数，兼容） */
  feeType?: string | null
  /** 费用类型模糊（contains）；若传则优先于 feeType */
  feeTypeKeyword?: string | null
  dueDateStart?: string | null
  dueDateEnd?: string | null
}

/** 解析账单 `period` 字段，格式为 `YYYY-MM-DD ~ YYYY-MM-DD` */
export function parseBillPeriodBounds(period: string): { start: string; end: string } | null {
  const m = period.trim().match(/^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/)
  if (!m) return null
  return { start: m[1]!, end: m[2]! }
}

/**
 * 筛选区间 [filterStart, filterEnd]（含首尾，YYYY-MM-DD）与账单账期 [billStart, billEnd] 是否有交集。
 * 即：账期中任意一天落在筛选区间内 ↔ 两区间重叠。
 */
export function filterBillsByPeriodOverlap<T extends { period: string }>(
  bills: T[],
  filterStart: string | null | undefined,
  filterEnd: string | null | undefined
): T[] {
  const fs = filterStart?.trim().slice(0, 10)
  const fe = filterEnd?.trim().slice(0, 10)
  if (!fs || !fe) return bills
  if (fs > fe) return []
  return bills.filter((b) => {
    const p = parseBillPeriodBounds(b.period)
    if (!p) return false
    return p.start <= fe && p.end >= fs
  })
}

/** 解析结清状态：逗号分隔，去空 */
export function parsePaymentStatusParam(s: string | null | undefined): string[] | null {
  if (!s?.trim()) return null
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean)
  return parts.length ? parts : null
}

export function buildBillWhereClause(companyId: number, p: BillWhereParams): Record<string, unknown> {
  const where: Record<string, unknown> = { companyId }
  if (p.buildingId) {
    const bid = parseInt(String(p.buildingId), 10)
    if (!isNaN(bid)) where.buildingId = bid
  }
  if (p.tenantId) {
    const tid = parseInt(String(p.tenantId), 10)
    if (!isNaN(tid)) where.tenantId = tid
  } else if (p.tenantKeyword?.trim()) {
    where.tenant = { companyName: { contains: p.tenantKeyword.trim() } }
  }
  if (p.status) where.status = p.status
  if (p.feeTypeKeyword?.trim()) {
    where.feeType = { contains: p.feeTypeKeyword.trim() }
  } else if (p.feeType?.trim()) {
    where.feeType = p.feeType.trim()
  }

  if (p.dueDateStart || p.dueDateEnd) {
    const dateCond: Record<string, Date> = {}
    if (p.dueDateStart) {
      dateCond.gte = new Date(p.dueDateStart + 'T00:00:00.000Z')
    }
    if (p.dueDateEnd) {
      dateCond.lte = new Date(p.dueDateEnd + 'T23:59:59.999Z')
    }
    where.dueDate = dateCond
  }

  const selected = parsePaymentStatusParam(p.paymentStatus)

  if (p.overdue === 'true') {
    if (selected?.length) {
      const allowed = selected.filter((s) => s !== 'paid')
      if (allowed.length === 0) {
        where.id = -1
        return where
      }
      where.paymentStatus = { in: allowed }
    } else {
      where.paymentStatus = { not: 'paid' }
    }
    if (where.dueDate && typeof where.dueDate === 'object') {
      const d = where.dueDate as Record<string, Date>
      where.dueDate = { ...d, lt: new Date() }
    } else {
      where.dueDate = { lt: new Date() }
    }
  } else if (p.overdue === 'false') {
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayStart = new Date(todayStr + 'T00:00:00.000Z')
    const or: Record<string, unknown>[] = [{ dueDate: { gte: todayStart } }, { paymentStatus: 'paid' }]
    if (selected?.length) {
      where.AND = [{ paymentStatus: { in: selected } }, { OR: or }]
    } else {
      where.OR = or
    }
  } else if (selected?.length) {
    where.paymentStatus = { in: selected }
  }

  return where
}
