/** 仅允许站内相对路径，防止开放重定向 */
export function sanitizeDashboardReturnTo(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return null
  if (t.includes('://') || t.includes('\\')) return null
  if (t.length > 512) return null
  return t
}
