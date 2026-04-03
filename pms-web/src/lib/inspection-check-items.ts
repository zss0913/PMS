import type { PrismaClient } from '@prisma/client'

export type InspectionCheckItemJson = {
  name: string
  nfcTagId: number
  tagId?: string
  location?: string
}

export function parseCheckItemsJson(raw: string | null | undefined): InspectionCheckItemJson[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const o = x as Record<string, unknown>
        const name = typeof o.name === 'string' ? o.name.trim() : ''
        const nfcTagId = Number(o.nfcTagId)
        if (!name || !Number.isFinite(nfcTagId) || nfcTagId < 1) return null
        return {
          name,
          nfcTagId,
          ...(typeof o.tagId === 'string' ? { tagId: o.tagId } : {}),
          ...(typeof o.location === 'string' ? { location: o.location } : {}),
        } as InspectionCheckItemJson
      })
      .filter(Boolean) as InspectionCheckItemJson[]
  } catch {
    return []
  }
}

export async function validatePlanCheckItems(
  prisma: PrismaClient,
  companyId: number,
  inspectionType: string,
  buildingId: number,
  items: InspectionCheckItemJson[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (items.length === 0) {
    return { ok: false, message: '请至少添加一条检查项目并绑定 NFC' }
  }
  const ids = [...new Set(items.map((i) => i.nfcTagId))]
  const tags = await prisma.nfcTag.findMany({
    where: { id: { in: ids }, companyId },
  })
  const map = new Map(tags.map((t) => [t.id, t]))
  for (const it of items) {
    const t = map.get(it.nfcTagId)
    if (!t) return { ok: false, message: `NFC 标签不存在（id=${it.nfcTagId}）` }
    if (t.status !== 'active') return { ok: false, message: `NFC「${t.tagId}」已停用` }
    if (t.inspectionType !== inspectionType) {
      return { ok: false, message: `检查项「${it.name}」绑定的 NFC 巡检类型与计划不一致` }
    }
    if (t.buildingId !== buildingId) {
      return { ok: false, message: `检查项「${it.name}」绑定的 NFC 不属于所选楼宇` }
    }
  }
  return { ok: true }
}
