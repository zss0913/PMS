import type { PrismaClient } from '@prisma/client'

const INSPECTION_WO_SOURCES = ['巡检发现', '巡检异常'] as const

/**
 * 巡检异常记录关联的工单：优先读 checkItems JSON 内 workOrderId/workOrderCode；
 * 否则按 taskId + tagId + 巡检类来源回查（兼容旧数据、异常上报接口未写入工单号的情况）。
 * JSON 内显式 `submitWorkOrder: false` 表示仅保存异常，不做回查。
 */
export async function resolveLinkedWorkOrderForInspectionRecord(
  prisma: PrismaClient,
  args: {
    companyId: number
    taskId: number
    tagId: string
    checkItemsJson: string | null
    recordStatus: string
  }
): Promise<{ id: number; code: string } | null> {
  try {
    if (args.checkItemsJson?.trim()) {
      const o = JSON.parse(args.checkItemsJson) as Record<string, unknown>
      if (o.submitWorkOrder === false) return null

      const wid = o.workOrderId
      const wcode = o.workOrderCode
      if (typeof wid === 'number' && typeof wcode === 'string' && wcode.trim()) {
        const wo = await prisma.workOrder.findFirst({
          where: { id: wid, companyId: args.companyId },
          select: { id: true, code: true },
        })
        if (wo && wo.code === wcode) return { id: wo.id, code: wo.code }
      }
    }
  } catch {
    /* ignore */
  }

  if (args.recordStatus !== 'abnormal') return null

  const wo = await prisma.workOrder.findFirst({
    where: {
      companyId: args.companyId,
      taskId: args.taskId,
      tagId: args.tagId,
      source: { in: [...INSPECTION_WO_SOURCES] },
    },
    orderBy: { id: 'desc' },
    select: { id: true, code: true },
  })
  return wo ? { id: wo.id, code: wo.code } : null
}

type RecordLike = {
  id: number
  taskId: number
  tagId: string
  checkItems: string | null
  status: string
}

/** 列表页批量解析关联工单，避免逐条查询 */
export async function batchResolveLinkedWorkOrdersForInspectionRecords(
  prisma: PrismaClient,
  companyId: number,
  records: RecordLike[]
): Promise<Map<number, { id: number; code: string }>> {
  const out = new Map<number, { id: number; code: string }>()
  const jsonCandidates: { recordId: number; wid: number; wcode: string }[] = []
  const noWorkOrderRecordIds = new Set<number>()

  for (const r of records) {
    try {
      if (r.checkItems?.trim()) {
        const o = JSON.parse(r.checkItems) as Record<string, unknown>
        if (o.submitWorkOrder === false) {
          noWorkOrderRecordIds.add(r.id)
          continue
        }
        const wid = o.workOrderId
        const wcode = o.workOrderCode
        if (typeof wid === 'number' && typeof wcode === 'string' && wcode.trim()) {
          jsonCandidates.push({ recordId: r.id, wid, wcode: wcode.trim() })
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (jsonCandidates.length > 0) {
    const ids = [...new Set(jsonCandidates.map((c) => c.wid))]
    const wos = await prisma.workOrder.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true, code: true },
    })
    const byId = Object.fromEntries(wos.map((w) => [w.id, w]))
    for (const c of jsonCandidates) {
      const wo = byId[c.wid]
      if (wo && wo.code === c.wcode) out.set(c.recordId, { id: wo.id, code: wo.code })
    }
  }

  const needPairLookup = records.filter(
    (r) =>
      r.status === 'abnormal' &&
      !out.has(r.id) &&
      !noWorkOrderRecordIds.has(r.id)
  )
  if (needPairLookup.length > 0) {
    const taskIds = [...new Set(needPairLookup.map((r) => r.taskId))]
    const tagIds = [...new Set(needPairLookup.map((r) => r.tagId))]
    const wos = await prisma.workOrder.findMany({
      where: {
        companyId,
        source: { in: [...INSPECTION_WO_SOURCES] },
        taskId: { in: taskIds },
        tagId: { in: tagIds },
      },
      select: { id: true, code: true, taskId: true, tagId: true },
      orderBy: { id: 'desc' },
    })
    const pairToWo = new Map<string, { id: number; code: string }>()
    for (const wo of wos) {
      if (wo.taskId == null || wo.tagId == null) continue
      const key = `${wo.taskId}\t${wo.tagId}`
      if (!pairToWo.has(key)) pairToWo.set(key, { id: wo.id, code: wo.code })
    }
    for (const r of needPairLookup) {
      const wo = pairToWo.get(`${r.taskId}\t${r.tagId}`)
      if (wo) out.set(r.id, wo)
    }
  }

  return out
}
