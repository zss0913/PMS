'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Download, FileSpreadsheet } from 'lucide-react'

/** 与模板表头一致；第 5 列与系统界面「租赁面积」对齐 */
export const TENANT_IMPORT_HEADERS = [
  '租客类型',
  '公司名称',
  '楼宇名称',
  '房号',
  '租赁面积',
  '入住日期',
  '租期开始',
  '租期结束',
] as const

/** 表头前的说明行数（含总说明 + 各列规范），表头在下一行 */
export const TENANT_TEMPLATE_INSTRUCTION_ROWS = 9

const TENANT_IMPORT_INTRO =
  '【填写说明】以下为各列填写规范（可保留不删）。数据请从下方「表头」行的下一行开始填写；请勿删除表头行。'

const TENANT_FIELD_RULES: readonly string[] = [
  '【租客类型】必填。仅可填「租客」或「业主」二选一，须与系统「新增租客」时下拉选项一致，勿填其它文字。',
  '【公司名称】必填。建议不超过 200 个汉字或字符；同一物业公司下名称不可与已有租客重复（系统会校验）。',
  '【楼宇名称】必填。须与当前登录物业公司下「基础信息 → 楼宇管理」中某楼宇名称完全一致（含空格、标点、括号）。',
  '【房号】必填。须为该楼宇下已录入的房源房号；多个房号用英文逗号「,」分隔，亦支持中文逗号「，」、顿号「、」或分号分隔。',
  '【租赁面积】必填。填写数字（可含小数），单位：㎡；与房号个数一致时用英文逗号分隔多个面积；若只填一个数字，表示各房使用相同租赁面积。',
  '【入住日期】必填。格式：YYYY-MM-DD，例如 2026-01-01；也可在 Excel 中设为「日期」单元格格式。',
  '【租期开始】必填。格式同上。',
  '【租期结束】必填。格式同上；须晚于或等于「租期开始」当日。',
]

export type TenantImportRowPayload = {
  type: '租客' | '业主'
  companyName: string
  buildingName: string
  roomNumbers: string
  leaseAreas: string
  moveInDate: string
  leaseStartDate: string
  leaseEndDate: string
  /** Excel 工作表中的行号（从 1 起），用于失败明细 */
  excelRow?: number
}

function formatCell(v: unknown): string {
  if (v == null || v === '') return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof v === 'number') {
    if (v > 30000 && v < 60000) {
      const epoch = new Date(Date.UTC(1899, 11, 30))
      const ms = epoch.getTime() + Math.round(v) * 86400000
      const dt = new Date(ms)
      if (!Number.isNaN(dt.getTime())) {
        const y = dt.getUTCFullYear()
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
        const d = String(dt.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    }
  }
  return String(v).trim()
}

function findHeaderRowIndex(raw: (string | number | undefined)[][]): number {
  for (let i = 0; i < Math.min(raw.length, 80); i++) {
    const row = raw[i]
    if (!row) continue
    const a = String(row[0] ?? '').trim()
    const b = String(row[1] ?? '').trim()
    if (a === '租客类型' && b === '公司名称') return i
  }
  return -1
}

function parseTenantSheet(
  raw: (string | number | undefined)[][],
  headerIdxOverride?: number
): TenantImportRowPayload[] {
  const headerIdx = headerIdxOverride ?? findHeaderRowIndex(raw)
  if (headerIdx < 0) return []
  const out: TenantImportRowPayload[] = []
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue
    const excelRow = i + 1
    const c = (j: number) => formatCell(r[j])
    const typeRaw = c(0)
    const companyName = c(1)
    const buildingName = c(2)
    const roomNumbers = c(3)
    const leaseAreas = c(4)
    const moveInDate = c(5)
    const leaseStartDate = c(6)
    const leaseEndDate = c(7)
    if (!companyName && !buildingName && !roomNumbers) continue
    const type: '租客' | '业主' = typeRaw === '业主' ? '业主' : '租客'
    out.push({
      type,
      companyName,
      buildingName,
      roomNumbers,
      leaseAreas,
      moveInDate,
      leaseStartDate,
      leaseEndDate,
      excelRow,
    })
  }
  return out
}

type FailureRow = TenantImportRowPayload & { rowIndex: number; reason: string }

