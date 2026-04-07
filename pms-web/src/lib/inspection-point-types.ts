/** 与 NFC 标签、巡检计划中「工程/安保/设备/绿化」对应 */
export const INSPECTION_CATEGORIES = ['工程巡检', '设备巡检', '安保巡检', '绿化巡检'] as const
export type InspectionCategory = (typeof INSPECTION_CATEGORIES)[number]

/** 巡检点类型 → NFC 台账中的 inspectionType 字段 */
export const CATEGORY_TO_NFC_TYPE: Record<InspectionCategory, '工程' | '设备' | '安保' | '绿化'> = {
  工程巡检: '工程',
  设备巡检: '设备',
  安保巡检: '安保',
  绿化巡检: '绿化',
}

/** 巡检计划中的 inspectionType 与巡检点 inspectionCategory 是否匹配 */
export function planTypeMatchesCategory(
  planInspectionType: string,
  category: string
): boolean {
  const c = category as InspectionCategory
  const nfc = CATEGORY_TO_NFC_TYPE[c]
  return nfc != null && nfc === planInspectionType.trim()
}

export function isValidInspectionCategory(s: string): s is InspectionCategory {
  return (INSPECTION_CATEGORIES as readonly string[]).includes(s)
}

/** @deprecated 旧四类 NFC 行 UI，保留导出以免旧引用报错 */
export const INSPECTION_POINT_TYPE_ORDER = ['工程', '安保', '设备', '绿化'] as const
