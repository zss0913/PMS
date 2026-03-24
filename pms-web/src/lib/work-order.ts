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
  '待员工确认费用',
  '待租客确认费用',
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

/** 是否租客端报修发起的工单（评价须由租客提交，员工不可直接标记评价完成） */
export function isTenantSubmittedWorkOrderSource(raw: string | null | undefined): boolean {
  return displayWorkOrderSource(raw) === '租客自建'
}

/** 办结待评价：现场照片 URL 校验（1～10 张，路径须为 jpg/jpeg/png） */
export function validateWorkOrderCompletionImageUrls(
  urls: unknown
): { ok: true; urls: string[] } | { ok: false; message: string } {
  if (urls === undefined || urls === null) {
    return { ok: false, message: '请至少上传 1 张办结现场照片' }
  }
  if (!Array.isArray(urls)) {
    return { ok: false, message: '请至少上传 1 张办结现场照片' }
  }
  const list = urls
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map((s) => s.trim())
  if (list.length < 1) {
    return { ok: false, message: '请至少上传 1 张办结现场照片' }
  }
  if (list.length > 10) {
    return { ok: false, message: '办结照片最多 10 张' }
  }
  for (const u of list) {
    const base = u.split('?')[0] ?? ''
    if (!/\.(jpe?g|png)$/i.test(base)) {
      return { ok: false, message: '仅支持 jpg、jpeg、png 格式图片' }
    }
  }
  return { ok: true, urls: list }
}