type Props = {
  onClose: () => void
  onSuccess: () => void
}

function buildInstructionSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = []
  rows.push([TENANT_IMPORT_INTRO, '', '', '', '', '', '', ''])
  for (const rule of TENANT_FIELD_RULES) {
    rows.push([rule, '', '', '', '', '', '', ''])
  }
  rows.push([...TENANT_IMPORT_HEADERS])
  rows.push([
    '租客',
    '示例科技有限公司',
    '示例楼宇名',
    '101',
    '80',
    '2026-01-01',
    '2026-01-01',
    '2026-12-31',
  ])
  rows.push(['业主', '示例公司二', '示例楼宇名', '102,103', '50,60', '2026-01-01', '2026-01-01', '2026-12-31'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
  for (let r = 0; r < TENANT_TEMPLATE_INSTRUCTION_ROWS; r++) {
    merges.push({ s: { r, c: 0 }, e: { r, c: 7 } })
  }
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
  return ws
}

export function TenantBatchImportModal({ onClose, onSuccess }: Props) {
  const [rows, setRows] = useState<TenantImportRowPayload[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [resultText, setResultText] = useState<string | null>(null)
  const [lastFailures, setLastFailures] = useState<FailureRow[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    const ws = buildInstructionSheet()
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '租客导入')
    XLSX.writeFile(wb, '租客批量导入模板.xlsx')
  }

  const handleDownloadFailures = (failures: FailureRow[]) => {
    const header = [...TENANT_IMPORT_HEADERS, '行号', '失败原因']
    const data = failures.map((f) => [
      f.type,
      f.companyName,
      f.buildingName,
      f.roomNumbers,
      f.leaseAreas,
      f.moveInDate,
      f.leaseStartDate,
      f.leaseEndDate,
      f.rowIndex,
      f.reason,
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '导入失败')
    XLSX.writeFile(wb, `租客导入失败_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setResultText(null)
    setLastFailures(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        if (!data) return
        const wb = XLSX.read(data, { type: 'binary', cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
          header: 1,
          defval: '',
        }) as (string | number | undefined)[][]
        const h = findHeaderRowIndex(raw)
        if (h < 0) {
          setRows([])
          setResultText(
            '未找到表头行（第一列须为「租客类型」、第二列为「公司名称」）。请使用下载的模板。'
          )
          return
        }
        const list = parseTenantSheet(raw, h)
        setRows(list)
        setResultText(
          list.length
            ? `已解析 ${list.length} 行数据，请点击确认导入`
            : '未解析到有效数据（表头下一行起须填写内容）'
        )
      } catch {
        setResultText('文件解析失败，请使用下载的模板格式')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (rows.length === 0) {
      setResultText('请先选择 Excel 文件')
      return
    }
    setSubmitting(true)
    setResultText(null)
    setLastFailures(null)
    try {
      const res = await fetch('/api/tenants/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        const { successCount, failCount, failures } = json.data as {
          successCount: number
          failCount: number
          failures: FailureRow[]
        }
        let msg = `成功 ${successCount} 条，失败 ${failCount} 条`
        if (failures?.length) {
          setLastFailures(failures)
          msg += '。可下载失败明细表格，修改后重新上传。'
        }
        setResultText(msg)
        if (successCount > 0) onSuccess()
      } else {
        setResultText(json.message || '导入失败')
      }
    } catch {
      setResultText('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold">批量导入租客</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            模板前几行为<strong>填写规范</strong>（已合并单元格），请从<strong>表头行下一行</strong>开始填数据。表头列为：租客类型、公司名称、楼宇名称、房号、租赁面积、入住日期、租期开始、租期结束。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Download className="w-4 h-4" />
              下载模板
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-200 dark:bg-slate-600 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500"
            >
              <Upload className="w-4 h-4" />
              选择文件
            </button>
            {lastFailures && lastFailures.length > 0 && (
              <button
                type="button"
                onClick={() => handleDownloadFailures(lastFailures)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                下载失败明细
              </button>
            )}
          </div>
          {rows.length > 0 && (
            <p className="text-sm text-slate-700 dark:text-slate-300">待导入：{rows.length} 行</p>
          )}
          {resultText && (
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm whitespace-pre-wrap">
              {resultText}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || rows.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
