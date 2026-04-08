import { NextResponse } from 'next/server'

/**
 * 已废弃：租客须先在线支付工单费用账单，支付成功后由 /fee-payment/complete 自动推进工单。
 * 保留路由避免旧客户端误调时得到明确提示。
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        '请使用微信支付：先调用费用账单准备接口生成账单，支付成功后将自动确认费用并继续维修。',
    },
    { status: 400 }
  )
}
