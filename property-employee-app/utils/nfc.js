import { getSystemInfoCompat } from './system-info.js'

/**
 * 跨端 NFC 读标签 UID（与后台 checkItems.tagId 对齐，一般为十六进制大写无分隔符）。
 * - 微信小程序安卓：wx.getNFCAdapter，使用 res.id（ArrayBuffer）转十六进制。
 * - 微信小程序 iOS：官方不支持 getNFCAdapter，需手输。
 * - App Android：NfcAdapter.enableReaderMode + Tag.getId()。
 * - App iOS：系统需 Core NFC，JS 层无内置 API，需原生插件；此处返回明确错误并建议手输。
 */

/** @param {ArrayBuffer | undefined | null} buf */
export function arrayBufferToHex(buf) {
  if (!buf || !(buf instanceof ArrayBuffer) || buf.byteLength === 0) return ''
  const u8 = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u8.length; i++) {
    s += u8[i].toString(16).padStart(2, '0')
  }
  return s.toUpperCase()
}

/** 与巡检提交、比对逻辑一致 */
export function normTag(s) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '')
}

/** @param {any} javaByteArray plus.android 拿到的 byte[] */
function javaByteArrayToHex(javaByteArray) {
  if (!javaByteArray) return ''
  try {
    const len = javaByteArray.length
    let s = ''
    for (let i = 0; i < len; i++) {
      const b = javaByteArray[i] & 0xff
      s += b.toString(16).padStart(2, '0')
    }
    return s.toUpperCase()
  } catch (_) {
    return ''
  }
}

/**
 * 微信小程序 onDiscovered 回调结果 → 标签 ID 字符串
 * @param { { id?: ArrayBuffer; messages?: Array<{ payload?: ArrayBuffer }> } } res
 */
export function parseWeixinNfcDiscovered(res) {
  if (!res) return ''
  const fromId = arrayBufferToHex(res.id)
  if (fromId) return fromId
  // 部分标签 uid 为空，尝试 NDEF 文本 payload（若后台存的是写入的文本）
  const msgs = res.messages
  if (Array.isArray(msgs) && msgs.length) {
    const pl = msgs[0]?.payload
    if (pl instanceof ArrayBuffer && pl.byteLength) {
      const u8 = new Uint8Array(pl)
      const langLen = u8[0] & 0x3f
      const textBytes = u8.slice(1 + langLen)
      try {
        const dec = new TextDecoder('utf-8').decode(textBytes)
        const t = dec.replace(/\0/g, '').trim()
        if (t) return normTag(t)
      } catch (_) {
        return arrayBufferToHex(pl)
      }
    }
  }
  return ''
}

/**
 * @param {object} opts
 * @param {number} [opts.timeoutMs=45000]
 * @returns {Promise<string>}
 */
export function readNfcTagWeixin(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 45000
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    try {
      const uniAny = uni
      if (typeof uniAny.getNFCAdapter !== 'function') {
        reject(new Error('当前环境不支持 NFC（苹果微信不支持小程序读卡，请手输标签号）'))
        return
      }
      const sys = getSystemInfoCompat()
      if (sys.platform === 'ios') {
        reject(new Error('苹果微信暂不支持小程序 NFC，请手输与后台一致的标签号'))
        return
      }
      const adapter = uniAny.getNFCAdapter()
      let finished = false
      /** @type {((res: any) => void) | null} */
      let handler = null
      const timer = setTimeout(() => {
        if (finished) return
        finished = true
        try {
          adapter.stopDiscovery({ success: () => {} })
        } catch (_) {}
        try {
          if (handler) adapter.offDiscovered(handler)
        } catch (_) {}
        reject(new Error('读卡超时，请贴近标签后重试'))
      }, timeoutMs)

      handler = (res) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        try {
          adapter.stopDiscovery({ success: () => {} })
        } catch (_) {}
        try {
          if (handler) adapter.offDiscovered(handler)
        } catch (_) {}
        const tagId = parseWeixinNfcDiscovered(res)
        if (!tagId) {
          reject(new Error('未解析到标签编号，请重试或手输'))
          return
        }
        resolve(tagId)
      }

      adapter.onDiscovered(handler)
      adapter.startDiscovery({
        success: () => {
          uni.showToast({ title: '请将标签靠近手机背面', icon: 'none' })
        },
        fail: (e) => {
          if (finished) return
          finished = true
          clearTimeout(timer)
          try {
            adapter.offDiscovered(handler)
          } catch (_) {}
          const msg = e?.errMsg || '无法启动 NFC'
          reject(new Error(msg.indexOf('not support') >= 0 ? '设备不支持或未开启 NFC' : msg))
        },
      })
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
    // #endif
    // #ifndef MP-WEIXIN
    reject(new Error('非微信小程序环境'))
    // #endif
  })
}

