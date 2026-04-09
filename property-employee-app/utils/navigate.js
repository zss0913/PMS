/**
 * 统一封装页面跳转，失败时提示原因（便于排查「点了没反应」）。
 * @param {string} url 以 / 开头的页面路径，可带 query
 * @param {'navigateTo'|'redirectTo'|'reLaunch'|'switchTab'} [method=navigateTo]
 */
export function openPage(url, method = 'navigateTo') {
  const opts = {
    url,
    fail(err) {
      const msg = err?.errMsg || err?.message || '无法打开页面'
      console.error('[openPage]', method, url, err)
      uni.showToast({ title: msg, icon: 'none', duration: 3500 })
    },
  }
  if (method === 'navigateTo') uni.navigateTo(opts)
  else if (method === 'redirectTo') uni.redirectTo(opts)
  else if (method === 'reLaunch') uni.reLaunch(opts)
  else if (method === 'switchTab') uni.switchTab(opts)
}
