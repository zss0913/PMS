import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('zh-CN')
}

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString('zh-CN')
}

/** 拨号 / tel: 链接：去掉空白与常见括号、横线，保留数字与开头的 + */
export function normalizeTelForDial(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null
  const t = phone.trim().replace(/[\s\u00A0\-–—()（）]/g, '')
  return t || null
}
