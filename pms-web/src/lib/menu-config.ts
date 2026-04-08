/** 物业公司内置「系统管理员」角色编码：拥有全部菜单与按钮权限，不可在界面上逐项配置 */
export const COMPANY_ADMIN_ROLE_CODE = 'admin'

/** 菜单权限配置，用于角色菜单权限选择 */
export const MENU_OPTIONS = [
  { id: 1, label: '首页', path: '/' },
  { id: 30, label: '剖面图', path: '/sectional-view' },
  { id: 2, label: '楼宇管理', path: '/buildings' },
  { id: 3, label: '项目管理', path: '/projects' },
  { id: 4, label: '房源管理', path: '/rooms' },
  { id: 5, label: '租客管理', path: '/tenants' },
  { id: 6, label: '收款账户管理', path: '/accounts' },
  { id: 7, label: '账单规则', path: '/bill-rules' },
  { id: 8, label: '催缴打印模板管理', path: '/print-templates' },
  { id: 9, label: '自动催缴设置', path: '/auto-reminder-settings' },
  { id: 10, label: '账单管理', path: '/bills' },
  { id: 27, label: '开票记录', path: '/invoice-records' },
  { id: 11, label: '缴纳记录', path: '/payments' },
  { id: 12, label: '退费记录', path: '/refunds' },
  { id: 13, label: '催缴管理', path: '/reminders' },
  { id: 14, label: 'NFC标签', path: '/nfc-tags' },
  { id: 15, label: '设备台账', path: '/devices' },
  { id: 29, label: '巡检点', path: '/inspection-points' },
  { id: 16, label: '工单类型', path: '/work-order-types' },
  { id: 17, label: '工单管理', path: '/work-orders' },
  { id: 18, label: '巡检计划', path: '/inspection-plans' },
  { id: 19, label: '巡检任务', path: '/inspection-tasks' },
  { id: 20, label: '巡检记录', path: '/inspection-records' },
  { id: 21, label: '卫生吐槽', path: '/complaints' },
  { id: 22, label: '公告管理', path: '/announcements' },
  { id: 23, label: '物业公司', path: '/companies' },
  { id: 24, label: '部门管理', path: '/departments' },
  { id: 25, label: '角色管理', path: '/roles' },
  { id: 26, label: '员工管理', path: '/employees' },
  { id: 28, label: '租客账号', path: '/tenant-users' },
  { id: 31, label: '收据记录', path: '/receipt-records' },
  { id: 32, label: '设备维保记录', path: '/device-maintenance-records' },
  { id: 33, label: '全局小程序配置', path: '/platform/mp-settings' },
] as const

export type MenuOption = (typeof MENU_OPTIONS)[number]

/** path（含前缀） -> 菜单 id，用于侧边栏与权限校验 */
export const MENU_PATH_TO_ID: Record<string, number> = Object.fromEntries(
  MENU_OPTIONS.map((m) => [m.path, m.id])
) as Record<string, number>

export const DATA_SCOPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'project', label: '本项目' },
  { value: 'department', label: '本部门' },
  { value: 'self', label: '仅本人' },
] as const

export type MenuButtonDef = { id: string; label: string }

const B = (id: string, label: string): MenuButtonDef => ({ id, label })

const CRUD: MenuButtonDef[] = [
  B('create', '新增'),
  B('update', '编辑'),
  B('delete', '删除'),
]

