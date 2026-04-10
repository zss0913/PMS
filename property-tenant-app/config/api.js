/**
 * 后端 API 根地址（不含末尾斜杠），需与 pms-web 服务一致。
 * 真机 / 小程序调试请改为局域网 IP，如 http://192.168.1.10:5001 ，并在小程序后台配置合法域名。
 *
 * 可在运行时覆盖：uni.setStorageSync('pms_api_base', 'http://xxx:5001')
 */
export const API_BASE_URL = 'http://192.168.0.124:5001'

export function getApiBaseUrl() {
  try {
    const override = uni.getStorageSync('pms_api_base')
    if (override && String(override).trim()) {
      return String(override).trim().replace(/\/$/, '')
    }
  } catch (_) {}
  return String(API_BASE_URL).replace(/\/$/, '')
}
