'use client'

import { useState, useRef } from 'react'
import { X, Upload, Download, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

type Building = { id: number; name: string }

type FailedRow = {
  name: string
  roomNumber: string
  area: number
  floorName: string
  type: string
  status: string
  leasingStatus: string
  reason: string
}

const COLUMNS = ['房源名称', '房号', '管理面积', '楼层名称', '房源类型', '房源状态', '招商状态']

type PreviewRow = { name: string; roomNumber: string; area: number; floorName: string; type: string; status: string; leasingStatus: string }

function parseExcelFile(file: File): Promise<PreviewRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          resolve([])
          return
        }
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as (string | number)[][]
        const result: PreviewRow[] = []
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length < 7) continue
          const [name, roomNumber, areaVal, floorName, type, status, leasingStatus] = row.slice(0, 7).map((c) => String(c ?? '').trim())
          if (!name || !roomNumber || !floorName) continue
          if (name === '房源名称' || name === '房号') continue
          const area = typeof areaVal === 'number' ? areaVal : parseFloat(String(areaVal))
          const areaNum = isNaN(area) || area < 0 ? 0 : area
          result.push({ name, roomNumber, area: areaNum, floorName, type, status, leasingStatus })
        }
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsBinaryString(file)
  })
}

function downloadFailedExcel(failedRows: FailedRow[]) {
  const header = [...COLUMNS, '失败原因']
  const rows = failedRows.map((r) => [r.name, r.roomNumber, r.area, r.floorName, r.type, r.status, r.leasingStatus, r.reason])
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入失败数据')
  XLSX.writeFile(wb, '房源导入失败数据.xlsx')
}

export function RoomBatchImportModal({
  buildings,
  onClose,
  onSuccess,
}: {
  buildings: Building[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [buildingId, setBuildingId] = useState<number>(buildings[0]?.id ?? 0)
  const [fileName, setFileName] = useState('')
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    successCount: number
    failedCount: number
    failedRows: FailedRow[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    const header = COLUMNS
    const example1 = ['1001', '1001', 100, '1层', '写字楼', '空置', '可招商']
    const example2 = ['1002', '1002', 120, '1层', '写字楼', '空置', '可招商']
    const ws = XLSX.utils.aoa_to_sheet([header, example1, example2])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '房源导入模板')
    XLSX.writeFile(wb, '房源批量导入模板.xlsx')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null)
    setError('')
    setPreviewRows([])
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('请上传 Excel 文件（.xlsx 或 .xls）')
      return
    }
    setFileName(file.name)
    try {
      const rows = await parseExcelFile(file)
      setPreviewRows(rows)
      if (rows.length === 0) {
        setError('未解析到有效数据，请按模板格式填写 Excel')
      }
    } catch {
      setError('文件解析失败')
    }
  }

  const handleClearFile = () => {
    setFileName('')
    setPreviewRows([])
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!buildingId) {
      setError('请选择所属楼宇')
      return
    }
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('请选择要导入的 Excel 文件')
      return
    }
    setSubmitting(true)
    try {
      const rows = await parseExcelFile(file)
      if (rows.length === 0) {
        setError('未解析到有效数据，请按模板格式填写 Excel')
        setSubmitting(false)
        return
      }
      const res = await fetch('/api/rooms/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, rooms: rows }),
      })
      const data = await res.json()
      if (data.success) {
        setResult({
          successCount: data.successCount ?? 0,
          failedCount: data.failedCount ?? 0,
          failedRows: data.failedRows ?? [],
        })
        if (data.successCount > 0) {
          onSuccess()
        }
        if (data.failedCount === 0 && data.successCount > 0) {
          onClose()
        }
      } else {
        setError(data.message || '导入失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReImport = () => {
    setResult(null)
    handleClearFile()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            批量导入房源
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form id="batch-import-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          {result && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 space-y-2">
              <p className="text-sm font-medium">
                导入完成：成功 {result.successCount} 条
                {result.failedCount > 0 && `，失败 ${result.failedCount} 条`}
              </p>
              {result.failedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">失败数据</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => downloadFailedExcel(result.failedRows)}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500"
                      >
                        <Download className="w-4 h-4" />
                        下载失败表格
                      </button>
                      <button
                        type="button"
                        onClick={handleReImport}
                        className="text-sm text-blue-600 hover:text-blue-500"
                      >
                        重新导入
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-700/50 sticky top-0">
                        <tr>
                          {COLUMNS.map((c) => (
                            <th key={c} className="text-left p-2 font-medium">{c}</th>
                          ))}
                          <th className="text-left p-2 font-medium text-red-600">失败原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.failedRows.map((r, i) => (
                          <tr key={i} className="border-t border-slate-200 dark:border-slate-600">
                            <td className="p-2">{r.name}</td>
                            <td className="p-2">{r.roomNumber}</td>
                            <td className="p-2">{r.area}</td>
                            <td className="p-2">{r.floorName}</td>
                            <td className="p-2">{r.type}</td>
                            <td className="p-2">{r.status}</td>
                            <td className="p-2">{r.leasingStatus}</td>
                            <td className="p-2 text-red-600">{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500">
                    请下载失败表格，根据失败原因修改后重新导入
                  </p>
                </div>
              )}
            </div>
          )}
          {!result && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">所属楼宇 <span className="text-red-500">*</span></label>
                <select
                  value={buildingId}
                  onChange={(e) => setBuildingId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  required
                >
                  <option value={0}>请选择楼宇</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">导入数据</label>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500"
                  >
                    <Download className="w-4 h-4" />
                    下载导入模板
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  请上传 Excel 文件（.xlsx 或 .xls），列顺序：{COLUMNS.join('、')}
                </p>
                <input
                  ref={fileInputRef}
                  id="batch-import-file"
                  type="file"
                  accept=".xlsx,.xls"
                  multiple={false}
                  onChange={handleFileChange}
                  className="sr-only"
                />
                {!fileName ? (
                  <label
                    htmlFor="batch-import-file"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <FileSpreadsheet className="w-10 h-10 text-slate-400 mb-2" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      点击选择 Excel 文件
                    </span>
                  </label>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        已选择文件：{fileName}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="text-xs text-slate-500 hover:text-red-600"
                      >
                        清除
                      </button>
                    </div>
                    {previewRows.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                          共 {previewRows.length} 条数据，预览如下（点击「开始导入」时进行校验并导入）：
                        </p>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-700/50 sticky top-0">
                              <tr>
                                {COLUMNS.map((c) => (
                                  <th key={c} className="text-left p-2 font-medium">{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewRows.slice(0, 10).map((r, i) => (
                                <tr key={i} className="border-t border-slate-200 dark:border-slate-600">
                                  <td className="p-2">{r.name}</td>
                                  <td className="p-2">{r.roomNumber}</td>
                                  <td className="p-2">{r.area}</td>
                                  <td className="p-2">{r.floorName}</td>
                                  <td className="p-2">{r.type}</td>
                                  <td className="p-2">{r.status}</td>
                                  <td className="p-2">{r.leasingStatus}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {previewRows.length > 10 && (
                            <p className="text-xs text-slate-500 p-2 border-t border-slate-200 dark:border-slate-600">
                              ... 还有 {previewRows.length - 10} 条
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </form>
        {!result && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              type="submit"
              form="batch-import-form"
              disabled={submitting || !fileName || previewRows.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? '导入中...' : '开始导入'}
            </button>
          </div>
        )}
        {result && result.failedCount === 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              完成
            </button>
          </div>
        )}
        {result && result.failedCount > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleReImport}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
            >
              重新导入
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
