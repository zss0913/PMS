/**
 * 后端地址：默认 localhost 仅适合本机 H5。
 * 微信小程序请在本目录配置 .env.development 设置 VITE_API_BASE_URL 为电脑的局域网 IP（如 http://192.168.0.3:5000），并重新编译。
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
        const isMp = String(import.meta.env.UNI_PLATFORM || '').startsWith('mp-')
        const localHint =
          isLocalBase(BASE_URL) && isMp
            ? ' 请在 pms-tenant 目录添加 .env.development，设置 VITE_API_BASE_URL=http://你的电脑局域网IP:5000 后重新编译，并保证 PC 上 Next 已启动且防火墙放行 5000 端口。'
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
