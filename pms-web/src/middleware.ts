import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 租客端/员工端 uni-app **H5** 运行在另一端口（如 5173），请求本机 5000 端口 API 为跨域，需 CORS。
 * 微信小程序不走浏览器 CORS，不受影响。
 */
function isAllowedOrigin(origin: string | null): string | null {
  if (!origin || origin === 'null') return null
  try {
    const u = new URL(origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

    if (process.env.NODE_ENV === 'development') {
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return origin
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) return origin
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) return origin
      const m = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(u.hostname)
      if (m) {
        const second = parseInt(m[1], 10)
        if (second >= 16 && second <= 31) return origin
      }
      return null
    }

    const list = (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.includes(origin)) return origin
    return null
  } catch {
    return null
  }
}

function applyCors(res: NextResponse, origin: string | null) {
  const allow = isAllowedOrigin(origin)
  if (!allow) return res
  res.headers.set('Access-Control-Allow-Origin', allow)
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  )
  res.headers.set('Access-Control-Max-Age', '86400')
  return res
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')

  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 })
    return applyCors(res, origin)
  }

  const res = NextResponse.next()
  return applyCors(res, origin)
}

export const config = {
  matcher: ['/api/mp/:path*'],
}
