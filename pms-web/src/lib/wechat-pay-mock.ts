import type { CompanyWechatMerchantInput } from '@/lib/wechat-pay'

function clean(v: string | null | undefined) {
  return String(v ?? '').trim()
}

function normalizePem(v: string | null | undefined) {
  return String(v ?? '')
    .trim()
    .replace(/\r\n/g, '\n')
}

/**
 * 联调专用：在公司资料里填写下面四件套且与常量完全一致时，
 * 工单费用「微信支付」将不调微信网关，直接生成缴费单并记为支付成功（与正式商户互斥）。
 *
 * 上线前请改为真实商户号/证书/Key/私钥，并删除或勿填本组测试值。
 */
export const PMS_WECHAT_PAY_MOCK_CREDENTIALS = {
  /** 微信商户号 */
  wechatMchId: 'PMS_MOCK_WECHAT_PAY',
  /** 商户证书序列号 */
  wechatMchSerialNo: 'MOCK_PMS_CERT_SERIAL_2026_00000000000000000001',
  /** APIv3 Key（须 32 位，与真实规则一致便于表单校验） */
  wechatApiV3Key: '12345678901234567890123456789012',
  /**
   * 商户私钥 PEM（占位文本，非有效 RSA；仅用于与上面三项一起命中「模拟支付」判断）
   */
  wechatPrivateKeyPem: `-----BEGIN PMS MOCK PRIVATE KEY-----
调试专用占位，非微信真实密钥。四字段须与系统内置测试值完全一致才会走模拟支付。
-----END PMS MOCK PRIVATE KEY-----`,
} as const

/** 是否与内置测试四件套完全一致（区分大小写、换行已规范化） */
export function matchesPmsWechatPayMockConfig(c: CompanyWechatMerchantInput): boolean {
  const pemOk =
    normalizePem(c.wechatPrivateKeyPem) ===
    normalizePem(PMS_WECHAT_PAY_MOCK_CREDENTIALS.wechatPrivateKeyPem)
  return (
    clean(c.wechatMchId) === PMS_WECHAT_PAY_MOCK_CREDENTIALS.wechatMchId &&
    clean(c.wechatMchSerialNo) === PMS_WECHAT_PAY_MOCK_CREDENTIALS.wechatMchSerialNo &&
    clean(c.wechatApiV3Key) === PMS_WECHAT_PAY_MOCK_CREDENTIALS.wechatApiV3Key &&
    pemOk
  )
}
