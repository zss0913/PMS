/** 卫生吐槽状态（库内统一存中文；兼容历史英文值） */
export const COMPLAINT_STATUS = {
  pending: '待处理',
  processing: '处理中',
  completed: '已处理',
} as const

export type ComplaintStatusCn = (typeof COMPLAINT_STATUS)[keyof typeof COMPLAINT_STATUS]

const LEGACY_TO_CN: Record<string, ComplaintStatusCn> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已处理',
  待处理: '待处理',
  处理中: '处理中',
  已处理: '已处理',
}

export function normalizeComplaintStatus(raw: string | null | undefined): ComplaintStatusCn {
  const s = (raw || '').trim()
  return LEGACY_TO_CN[s] ?? '待处理'
}

export function isPendingStatus(raw: string | null | undefined): boolean {
  const n = normalizeComplaintStatus(raw)
  return n === '待处理'
}

export function isProcessingStatus(raw: string | null | undefined): boolean {
  return normalizeComplaintStatus(raw) === '处理中'
}

export function isCompletedStatus(raw: string | null | undefined): boolean {
  return normalizeComplaintStatus(raw) === '已处理'
}
