import { createDecipheriv, createPrivateKey, createSign, createVerify, randomBytes } from 'node:crypto'

export type WechatPayConfig = {
  appId: string
  appSecret: string
  mchId: string
  mchSerialNo: string
  apiV3Key: string
  privateKeyPem: string
}

export type MiniProgramPayParams = {
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
}

type EncryptResource = {
  algorithm: string
  ciphertext: string
  associated_data?: string
  nonce: string
}

type CompanyWechatConfigInput = {
  appId: string | null
  appSecret: string | null
  wechatMchId: string | null
  wechatMchSerialNo: string | null
  wechatApiV3Key: string | null
  wechatPrivateKeyPem: string | null
}

type WechatCertificateResponse = {
  data?: Array<{
    serial_no: string
    encrypt_certificate: EncryptResource
  }>
}

function clean(v: string | null | undefined) {
  return String(v || '').trim()
}

export function getWechatPayConfig(input: CompanyWechatConfigInput): WechatPayConfig {
  const config: WechatPayConfig = {
    appId: clean(input.appId),
    appSecret: clean(input.appSecret),
    mchId: clean(input.wechatMchId),
    mchSerialNo: clean(input.wechatMchSerialNo),
    apiV3Key: clean(input.wechatApiV3Key),
    privateKeyPem: clean(input.wechatPrivateKeyPem),
  }
  if (!config.appId) throw new Error('当前公司未配置微信小程序 AppId')
  if (!config.appSecret) throw new Error('当前公司未配置微信小程序 AppSecret')
  if (!config.mchId) throw new Error('当前公司未配置微信支付商户号')
  if (!config.mchSerialNo) throw new Error('当前公司未配置微信支付商户证书序列号')
  if (!config.apiV3Key) throw new Error('当前公司未配置微信支付 APIv3 Key')
  if (config.apiV3Key.length !== 32) throw new Error('微信支付 APIv3 Key 长度必须为 32 位')
  if (!config.privateKeyPem) throw new Error('当前公司未配置微信支付商户私钥')
  return config
}

function randomNonce() {
  return randomBytes(16).toString('hex')
}

function signText(privateKeyPem: string, text: string) {
  const sign = createSign('RSA-SHA256')
  sign.update(text)
  sign.end()
  return sign.sign(createPrivateKey(privateKeyPem), 'base64')
}

function verifyText(publicKeyPem: string, text: string, signature: string) {
  const verify = createVerify('RSA-SHA256')
  verify.update(text)
  verify.end()
  return verify.verify(publicKeyPem, signature, 'base64')
}

function buildAuthorization(config: WechatPayConfig, method: string, urlPath: string, body: string) {
  const nonceStr = randomNonce()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`
  const signature = signText(config.privateKeyPem, message)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${config.mchSerialNo}",signature="${signature}"`
}

async function callWechatApi<T>(config: WechatPayConfig, method: 'GET' | 'POST', urlPath: string, bodyObj?: unknown) {
  const body = bodyObj ? JSON.stringify(bodyObj) : ''
  const res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: buildAuthorization(config, method, urlPath, body),
      'User-Agent': 'PMS-WechatPay/1.0',
    },
    body: body || undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error((data && (data.message || data.code)) || `微信支付请求失败（${res.status}）`)
  }
  return data as T
}

function decryptResource(apiV3Key: string, resource: EncryptResource) {
  if (resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('不支持的微信加密算法')
  }
  const cipherBuffer = Buffer.from(resource.ciphertext, 'base64')
  const authTag = cipherBuffer.subarray(cipherBuffer.length - 16)
  const data = cipherBuffer.subarray(0, cipherBuffer.length - 16)
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(apiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8')
  )
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'))
  }
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

async function fetchPlatformPublicKeyPem(config: WechatPayConfig, serialNo: string) {
  const resp = await callWechatApi<WechatCertificateResponse>(config, 'GET', '/v3/certificates')
  const cert = (resp.data || []).find((item) => item.serial_no === serialNo)
  if (!cert) {
    throw new Error('未找到匹配的微信支付平台证书')
  }
  return decryptResource(config.apiV3Key, cert.encrypt_certificate)
}

export async function getWechatOpenId(config: WechatPayConfig, loginCode: string) {
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', config.appId)
  url.searchParams.set('secret', config.appSecret)
  url.searchParams.set('js_code', loginCode)
  url.searchParams.set('grant_type', 'authorization_code')
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok || !data?.openid) {
    throw new Error(data?.errmsg || '获取微信 openid 失败')
  }
  return String(data.openid)
}

export async function createWechatJsapiOrder(
  config: WechatPayConfig,
  input: {
    description: string
    outTradeNo: string
    totalFen: number
    openId: string
    notifyUrl: string
  }
) {
  const payload = {
    appid: config.appId,
    mchid: config.mchId,
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: input.notifyUrl,
    amount: {
      total: input.totalFen,
      currency: 'CNY',
    },
    payer: {
      openid: input.openId,
    },
  }
  const data = await callWechatApi<{ prepay_id?: string }>(
    config,
    'POST',
    '/v3/pay/transactions/jsapi',
    payload
  )
  if (!data?.prepay_id) {
    throw new Error('微信支付下单失败，未返回 prepay_id')
  }
  return data.prepay_id
}

export function buildMiniProgramPayParams(config: WechatPayConfig, prepayId: string): MiniProgramPayParams {
  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const nonceStr = randomNonce()
  const pkg = `prepay_id=${prepayId}`
  const message = `${config.appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`
  return {
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign: signText(config.privateKeyPem, message),
  }
}

export async function parseWechatPayNotify(
  config: WechatPayConfig,
  input: {
    rawBody: string
    signature: string
    timestamp: string
    nonce: string
    serial: string
  }
) {
  const publicKeyPem = await fetchPlatformPublicKeyPem(config, input.serial)
  const signedText = `${input.timestamp}\n${input.nonce}\n${input.rawBody}\n`
  const ok = verifyText(publicKeyPem, signedText, input.signature)
  if (!ok) {
    throw new Error('微信支付回调验签失败')
  }
  const payload = JSON.parse(input.rawBody)
  const resourceText = decryptResource(config.apiV3Key, payload.resource)
  return {
    payload,
    resource: JSON.parse(resourceText) as {
      appid: string
      mchid: string
      out_trade_no: string
      transaction_id: string
      trade_state: string
      amount?: {
        total?: number
        payer_total?: number
        currency?: string
      }
    },
  }
}
