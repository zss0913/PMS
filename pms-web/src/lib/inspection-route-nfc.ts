/**
 * 判断巡检路线字段（JSON 或文本）是否引用指定 NFC 业务编号（与 NfcTag.tagId 一致）
 */
function walkJsonForNfcCode(value: unknown, nfcCode: string): boolean {
  if (value === nfcCode) return true
  if (Array.isArray(value)) {
    return value.some((item) => walkJsonForNfcCode(item, nfcCode))
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>
    for (const key of ['tagId', 'nfcId', 'nfcTagId', 'id']) {
      const v = o[key]
      if (typeof v === 'string' && v === nfcCode) return true
      if (typeof v === 'number' && String(v) === nfcCode) return true
    }
    const nested = o.points ?? o.nodes ?? o.stops ?? o.route
    if (nested !== undefined) return walkJsonForNfcCode(nested, nfcCode)
  }
  return false
}

export function routeReferencesNfcTagId(
  route: string | null | undefined,
  nfcCode: string
): boolean {
  if (!route?.trim() || !nfcCode) return false
  const raw = route.trim()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (walkJsonForNfcCode(parsed, nfcCode)) return true
  } catch {
    // 非 JSON
  }
  if (raw.includes(`"${nfcCode}"`) || raw.includes(`'${nfcCode}'`)) return true
  const escaped = nfcCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    return new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`).test(raw)
  } catch {
    return false
  }
}
