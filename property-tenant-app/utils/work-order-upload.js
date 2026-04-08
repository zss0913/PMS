import { getApiBaseUrl } from '../config/api.js'

function uploadAbsoluteUrl() {
  const base = getApiBaseUrl().replace(/\/$/, '')
  const p = '/api/work-orders/upload-image'
  return base ? `${base}${p}` : p
}

/** 展示用：相对路径 /uploads/... 转为可访问绝对地址 */
export function resolveMediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base = getApiBaseUrl().replace(/\/$/, '')
  const rel = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${rel}` : rel
}

function parseUploadResult(statusCode, raw) {
  try {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
    const data = JSON.parse(text)
    if (statusCode === 401) {
      return { error: data.message || '未登录', unauthorized: true }
    }
    if (data.success && data.data && data.data.url) {
      return { url: data.data.url }
    }
    return { error: data.message || '上传失败' }
  } catch {
    return { error: '上传响应无效' }
  }
}

function uploadWithFetch(filePath, url, token) {
  if (typeof fetch !== 'function') {
    return Promise.reject(new Error('上传失败，请重试'))
  }
  return fetch(filePath)
    .then((blobRes) => {
      if (!blobRes.ok) throw new Error('无法读取所选图片')
      return blobRes.blob()
    })
    .then((blob) => {
      if (!blob.size) throw new Error('图片为空')
      const mime = (blob.type || '').toLowerCase()
      const ext =
        mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'jpg'
      const fd = new FormData()
      fd.append('file', blob, `photo.${ext}`)
      return fetch(url, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
    })
    .then(async (res) => {
      const text = await res.text()
      const parsed = parseUploadResult(res.status, text)
      if (parsed.url) return parsed.url
      if (parsed.unauthorized) {
        uni.removeStorageSync('pms_token')
        uni.navigateTo({ url: '/pages/login/login' })
      }
      throw new Error(parsed.error || '上传失败')
    })
}

export function uploadWorkOrderImage(filePath) {
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
        if (parsed.url) {
          resolve(parsed.url)
          return
        }
        if (parsed.unauthorized) {
          uni.removeStorageSync('pms_token')
          uni.navigateTo({ url: '/pages/login/login' })
          reject(new Error(parsed.error))
          return
        }
        uploadWithFetch(filePath, url, token).then(resolve).catch(reject)
      },
      fail: () => {
        uploadWithFetch(filePath, url, token).then(resolve).catch(reject)
      },
    })
  })
}
