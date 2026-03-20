/** 房号规范化：去首尾空白、全角数字转半角，用于比对与落库，避免「同一房号」因字符形态不同重复写入 */
export function normalizeRoomNumber(s: string): string {
  let r = s.trim()
  r = r.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  return r
}
