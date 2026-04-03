/**
 * 后端地址：本机 localhost 开发走 Vite 代理（同源 /api）；手机用局域网 IP 打开时可配 VITE_API_BASE_URL。
 * 浏览器内一律用 fetch：部分构建下 import.meta.env.UNI_PLATFORM 未注入时会误走 uni.request，出现 request:fail 且 Network 面板无记录。
 */

function trimEnvBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL
  if (env == null || String(env).trim() === '') return ''
  return String(env).trim().replace(/\/$/, '')
}

/** 运行在浏览器中（租客端 H5） */
function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function shouldUseBrowserFetch(): boolean {
  return isBrowser() && typeof fetch === 'function'
}

/**
 * 按「当前页面 hostname」解析 API 根地址；浏览器内不依赖 UNI_PLATFORM。
 */
export function getApiBaseUrl(): string {
  const envBase = trimEnvBase()

  if (isBrowser()) {
    const { protocol, hostname } = window.location
    const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1'

    if (import.meta.env.DEV && isLoopback) {
      return ''
    }

    if (import.meta.env.DEV && hostname && !isLoopback) {
      if (envBase) return envBase
      return `${protocol}//${hostname}:5000`
    }

    if (!import.meta.env.DEV && hostname && !isLoopback) {
      if (envBase) return envBase
      return `${protocol}//${hostname}:5000`
    }

    if (envBase) return envBase
    return 'http://localhost:5000'
  }

  if (envBase) return envBase
  return 'http://localhost:5000'
}

function buildRequestUrl(optionsUrl: string, base: string): string {
  if (optionsUrl.startsWith('http')) return optionsUrl
  const p = optionsUrl.startsWith('/') ? optionsUrl : `/${optionsUrl}`
  const b = base.replace(/\/$/, '')
  if (b) return `${b}${p}`
  if (isBrowser()) {
    return `${window.location.origin}${p}`
  }
  return p
}

/** 避免后端不可达或代理挂起时按钮永久停在「登录中…」 */
const REQUEST_TIMEOUT_MS = 25_000

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  token?: string
  user?: Record<string, unknown>
}

function isLocalBase(url: string) {
  try {
    const u = url.replace(/^http:/, 'http:').replace(/^https:/, 'https:')
    return /localhost|127\.0\.0\.1/i.test(u)
  } catch {
    return false
  }
}

function networkFailHint(base: string, raw: string): string {
  const isDev = import.meta.env.DEV
  const useViteProxy = isBrowser() && isDev && base === ''
  if (isBrowser() && isDev) {
    if (useViteProxy) {
      return `${raw} 无法连接后端：请启动 pms-web（npm run dev，端口 5000），本页 /api 由 Vite 转发。`
    }
    if (isLocalBase(base)) {
      return `${raw} 请确认 VITE_API_BASE_URL 与后端可访问；手机勿用 localhost。`
    }
    if (base) {
      return `${raw} 当前 API：${base}`
    }
  }
  return raw
}

async function requestViaFetch<T>(
  url: string,
  options: UniApp.RequestOptions & { url: string },
  base: string
): Promise<ApiResponse<T>> {
  const token = uni.getStorageSync('pms_token') || ''
  const method = (options.method || 'GET').toUpperCase()
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.header as Record<string, string>) || {}),
  }

  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD' && options.data != null) {
    body =
      typeof options.data === 'string' || options.data instanceof ArrayBuffer
        ? String(options.data)
        : JSON.stringify(options.data)
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json'
    }
  }

  const ctrl = new AbortController()
  const ms = options.timeout ?? REQUEST_TIMEOUT_MS
  const timer = setTimeout(() => ctrl.abort(), ms)

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: ctrl.signal,
      credentials: 'omit',
    })
    clearTimeout(timer)

    const text = await res.text()
    let data: ApiResponse<T>
    try {
      data = text ? (JSON.parse(text) as ApiResponse<T>) : ({} as ApiResponse<T>)
    } catch {
      throw new Error(text ? `无效响应：${text.slice(0, 80)}` : '空响应')
    }

    if (res.status === 401) {
      uni.removeStorageSync('pms_token')
      uni.navigateTo({ url: '/pages/login/login' })
      throw new Error(data.message || '未登录')
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(
        `网关错误（${res.status}）：请确认 pms-web 已在 5000 端口运行（Vite 将 /api 代理到该端口）。`
      )
    }
    return data
  } catch (e: unknown) {
    clearTimeout(timer)
    const name = e instanceof Error ? e.name : ''
    if (name === 'AbortError') {
      throw new Error(networkFailHint(base, '请求超时'))
    }
    if (e instanceof TypeError) {
      throw new Error(networkFailHint(base, '网络异常'))
    }
    throw e
  }
}

export function request<T = unknown>(
  options: UniApp.RequestOptions & { url: string }
): Promise<ApiResponse<T>> {
  const base = getApiBaseUrl()
  const url = buildRequestUrl(options.url, base)

  if (shouldUseBrowserFetch()) {
    return requestViaFetch<T>(url, options, base)
  }

  const token = uni.getStorageSync('pms_token') || ''
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      timeout: options.timeout ?? REQUEST_TIMEOUT_MS,
      url,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        ...options.header,
      },
      success: (res) => {
        const data = res.data as ApiResponse<T>
        if (res.statusCode === 401) {
          uni.removeStorageSync('pms_token')
          uni.navigateTo({ url: '/pages/login/login' })
          reject(new Error(data.message || '未登录'))
          return
        }
        const sc = res.statusCode
        if (sc === 502 || sc === 503 || sc === 504) {
          reject(
            new Error(
              `网关错误（${sc}）：请确认已在 pms-web 执行 npm run dev，且监听 5000（H5 的 /api 由 Vite 代理到该端口）。`
            )
          )
          return
        }
        resolve(data)
      },
      fail: (err) => {
        const raw = err.errMsg || '网络请求失败'
        reject(new Error(networkFailHint(base, raw)))
      },
    })
  })
}

export function get<T = unknown>(url: string, params?: Record<string, string>) {
  const query = params
    ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    : ''
  return request<T>({ url: url + query, method: 'GET' })
}

export function post<T = unknown>(url: string, data?: unknown) {
  return request<T>({ url, method: 'POST', data })
}

export function put<T = unknown>(url: string, data?: unknown) {
  return request<T>({ url, method: 'PUT', data })
}
