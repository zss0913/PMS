/**
 * 后端地址：本机 localhost 打开 H5 开发时走 Vite 代理；手机用局域网 IP 打开时可配 VITE_API_BASE_URL。
 */

function trimEnvBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL
  if (env == null || String(env).trim() === '') return ''
  return String(env).trim().replace(/\/$/, '')
}

/** 与 uni.request 同源，供 uploadFile / 图片上传等拼接后端地址 */
export function getApiBaseUrl(): string {
  const envBase = trimEnvBase()

  if (import.meta.env.UNI_PLATFORM === 'h5') {
    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location
      const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1'

      if (import.meta.env.DEV && isLoopback) {
        return ''
      }

      if (import.meta.env.DEV && hostname && !isLoopback) {
        if (envBase) return envBase
        return `${protocol}//${hostname}:5001`
      }

      if (!import.meta.env.DEV && hostname && !isLoopback) {
        if (envBase) return envBase
        return `${protocol}//${hostname}:5001`
      }
    }

    if (envBase) return envBase
    return 'http://localhost:5001'
  }

  if (envBase) return envBase
  return 'http://localhost:5001'
}

/** 工单图片等为相对路径 /uploads/... 时，H5 需拼成完整 URL 才能显示与 previewImage */
export function resolveMediaUrl(path: string): string {
  const p = String(path || '').trim()
  if (!p) return ''
  const baseRaw = getApiBaseUrl().replace(/\/$/, '')
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p)
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        if (baseRaw) return `${baseRaw}${u.pathname}${u.search}`
      }
    } catch {
      /* ignore */
    }
    return p
  }
  const pathPart = p.startsWith('/') ? p : `/${p}`
  if (!baseRaw) return pathPart
  return `${baseRaw}${pathPart}`
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  token?: string
  user?: Record<string, unknown>
}

function isLocalBase(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url)
}

export function request<T = unknown>(
  options: UniApp.RequestOptions & { url: string }
): Promise<ApiResponse<T>> {
  const token = uni.getStorageSync('pms_token') || ''
  const base = getApiBaseUrl()
  return new Promise((resolve, reject) => {
    const path = options.url.startsWith('http')
      ? options.url
      : `${base}${options.url.startsWith('/') ? options.url : `/${options.url}`}`

    uni.request({
      ...options,
      url: path,
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
        resolve(data)
      },
      fail: (err) => {
        const raw = err.errMsg || '网络请求失败'
        const isH5 = import.meta.env.UNI_PLATFORM === 'h5'
        const isDev = import.meta.env.DEV
        let hint = ''
        if (isH5 && isDev && base === '') {
          hint =
            ' 无法连接后端：请启动 pms-web（npm run dev，端口 5001）。本机 localhost 走 Vite /api 代理。'
        } else if (isH5 && isLocalBase(base)) {
          hint =
            ' 请确认 VITE_API_BASE_URL 与 pms-web 可访问；手机调试勿用 localhost。'
        } else if (isH5 && base) {
          hint = ` 当前直连 ${base}，请确认可访问。`
        }
        reject(new Error(hint ? `${raw}${hint}` : raw))
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
  const isJsonObject =
    data != null && typeof data === 'object' && !(data instanceof ArrayBuffer)
  return request<T>({
    url,
    method: 'POST',
    data: isJsonObject ? JSON.stringify(data) : data,
    header: isJsonObject ? { 'Content-Type': 'application/json' } : {},
  })
}

export function put<T = unknown>(url: string, data?: unknown) {
  const isJsonObject =
    data != null && typeof data === 'object' && !(data instanceof ArrayBuffer)
  return request<T>({
    url,
    method: 'PUT',
    data: isJsonObject ? JSON.stringify(data) : data,
    header: isJsonObject ? { 'Content-Type': 'application/json' } : {},
  })
}
