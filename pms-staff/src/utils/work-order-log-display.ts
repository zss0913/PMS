/** 与 pms-web `work-order-log-display.ts` 一致：解析操作日志里图片附件 from/to */

export function parseUrlArrayFromWorkOrderLogValue(s: string): string[] | null {
  const t = s.trim()
  if (t === '（空）' || t === '') return []
  try {
    const j = JSON.parse(t) as unknown
    if (!Array.isArray(j)) return null
    const urls = j.filter((x): x is string => typeof x === 'string')
    if (urls.length !== j.length) return null
    return urls
  } catch {
    return null
  }
}

export function fileNameFromAttachmentUrl(url: string): string {
  const u = url.trim()
  if (!u) return '—'
  try {
    const pathOnly =
      u.startsWith('http://') || u.startsWith('https://')
        ? new URL(u).pathname
        : (u.split('?')[0] ?? u)
    const seg = pathOnly.split('/').filter(Boolean).pop() ?? u
    return decodeURIComponent(seg) || u
  } catch {
    const seg = u.split('/').pop()?.split('?')[0] ?? u
    try {
      return decodeURIComponent(seg)
    } catch {
      return seg
    }
  }
}

export function isLikelyImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(url)
}
