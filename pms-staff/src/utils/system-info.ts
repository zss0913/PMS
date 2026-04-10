/**
 * 微信基础库弃用 uni.getSystemInfoSync，优先用 getDeviceInfo + getWindowInfo。
 */
export function getSystemInfoCompat(): UniApp.GetSystemInfoResult {
  try {
    if (typeof uni.getWindowInfo === 'function' && typeof uni.getDeviceInfo === 'function') {
      const win = uni.getWindowInfo()
      const dev = uni.getDeviceInfo()
      return { ...dev, ...win } as UniApp.GetSystemInfoResult
    }
  } catch {
    /* fallthrough */
  }
  return uni.getSystemInfoSync()
}
