/**
 * 微信基础库弃用 uni.getSystemInfoSync，优先用 getDeviceInfo + getWindowInfo 组合，
 * 行为与旧版 systemInfo 常用字段对齐；无新 API 时回退。
 * @returns {Record<string, any>}
 */
export function getSystemInfoCompat() {
  try {
    if (typeof uni.getWindowInfo === 'function' && typeof uni.getDeviceInfo === 'function') {
      const win = uni.getWindowInfo()
      const dev = uni.getDeviceInfo()
      return {
        ...dev,
        ...win,
      }
    }
  } catch (_) {
    /* fallthrough */
  }
  return uni.getSystemInfoSync()
}