/** 各菜单下可配置的按钮权限（与前端列表/详情中的操作对应） */
export const MENU_BUTTON_OPTIONS: Record<number, MenuButtonDef[]> = {
  1: [B('view', '查看')],
  30: [B('view', '查看')],
  2: [...CRUD],
  3: [...CRUD],
  4: [
    ...CRUD,
    B('import', '批量导入'),
    B('batch_update', '批量修改状态'),
    B('tenants', '查看房源租客'),
  ],
  5: [...CRUD, B('import', '批量导入'), B('view', '查看详情')],
  6: [...CRUD],
  7: [...CRUD],
  8: [...CRUD],
  9: [B('update', '保存设置')],
  10: [
    ...CRUD,
    B('generate', '生成账单'),
    B('record_payment', '登记缴费'),
    B('invoice', '开票'),
    B('receipt', '开收据'),
    B('export_dunning', '导出催缴'),
    B('void', '作废/关闭相关操作'),
  ],
  27: [B('view', '查看'), B('cancel', '撤销开票')],
  11: [B('export', '导出'), B('view', '查看详情')],
  12: [B('create', '新增退费'), B('approve', '审批处理'), B('view', '查看')],
  13: [B('export', '导出'), B('send', '发送催缴'), B('view', '查看')],
  14: [...CRUD],
  15: [...CRUD, B('import', '批量导入'), B('export', '导出台账')],
  29: [...CRUD],
  16: [...CRUD],
  17: [
    B('create', '新建工单'),
    B('view', '查看详情'),
    B('assign', '派单/改派'),
    B('batch_assign', '批量派单'),
  ],
  18: [...CRUD],
  19: [B('view', '查看'), B('execute', '执行/提交巡检')],
  20: [B('view', '查看'), B('export', '导出')],
  21: [...CRUD, B('reply', '回复处理'), B('assign', '指派')],
  22: [...CRUD, B('publish', '发布')],
  23: [...CRUD],
  24: [...CRUD],
  25: [...CRUD],
  26: [...CRUD, B('toggle_status', '启用/禁用')],
  28: [...CRUD],
  31: [B('view', '查看'), B('void', '作废收据')],
  32: [B('view', '查看'), B('create', '新增'), B('update', '编辑')],
  33: [B('update', '保存配置')],
}

export function menuButtonKey(menuId: number, action: string): string {
  return `${menuId}:${action}`
}

/** 系统内全部按钮权限键（用于全选、校验） */
export function allMenuButtonKeys(): string[] {
  const keys: string[] = []
  for (const m of MENU_OPTIONS) {
    const buttons = MENU_BUTTON_OPTIONS[m.id]
    if (!buttons) continue
    for (const b of buttons) {
      keys.push(menuButtonKey(m.id, b.id))
    }
  }
  return keys
}

/** 当前选中的菜单下，所有可配置的按钮键 */
export function eligibleButtonKeysForMenus(menuIds: number[]): string[] {
  const mids =
    menuIds.length === 0 ? MENU_OPTIONS.map((m) => m.id) : [...new Set(menuIds)]
  const keys: string[] = []
  for (const mid of mids) {
    const buttons = MENU_BUTTON_OPTIONS[mid]
    if (!buttons) continue
    for (const b of buttons) {
      keys.push(menuButtonKey(mid, b.id))
    }
  }
  return keys
}

/**
 * 保存到 DB：若已勾选当前可选范围内的全部按钮则返回 null（表示全部按钮）；
 * 否则返回 JSON 数组字符串（显式允许列表，可为空数组表示无任何按钮权限）
 */
export function serializeButtonPermissionKeysForSave(
  menuIds: number[],
  checkedKeys: Set<string>
): string | null {
  const eligible = new Set(eligibleButtonKeysForMenus(menuIds))
  let all = true
  for (const k of eligible) {
    if (!checkedKeys.has(k)) {
      all = false
      break
    }
  }
  if (all) return null
  return JSON.stringify([...eligible].filter((k) => checkedKeys.has(k)))
}

export const MENU_ID = {
  HOME: 1,
  SECTIONAL: 30,
  BUILDINGS: 2,
  PROJECTS: 3,
  ROOMS: 4,
  TENANTS: 5,
  ACCOUNTS: 6,
  BILL_RULES: 7,
  PRINT_TEMPLATES: 8,
  AUTO_REMINDER: 9,
  BILLS: 10,
  INVOICE_RECORDS: 27,
  PAYMENTS: 11,
  REFUNDS: 12,
  REMINDERS: 13,
  NFC_TAGS: 14,
  DEVICES: 15,
  INSPECTION_POINTS: 29,
  WORK_ORDER_TYPES: 16,
  WORK_ORDERS: 17,
  INSPECTION_PLANS: 18,
  INSPECTION_TASKS: 19,
  INSPECTION_RECORDS: 20,
  COMPLAINTS: 21,
  ANNOUNCEMENTS: 22,
  COMPANIES: 23,
  DEPARTMENTS: 24,
  ROLES: 25,
  EMPLOYEES: 26,
  TENANT_USERS: 28,
  RECEIPT_RECORDS: 31,
  DEVICE_MAINTENANCE_RECORDS: 32,
  PLATFORM_MP_SETTINGS: 33,
} as const
