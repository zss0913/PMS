/**
 * 与 GET /api/bills 查询参数一致，供列表、催缴导出、统计等复用
 * paymentStatus：单值或逗号分隔多值（如 unpaid,partial），与「仅逾期」组合时取交集
 */
export type BillWhereParams = {
  buildingId?: string | null
  tenantId?: string | null
  status?: string | null
  paymentStatus?: string | null
  overdue?: string | null
  feeType?: string | null
  dueDateStart?: string | null
  dueDateEnd?: string | null
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
  }
  if (p.status) where.status = p.status
  if (p.feeType?.trim()) where.feeType = p.feeType.trim()

  if (p.dueDateStart || p.dueDateEnd) {
    const dateCond: Record<string, Date> = {}
    if (p.dueDateStart) {
      const d = new Date(p.dueDateStart)
      d.setHours(0, 0, 0, 0)
      dateCond.gte = d
    }
    if (p.dueDateEnd) {
      const d = new Date(p.dueDateEnd)
      d.setHours(23, 59, 59, 999)
      dateCond.lte = d
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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const or: Record<string, unknown>[] = [{ dueDate: { gte: today } }, { paymentStatus: 'paid' }]
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
