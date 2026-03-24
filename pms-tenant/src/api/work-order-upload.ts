import { getApiBaseUrl } from '@/api/request'

/** 工单图片上传（与 PC 同一接口），H5 需完整 URL；开发环境走 Vite 代理时用当前 origin */
function uploadAbsoluteUrl(): string {
  const base = getApiBaseUrl().replace(/\/$/, '')
  const p = '/api/work-orders/upload-image'
  if (base) return `${base}${p}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${p}`
  }
  return p
}

/** 展示用：相对路径 /uploads/... 在 H5 开发下走同源代理 */
export function resolveMediaUrl(path: string): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base = getApiBaseUrl().replace(/\/$/, '')
  const rel = path.startsWith('/') ? path : `/${path}`
  if (base) return `${base}${rel}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${rel}`
  }
  return rel
}

function parseUploadResult(
  statusCode: number | undefined,
  raw: unknown
): { url: string } | { error: string; unauthorized?: boolean } {
  try {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
    const data = JSON.parse(text) as {
      success?: boolean
      data?: { url?: string }
      message?: string
    }
    if (statusCode === 401) {
      return { error: data.message || '未登录', unauthorized: true }
    }
    if (data.success && data.data?.url) {
      return { url: data.data.url }
    }
    return { error: data.message || '上传失败' }
  } catch {
    return { error: '上传响应无效' }
  }
}

/** 使用 fetch + FormData（部分环境下 blob: 临时路径可读） */
async function uploadWithFetch(filePath: string, url: string, token: string): Promise<string> {
  const blobRes = await fetch(filePath)
  if (!blobRes.ok) {
    throw new Error('无法读取所选图片，请重试')
  }
  const blob = await blobRes.blob()
  if (!blob.size) {
    throw new Error('图片为空')
  }
  const mime = (blob.type || '').toLowerCase()
  const ext =
    mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'jpg'
  const fileName = `photo.${ext}`

  const fd = new FormData()
  fd.append('file', blob, fileName)

  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
    credentials: 'include',
  })

  const text = await res.text()
  let parsed: ReturnType<typeof parseUploadResult>
  try {
    parsed = parseUploadResult(res.status, text)
  } catch {
    throw new Error('上传响应无效')
  }
  if ('url' in parsed) return parsed.url
  if (parsed.unauthorized) {
    uni.removeStorageSync('pms_token')
    uni.navigateTo({ url: '/pages/login/login' })
  }
  throw new Error(parsed.error)
}

/**
 * H5 端上传：优先 uni.uploadFile（对 uni.chooseImage 临时路径兼容性更好），失败再回退 fetch+FormData。
 * 若前端直连后端域名（VITE_API_BASE_URL），须保证 pms-web 对 /api/work-orders/upload-image 返回 CORS（见 middleware）。
 */
export function uploadWorkOrderImage(filePath: string): Promise<string> {
  const token = String(uni.getStorageSync('pms_token') || '')
  const url = uploadAbsoluteUrl()

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url,
      filePath,
      name: 'file',
      header: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      success: (res) => {
        const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
        const parsed = parseUploadResult(res.statusCode, raw)
        if ('url' in parsed) {
          resolve(parsed.url)
          return
        }
        if (parsed.unauthorized) {
          uni.removeStorageSync('pms_token')
          uni.navigateTo({ url: '/pages/login/login' })
          reject(new Error(parsed.error))
          return
        }
        void uploadWithFetch(filePath, url, token).then(resolve).catch(reject)
      },
      fail: () => {
        void uploadWithFetch(filePath, url, token).then(resolve).catch(reject)
      },
    })
  })
}
