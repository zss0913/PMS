import type { BillActivityLogDTO } from '@/lib/bill-activity-log-db'

function parseMetaJson(json: string | null): Record<string, unknown> | null {
  if (!json?.trim()) return null
  try {
    const v = JSON.parse(json) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** 账单详情「操作类型」列：缴费按实际支付方式展示 */
export function billLogActionTypeLabel(
  log: Pick<BillActivityLogDTO, 'action' | 'metaJson' | 'summary'>
): string {
  if (log.action !== 'payment') {
    const base: Record<string, string> = {
      create: '创建账单',
      update: '修改账单',
      delete: '删除账单',
      refund: '退费',
      receipt_export: '生成收据',
      receipt_void: '作废收据',
      invoice_export: '生成发票（历史导出）',
      invoice_issue: '开票登记',
      invoice_void: '作废开票',
      invoice_reversal: '红冲开票',
      dunning_export: '生成催缴单',
      reminder_record: '催缴记录',
    }
    return base[log.action] ?? log.action
  }

  const meta = parseMetaJson(log.metaJson)
  const method = meta?.paymentMethod != null ? String(meta.paymentMethod).trim() : ''
  const summary = log.summary ?? ''
  return paymentMethodToBillOperationType(method, summary)
}

export function paymentMethodToBillOperationType(method: string, summary: string): string {
  const lower = method.toLowerCase()
  if (lower.includes('wechat') || method.includes('微信')) return '微信支付'
  if (lower.includes('alipay') || method.includes('支付宝')) return '支付宝支付'
  if (summary.includes('线上缴费') || summary.includes('租客端')) {
    if (method) return method.includes('微信') ? '微信支付' : method.includes('支付宝') ? '支付宝支付' : '线上缴费'
    return '线上缴费'
  }
  if (method && !/^offline$/i.test(method) && method !== '线下') return method
  return '线下缴费'
}

/** 入账说明标题（与操作类型列口径一致） */
export function billPaymentIngressHeadline(method: string, summary: string | null | undefined): string {
  const t = paymentMethodToBillOperationType(method, summary ?? '')
  if (t === '线下缴费') return '线下缴费入账'
  if (t === '线上缴费') return '线上缴费入账'
  return `${t}入账`
}
