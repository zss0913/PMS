import { getApiBaseUrl } from '../config/api.js'

const TOKEN_KEY = 'pms_token'
const REQUEST_TIMEOUT_MS = 25000

function buildRequestUrl(optionsUrl, base) {
  if (optionsUrl.startsWith('http')) return optionsUrl
  const p = optionsUrl.startsWith('/') ? optionsUrl : `/${optionsUrl}`
  const b = base.replace(/\/$/, '')
  return b ? `${b}${p}` : p
}

function networkFailHint(base, raw) {
  if (base) {
    return `${raw}（当前 API：${base}）`
  }
  return raw
}

function appendMpLoopbackHint(base, message) {
  // #ifdef MP-WEIXIN
  if (/127\.0\.0\.1|localhost/i.test(base)) {
    return `${message}；真机请把 API 改为电脑的局域网 IP（config/api.js 或 Storage pms_api_base）。`
  }
  // #endif
  return message
}

function shouldRedirectOnUnauthorized(optionsUrl) {
  return !optionsUrl.startsWith('/api/mp/login')
}

function redirectToLogin() {
  try {
    const pages = getCurrentPages()
    const current = pages && pages.length ? pages[pages.length - 1] : null
    if (current && current.route === 'pages/login/login') return
  } catch (_) {}
  uni.reLaunch({ url: '/pages/login/login' })
}

export function resolveMediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base = getApiBaseUrl().replace(/\/$/, '')
  const rel = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${rel}` : rel
}

export function request(options) {
  const base = getApiBaseUrl()
  const url = buildRequestUrl(options.url, base)
  const token = uni.getStorageSync(TOKEN_KEY) || ''

  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      timeout: options.timeout ?? REQUEST_TIMEOUT_MS,
      url,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header,
      },
      success: (res) => {
        const data = res.data || {}
        if (res.statusCode === 401) {
          uni.removeStorageSync(TOKEN_KEY)
          if (shouldRedirectOnUnauthorized(options.url)) {
            redirectToLogin()
          }
          reject(new Error(data.message || '未登录'))
          return
        }
        if (res.statusCode === 502 || res.statusCode === 503 || res.statusCode === 504) {
          reject(new Error(`网关错误（${res.statusCode}）：请确认 pms-web 已启动并可访问。`))
          return
        }
        resolve(data)
      },
      fail: (err) => {
        const raw = err.errMsg || '网络请求失败'
        reject(new Error(appendMpLoopbackHint(base, networkFailHint(base, raw))))
      },
    })
  })
}

export function get(url, params) {
  const query = params
    ? '?' +
      Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''
  return request({ url: url + query, method: 'GET' })
}

export function post(url, data) {
  return request({ url, method: 'POST', data })
}

export function put(url, data) {
  return request({ url, method: 'PUT', data })
}

export function del(url) {
  return request({ url, method: 'DELETE' })
}
