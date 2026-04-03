/** 与员工「管理业务类型」、通知投递标签对齐（勿与 EmployeeForm 选项脱节） */
export const STAFF_NOTIFICATION_BUSINESS_TAGS = {
  workOrderTenant: '报修',
  complaintSanitation: '保洁',
  inspectionDefault: '巡检',
  inspectionDevice: '设备',
  inspectionSecurity: '安保',
} as const

/** 租客报事/报修工单：统一投递「报修」类负责人 */
export function businessTagForTenantWorkOrder(_type: string): string {
  return STAFF_NOTIFICATION_BUSINESS_TAGS.workOrderTenant
}

/** 卫生吐槽 */
export function businessTagForComplaint(): string {
  return STAFF_NOTIFICATION_BUSINESS_TAGS.complaintSanitation
}

/** 巡检任务：与后台巡检类型（工程/安保/设备/绿化）及员工「管理业务类型」对齐 */
export function businessTagForInspectionType(inspectionType: string): string {
  const t = (inspectionType || '').trim()
  if (t.includes('设备')) return STAFF_NOTIFICATION_BUSINESS_TAGS.inspectionDevice
  if (t.includes('安保')) return STAFF_NOTIFICATION_BUSINESS_TAGS.inspectionSecurity
  if (t.includes('工程')) return '工程'
  if (t.includes('绿化')) return '绿化'
  return STAFF_NOTIFICATION_BUSINESS_TAGS.inspectionDefault
}

export type StaffNotificationCategory = 'work_order' | 'inspection_task' | 'complaint'
