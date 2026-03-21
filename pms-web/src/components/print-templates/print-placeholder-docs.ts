/** 催缴单 Word 模板占位符（与 docx-templates / dunning-export 一致） */
export const DUNNING_PLACEHOLDERS: { key: string; desc: string }[] = [
  { key: '{{tenantName}}', desc: '租客名称' },
  { key: '{{buildingName}}', desc: '所属楼宇（多楼宇用顿号连接）' },
  { key: '{{leaseArea}}', desc: '租赁面积（㎡）' },
  { key: '{{roomNumber}}', desc: '房号（多房源用顿号连接）' },
  {
    key: '{{billList}}',
    desc:
      '需缴纳账单表格（Word 表格）。模板中写 {{billList}}，导出前自动转为 OOXML 表格。列：账单编号、费用类型、账期、应收、已缴、待缴、应收日期；底部合计行；突出待缴',
  },
  {
    key: '{{billTableXml}}',
    desc: '与 {{billList}} 同源表格内容，可二选一使用（一般与 billList 填其一即可）',
  },
  { key: '{{totalAmount}}', desc: '需缴纳合计（与待缴逻辑一致）' },
  { key: '{{bankName}}', desc: '收款账户开户行' },
  { key: '{{accountNumber}}', desc: '收款账户银行账号' },
  { key: '{{accountHolder}}', desc: '收款账户开户名称' },
  { key: '{{propertyName}}', desc: '物业公司名称' },
  { key: '{{notifyTime}}', desc: '通知/生成时间' },
]

/** 收据 Word 模板占位符（与 receipt-export、buildReceiptBillTableXml 一致） */
export const RECEIPT_PLACEHOLDERS: { key: string; desc: string }[] = [
  { key: '{{tenantName}}', desc: '租客名称' },
  { key: '{{buildingName}}', desc: '所属楼宇（多楼宇用顿号连接）' },
  { key: '{{leaseArea}}', desc: '租赁面积（㎡），为租客下全部租赁面积合计' },
  { key: '{{roomNumber}}', desc: '房号（多房源用顿号连接）' },
  {
    key: '{{billList}}',
    desc:
      '本次开具账单表格（Word 表格）。模板中写 {{billList}}，导出前自动转为 OOXML 表格。列：账单编号、费用类型、账期、应收金额、已缴金额、本次收据（元）、应收日期；底部合计行含应收/已缴/本次收据合计',
  },
  {
    key: '{{billTableXml}}',
    desc: '与 {{billList}} 同源表格内容，可二选一使用',
  },
  { key: '{{totalAmount}}', desc: '本次收据金额合计（与表格合计一致）' },
  { key: '{{bankName}}', desc: '账单关联收款账户开户行' },
  { key: '{{accountNumber}}', desc: '收款账户银行账号' },
  { key: '{{accountHolder}}', desc: '收款账户开户名称' },
  { key: '{{propertyName}}', desc: '物业公司名称' },
  { key: '{{notifyTime}}', desc: '生成时间' },
]
