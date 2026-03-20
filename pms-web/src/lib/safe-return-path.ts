/**
 * 校验站内相对路径，防止开放重定向；用于 returnTo 等查询参数。
 * 允许 path + query（如 /rooms/1?buildingId=2&returnTo=%2Fbills%2F3）
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null
  let s: string
  try {
    s = decodeURIComponent(raw.trim())
  } catch {
    return null
  }
  if (!s.startsWith('/') || s.startsWith('//')) return null
  const lower = s.toLowerCase()
  if (
    lower.includes('javascript:') ||
    lower.includes('data:') ||
    lower.includes('vbscript:')
  ) {
    return null
  }
  if (s.length > 2048) return null
  return s
}
