/**
 * 后端地址：默认 localhost 仅适合本机 H5。
 * H5 真机访问本机后端时，请配置 .env.development 中 VITE_API_BASE_URL=http://电脑局域网IP:5000 并重新编译。
 */
function resolveApiBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL
  if (env != null && String(env).trim() !== '') {
    return String(env).trim().replace(/\/$/, '')
  }

  if (import.meta.env.UNI_PLATFORM === 'h5' && import.meta.env.DEV) {
    return ''
  }

  if (import.meta.env.UNI_PLATFORM === 'h5' && typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:5000`
    }
  }

  return 'http://localhost:5000'
}

const BASE_URL = resolveApiBase()

/** 与 uni.request 同源，供 uploadFile / 图片上传等拼接后端地址 */
export function getApiBaseUrl(): string {
  return BASE_URL
}

/** 工单图片等为相对路径 /uploads/... 时，H5 需拼成完整 URL 才能显示与 previewImage */
export function resolveMediaUrl(path: string): string {
  const p = String(path || '').trim()
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p)
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        const base = BASE_URL.replace(/\/$/, '')
        if (base) return `${base}${u.pathname}${u.search}`
      }
    } catch {
      /* ignore */
    }
    return p
  }
  const pathPart = p.startsWith('/') ? p : `/${p}`
  const base = BASE_URL.replace(/\/$/, '')
  if (!base) return pathPart
  return `${base}${pathPart}`
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
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      url: options.url.startsWith('http') ? options.url : `${BASE_URL}${options.url}`,
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
        const localHint =
          isLocalBase(BASE_URL) && isH5
            ? ' 请在 pms-staff/.env.development 设置 VITE_API_BASE_URL=http://电脑局域网IP:5000 后重新编译，并确保 pms-web 已启动。'
            : ''
        reject(new Error(localHint ? `${raw}${localHint}` : raw))
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
