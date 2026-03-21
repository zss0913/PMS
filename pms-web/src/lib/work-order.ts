/** 工单来源（列表筛选、写入库字段值；与业务口径一致） */
export const WORK_ORDER_SOURCE_OPTIONS = [
  'PC自建',
  '员工端自建',
  '租客自建',
  '巡检发现',
] as const

export type WorkOrderSource = (typeof WORK_ORDER_SOURCE_OPTIONS)[number]

/** 历史或兼容别名 → 展示用标准名称 */
export function displayWorkOrderSource(raw: string | null | undefined): string {
  if (!raw) return '-'
  if (raw === '租客端') return '租客自建'
  if (raw === 'PC端') return 'PC自建'
  return raw
}

/** 工单状态（列表筛选、校验） */
export const WORK_ORDER_STATUS_OPTIONS = [
  '待派单',
  '待响应',
  '处理中',
  '待确认费用',
  '待评价',
  '评价完成',
  '已取消',
] as const

export type WorkOrderStatus = (typeof WORK_ORDER_STATUS_OPTIONS)[number]

/** 解析工单 images 字段（JSON 字符串数组） */
export function parseWorkOrderImageUrls(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const j = JSON.parse(raw) as unknown
    if (Array.isArray(j)) return j.filter((x): x is string => typeof x === 'string')
  } catch {
    /* ignore */
  }
  return []
}