/**
 * App Android：ReaderMode 读 UID
 * @param {number} [timeoutMs=45000]
 * @returns {Promise<string>}
 */
export function readNfcTagAndroidApp(timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    try {
      if (plus.os.name !== 'Android') {
        reject(new Error('非 Android'))
        return
      }
      const main = plus.android.runtimeMainActivity()
      const NfcAdapter = plus.android.importClass('android.nfc.NfcAdapter')
      const nfcAdapter = NfcAdapter.getDefaultAdapter(main)
      if (!nfcAdapter) {
        reject(new Error('设备不支持 NFC'))
        return
      }
      if (!nfcAdapter.isEnabled()) {
        reject(new Error('请在系统设置中开启 NFC'))
        return
      }
      const flags =
        NfcAdapter.FLAG_READER_NFC_A |
        NfcAdapter.FLAG_READER_NFC_B |
        NfcAdapter.FLAG_READER_NFC_F |
        NfcAdapter.FLAG_READER_NFC_V |
        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK

      let finished = false
      const timer = setTimeout(() => {
        if (finished) return
        finished = true
        try {
          nfcAdapter.disableReaderMode(main)
        } catch (_) {}
        reject(new Error('读卡超时，请贴近标签后重试'))
      }, timeoutMs)

      const cb = plus.android.implement('android.nfc.NfcAdapter$ReaderCallback', {
        onTagDiscovered: (tag) => {
          if (finished) return
          finished = true
          clearTimeout(timer)
          try {
            nfcAdapter.disableReaderMode(main)
          } catch (_) {}
          try {
            const id = tag.getId()
            const hex = javaByteArrayToHex(id)
            if (hex) {
              resolve(hex)
            } else {
              reject(new Error('未读取到标签 UID'))
            }
          } catch (err) {
            reject(err instanceof Error ? err : new Error('读卡失败'))
          }
        },
      })
      nfcAdapter.enableReaderMode(main, cb, flags, null)
      uni.showToast({ title: '请将标签靠近手机背面', icon: 'none' })
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
    // #endif
    // #ifndef APP-PLUS
    reject(new Error('非 App 环境'))
    // #endif
  })
}

/**
 * 统一入口：尽量使用真实读卡；不支持时抛出错误供界面提示手输。
 * @param { { timeoutMs?: number } } [opts]
 * @returns {Promise<string>} 十六进制大写 UID 或与后台一致的文本
 */
export async function readNfcTagId(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 45000
  // #ifdef MP-WEIXIN
  return readNfcTagWeixin({ timeoutMs })
  // #endif
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    return readNfcTagAndroidApp(timeoutMs)
  }
  if (plus.os.name === 'iOS') {
    throw new Error(
      'iOS App 需集成原生 NFC（Core NFC）插件后读卡；当前请手输与后台一致的标签号'
    )
  }
  throw new Error('当前系统不支持读卡')
  // #endif
  // #ifdef H5
  throw new Error('当前运行环境不支持 NFC，请手输标签号')
  // #endif
}

export function nfcSupportHint() {
  // #ifdef MP-WEIXIN
  try {
    const sys = getSystemInfoCompat()
    if (sys.platform === 'ios') {
      return '苹果微信不支持小程序 NFC，请手输标签号。'
    }
    return typeof uni.getNFCAdapter === 'function'
      ? '安卓微信：点击下方按钮贴近真实 NFC 标签读卡。'
      : '当前基础库不支持 NFC，请升级微信或手输。'
  } catch (_) {
    return ''
  }
  // #endif
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') return '请将 NFC 标签贴近手机背面读卡。'
  if (plus.os.name === 'iOS') return 'iOS 需集成原生 NFC 插件；暂请手输标签号。'
  return ''
  // #endif
  return '请手输与后台一致的标签号。'
}
