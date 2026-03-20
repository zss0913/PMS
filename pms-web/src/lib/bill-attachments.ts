import { join } from 'path'

export const MAX_ATTACHMENTS_PER_BILL = 50
export const DEFAULT_ATTACHMENT_PAGE_SIZE = 5
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB

/** 允许的 MIME（另辅以扩展名校验） */
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
])

const EXT_TO_MIME: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.bmp': ['image/bmp'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
}

function extFromName(name: string): string {
  const i = name.lastIndexOf('.')
  if (i < 0) return ''
  return name.slice(i).toLowerCase()
}

export function isAllowedBillAttachment(
  mime: string,
  originalName: string
): { ok: boolean; reason?: string } {
  const ext = extFromName(originalName)
  if (!ext || !EXT_TO_MIME[ext]) {
    return { ok: false, reason: '不支持的文件类型（支持图片、PDF、Word、Excel、CSV）' }
  }
  const m = mime.toLowerCase().trim()
  if (ALLOWED_MIMES.has(m)) return { ok: true }
  if (m === 'application/octet-stream' || !m) return { ok: true }
  return { ok: false, reason: '不支持的文件类型（支持图片、PDF、Word、Excel、CSV）' }
}

export function billAttachmentDir(companyId: number, billId: number): string {
  return join(process.cwd(), 'uploads', 'bill-attachments', String(companyId), String(billId))
}

export function previewKind(mime: string): 'image' | 'pdf' | 'office' | 'other' {
  const m = mime.toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m === 'application/pdf') return 'pdf'
  if (
    m.includes('word') ||
    m.includes('excel') ||
    m.includes('spreadsheet') ||
    m === 'text/csv' ||
    m.includes('msword')
  ) {
    return 'office'
  }
  return 'other'
}
