import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

// docx-merger 为 CommonJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DocxMerger = require('docx-merger') as new (
  opts: { pageBreak?: boolean },
  files: Buffer[]
) => { save: (type: 'nodebuffer', cb: (data: Buffer) => void) => void }

export const PRINT_PLACEHOLDER_KEYS = [
  'tenantName',
  'buildingName',
  'leaseArea',
  'roomNumber',
  'billList',
  'billTableXml',
  'totalAmount',
  'bankName',
  'accountNumber',
  'accountHolder',
  'propertyName',
  'notifyTime',
] as const

export type PrintPlaceholderData = Record<(typeof PRINT_PLACEHOLDER_KEYS)[number], string>

export function emptyPlaceholderData(): PrintPlaceholderData {
  const o: Record<string, string> = {}
  for (const k of PRINT_PLACEHOLDER_KEYS) o[k] = ''
  return o as PrintPlaceholderData
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tableCell(
  text: string,
  widthTwips: number,
  opts?: { gridSpan?: number }
): string {
  const t = escapeXml(text)
  const tcPr =
    opts?.gridSpan && opts.gridSpan > 1
      ? `<w:tcPr><w:tcW w:w="${widthTwips}" w:type="dxa"/><w:gridSpan w:val="${opts.gridSpan}"/></w:tcPr>`
      : `<w:tcPr><w:tcW w:w="${widthTwips}" w:type="dxa"/></w:tcPr>`
  return `<w:tc>${tcPr}<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p></w:tc>`
}

/**
 * 催缴单、收据等 Word 模板常用 `{{billList}}`，普通占位符会输出纯文本无法成表。
 * 导出前将 `{{billList}}` / `{{billTableXml}}` 改为 RawXml 形式，并把表格 OOXML 写入对应 data 字段。
 */
export function prepareDunningTemplateBillListAsRawTable(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer)
  const names = Object.keys(zip.files).filter((n) => {
    const entry = zip.files[n]
    if (!n || entry.dir) return false
    return (
      n === 'word/document.xml' ||
      /^word\/header\d+\.xml$/.test(n) ||
      /^word\/footer\d+\.xml$/.test(n)
    )
  })
  for (const f of names) {
    const file = zip.file(f)
    if (!file) continue
    let xml = file.asText()
    xml = xml.replace(/\{\{\s*billList\s*\}\}/g, '{{@billList}}')
    xml = xml.replace(/\{\{\s*billTableXml\s*\}\}/g, '{{@billTableXml}}')
    zip.file(f, xml)
  }
  return zip.generate({ type: 'nodebuffer' }) as Buffer
}

/** 催缴单「需缴纳账单列表」：7 列 + 合计行（前三列合并），经 prepareDunningTemplateBillListAsRawTable 后可用 {{billList}} */
export function buildBillTableXml(
  rows: Array<{
    code: string
    feeType: string
    period: string
    accountReceivable: number
    amountPaid: number
    amountDue: number
    dueDate: string
  }>
): string {
  const colW = [1800, 1400, 3000, 1100, 1100, 1100, 1200]
  const headers = ['账单编号', '费用类型', '账期', '应收', '已缴', '待缴', '应收日期']
  const grid = colW.map((w) => `<w:gridCol w:w="${w}"/>`).join('')
  const headerTr = `<w:tr>${headers.map((h, i) => tableCell(h, colW[i])).join('')}</w:tr>`
  const dataTrs = rows
    .map((b) => {
      const cells = [
        b.code,
        b.feeType,
        b.period,
        `¥${b.accountReceivable.toFixed(2)}`,
        `¥${b.amountPaid.toFixed(2)}`,
        `¥${b.amountDue.toFixed(2)}`,
        b.dueDate,
      ]
      return `<w:tr>${cells.map((c, i) => tableCell(c, colW[i])).join('')}</w:tr>`
    })
    .join('')

  const sumR = rows.reduce(
    (a, b) => ({
      ar: a.ar + b.accountReceivable,
      paid: a.paid + b.amountPaid,
      due: a.due + b.amountDue,
    }),
    { ar: 0, paid: 0, due: 0 }
  )
  const w123 = colW[0] + colW[1] + colW[2]
  const footerTr = `<w:tr>${tableCell('合计', w123, { gridSpan: 3 })}${tableCell(
    `¥${sumR.ar.toFixed(2)}`,
    colW[3]
  )}${tableCell(`¥${sumR.paid.toFixed(2)}`, colW[4])}${tableCell(
    `¥${sumR.due.toFixed(2)}`,
    colW[5]
  )}${tableCell('/', colW[6])}</w:tr>`

  return `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
    </w:tblBorders>
  </w:tblPr>
  <w:tblGrid>${grid}</w:tblGrid>
  ${headerTr}${dataTrs}${footerTr}
</w:tbl>`
}

