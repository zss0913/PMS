/** 员工端打卡写入 `InspectionRecord.checkItems` 的 JSON 结构解析（PC 展示用） */

export type ParsedInspectionDetail =
  | { kind: 'normal'; remark?: string; images: string[] }
  | {
      kind: 'abnormal'
      pointName?: string
      description: string
      severity?: 'low' | 'medium' | 'high'
      images: string[]
      remark?: string
      submitWorkOrder: boolean
    }
  | { kind: 'empty' }
  | { kind: 'raw'; text: string }

export function inspectionSeverityLabel(sev: 'low' | 'medium' | 'high' | undefined) {
  if (sev === 'low') return '轻微'
  if (sev === 'high') return '紧急'
  if (sev === 'medium') return '一般'
  return '—'
}

export function parseInspectionRecordDetail(raw: string | null): ParsedInspectionDetail {
  if (raw == null || !String(raw).trim()) return { kind: 'empty' }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const images = Array.isArray(o.images)
      ? (o.images as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
      : []

    const desc = o.description
    /** 正常打卡仅有 remark/images；异常打卡必有 description 或显式 submitWorkOrder */
    const isAbnormal =
      typeof desc === 'string' || typeof o.submitWorkOrder === 'boolean'

    if (isAbnormal) {
      return {
        kind: 'abnormal',
        pointName: typeof o.pointName === 'string' ? o.pointName : undefined,
        description: typeof desc === 'string' ? desc : '',
        severity:
          o.severity === 'low' || o.severity === 'medium' || o.severity === 'high'
            ? o.severity
            : undefined,
        images,
        remark: typeof o.remark === 'string' ? o.remark : undefined,
        submitWorkOrder: o.submitWorkOrder === true,
      }
    }

    return {
      kind: 'normal',
      remark: typeof o.remark === 'string' ? o.remark : undefined,
      images,
    }
  } catch {
    return { kind: 'raw', text: String(raw) }
  }
}
