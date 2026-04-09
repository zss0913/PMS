/** 与 pms-tenant / pms-web `/api/mp/notifications` 一致 */

export const MESSAGE_CATEGORIES = [
  { key: 'complaint', label: '卫生吐槽', desc: '吐槽处理进度', color: '#7dd3fc' },
  { key: 'work_order', label: '报事报修', desc: '工单动态', color: '#38bdf8' },
  { key: 'announcement', label: '公告', desc: '物业公告', color: '#34d399' },
  { key: 'bill', label: '账单', desc: '账单与催缴提醒', color: '#93c5fd' },
]

/** app_message（催缴）在「账单」分类下展示 */
export function notificationCategory(kind) {
  if (kind === 'app_message') return 'bill'
  return kind
}

export const KIND_LABEL = {
  announcement: '公告',
  bill: '账单',
  work_order: '报事报修',
  complaint: '卫生吐槽',
  app_message: '催缴',
}
