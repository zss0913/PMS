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
