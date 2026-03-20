/**
 * 与 POST /api/bills 一致：同一租客同一楼宇多间房源合并为一条账单时，
 * roomId 仅存主房源，其它房源写在 remark 的「合并房源：」行中。
 */
export function parseMergedRoomLabels(remark: string | null): string[] | null {
  if (!remark?.trim()) return null
  for (const line of remark.split(/\r?\n/)) {
    const t = line.trim()
    const m = t.match(/^合并房源[：:]\s*(.+)$/)
    if (m) {
      const parts = m[1].split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
      return parts.length ? parts : null
    }
  }
  return null
}

/** 列表/详情「房源」列：合并账单展示多房号，英文逗号分隔；否则单房源 */
export function formatBillRoomsDisplay(
  remark: string | null,
  room: { roomNumber: string; name: string } | null | undefined
): string {
  const labels = parseMergedRoomLabels(remark)
  if (labels?.length) return labels.join(', ')
  const single = (room?.roomNumber || room?.name || '').trim()
  return single || '-'
}