/** 收据「本次开具」账单列表：7 列 + 合计行（前三列合并）；经 prepareDunningTemplateBillListAsRawTable 后可用 {{billList}} */
export function buildReceiptBillTableXml(
  rows: Array<{
    code: string
    feeType: string
    period: string
    accountReceivable: number
    amountPaid: number
    receiptLineAmount: number
    dueDate: string
  }>
): string {
  if (rows.length === 0) {
    return ''
  }
  const colW = [1800, 1400, 2600, 1500, 1500, 1700, 1500]
  const headers = [
    '账单编号',
    '费用类型',
    '账期',
    '应收金额',
    '已缴金额',
    '本次收据（元）',
    '应收日期',
  ]
  const grid = colW.map((w) => `<w:gridCol w:w="${w}"/>`).join('')
  const headerTr = `<w:tr>${headers.map((h, i) => tableCell(h, colW[i])).join('')}</w:tr>`
  const dataTrs = rows
    .map((b) => {
      const cells = [
        b.code,
        b.feeType,
        b.period,
        `¥${b.accountReceivable.toFixed(2)}`,
        `¥${b.amountPaid.toFixed(2)}`,
        `¥${b.receiptLineAmount.toFixed(2)}`,
        b.dueDate,
      ]
      return `<w:tr>${cells.map((c, i) => tableCell(c, colW[i])).join('')}</w:tr>`
    })
    .join('')

  const sumAr = rows.reduce((s, b) => s + b.accountReceivable, 0)
  const sumPaid = rows.reduce((s, b) => s + b.amountPaid, 0)
  const sumReceipt = rows.reduce((s, b) => s + b.receiptLineAmount, 0)
  const w123 = colW[0] + colW[1] + colW[2]
  const footerTr = `<w:tr>${tableCell('合计', w123, { gridSpan: 3 })}${tableCell(
    `¥${sumAr.toFixed(2)}`,
    colW[3]
  )}${tableCell(`¥${sumPaid.toFixed(2)}`, colW[4])}${tableCell(
    `¥${sumReceipt.toFixed(2)}`,
    colW[5]
  )}${tableCell('-', colW[6])}</w:tr>`

  return `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
    </w:tblBorders>
  </w:tblPr>
  <w:tblGrid>${grid}</w:tblGrid>
  ${headerTr}${dataTrs}${footerTr}
</w:tbl>`
}

export function fillDocxTemplate(buffer: Buffer, data: PrintPlaceholderData): Buffer {
  const zip = new PizZip(buffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  })
  doc.render(data)
  return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer
}

export function mergeDocxBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) throw new Error('无文档可合并')
  if (buffers.length === 1) return Promise.resolve(buffers[0])
  return new Promise((resolve, reject) => {
    try {
      const merger = new DocxMerger({ pageBreak: true }, buffers)
      merger.save('nodebuffer', (data: Buffer) => {
        resolve(data)
      })
    } catch (e) {
      reject(e)
    }
  })
}
