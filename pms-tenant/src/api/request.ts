/**
 * 后端地址：H5 开发默认走 Vite 代理（同源 /api）；本机也可指向 http://localhost:5000。
 * 若需固定后端地址（如真机访问局域网 IP），在本目录配置 .env.development 设置 VITE_API_BASE_URL。
 */
function resolveApiBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL
  if (env != null && String(env).trim() !== '') {
    return String(env).trim().replace(/\/$/, '')
  }

  // H5 开发：与 Vite server.proxy 配合，请求同源 /api → 转发到 Next，避免 CORS
  if (import.meta.env.UNI_PLATFORM === 'h5' && import.meta.env.DEV) {
    return ''
  }

  // H5 构建预览：通过局域网 IP 打开时直连本机 5000
  if (import.meta.env.UNI_PLATFORM === 'h5' && typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:5000`
    }
  }

  return 'http://localhost:5000'
}

const BASE_URL = resolveApiBase()

/** 与 uni.request 同源，供 uploadFile 等拼接后端地址 */
export function getApiBaseUrl(): string {
  return BASE_URL
}

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
          isH5 && isLocalBase(BASE_URL)
            ? ' 请在 pms-tenant/.env.development 设置 VITE_API_BASE_URL=http://电脑局域网IP:5000 后重新编译，并确保 pms-web 已启动（建议 dev 使用 --hostname 0.0.0.0）。'
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
  return request<T>({ url, method: 'POST', data })
}

export function put<T = unknown>(url: string, data?: unknown) {
  return request<T>({ url, method: 'PUT', data })
}
