import type { PrismaClient } from '@prisma/client'
import type { InspectionCheckItemJson } from '@/lib/inspection-check-items'
import { planTypeMatchesCategory } from '@/lib/inspection-point-types'

/** 按所选巡检点 + 计划巡检类型生成检查项（仅启用且 NFC 与计划类型一致） */
export async function buildCheckItemsFromInspectionPointIds(
  prisma: PrismaClient,
  companyId: number,
  buildingId: number,
  inspectionType: string,
  pointIds: number[]
): Promise<{ ok: true; items: InspectionCheckItemJson[] } | { ok: false; message: string }> {
  if (pointIds.length === 0) {
    return { ok: false, message: '请至少选择一个巡检点' }
  }

  const seen = new Set<number>()
  const orderedIds: number[] = []
  for (const id of pointIds) {
    if (!seen.has(id)) {
      seen.add(id)
      orderedIds.push(id)
    }
  }

  const points = await prisma.inspectionPoint.findMany({
    where: {
      id: { in: orderedIds },
      companyId,
      buildingId,
      status: 'enabled',
    },
    include: {
      nfcTag: true,
    },
  })

  if (points.length !== orderedIds.length) {
    return { ok: false, message: '部分巡检点不存在、非本楼宇或未启用' }
  }

  const items: InspectionCheckItemJson[] = []

  for (const id of orderedIds) {
    const p = points.find((x) => x.id === id)
    if (!p) {
      return { ok: false, message: `巡检点 #${id} 无效` }
    }
    if (!planTypeMatchesCategory(inspectionType, p.inspectionCategory)) {
      return {
        ok: false,
        message: `巡检点「${p.name}」的类型为「${p.inspectionCategory}」，与当前计划的巡检类型「${inspectionType}」不一致`,
      }
    }
    if (p.nfcTagId == null || !p.nfcTag) {
      return {
        ok: false,
        message: `巡检点「${p.name}」未绑定 NFC，无法加入计划`,
      }
    }
    if (p.nfcTag.inspectionType !== inspectionType.trim()) {
      return {
        ok: false,
        message: `巡检点「${p.name}」绑定的 NFC 类型与计划不一致`,
      }
    }
    items.push({
      name: p.name.trim(),
      nfcTagId: p.nfcTagId,
    })
  }

  return { ok: true, items }
}
