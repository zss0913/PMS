/**
 * 后端 API 根地址（不含末尾斜杠），需与 pms-web 服务一致。
 * 小程序真机调试请改为局域网 IP，并在小程序后台配置合法域名。
 */
export const API_BASE_URL = 'http://127.0.0.1:5001'

export function getApiBaseUrl() {
  try {
    const override = uni.getStorageSync('pms_api_base')
    if (override && String(override).trim()) {
      return String(override).trim().replace(/\/$/, '')
    }
  } catch (_) {}
  return String(API_BASE_URL).replace(/\/$/, '')
}
