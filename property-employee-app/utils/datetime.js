function pad2(v) {
  return String(v).padStart(2, '0')
}

function parseDate(value) {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDateTime(value, fallback = '—') {
  const d = parseDate(value)
  if (!d) return fallback
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function formatDateOnly(value, fallback = '—') {
  const d = parseDate(value)
  if (!d) return fallback
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
