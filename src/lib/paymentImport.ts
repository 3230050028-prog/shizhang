import type { TransactionInput, TransactionType } from '../types'

export interface ParsedPaymentRow extends TransactionInput {
  sourceLine: number
}

export interface PaymentImportResult {
  rows: ParsedPaymentRow[]
  skipped: number
}

const normalizeHeader = (value: string) => value.replace(/[\s（）()]/g, '').toLowerCase()

const parseDelimitedRows = (text: string, delimiter: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

const cleanDate = (value: string) => {
  const match = value.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (!match) return ''
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

const cleanAmount = (value: string) => {
  const match = value.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/)
  return match ? Math.abs(Number(match[0])) : 0
}

const inferCategory = (value: string, type: TransactionType) => {
  if (type === 'income') {
    if (/工资|薪资|奖金/.test(value)) return '工资'
    if (/理财|基金|利息|收益/.test(value)) return '理财'
    return '其他收入'
  }

  if (/餐饮|美食|饭|餐厅|外卖|奶茶|咖啡|超市/.test(value)) return '餐饮'
  if (/交通|出行|打车|公交|地铁|加油|停车|车票/.test(value)) return '交通'
  if (/购物|百货|服饰|数码|淘宝|京东|拼多多/.test(value)) return '购物'
  if (/居住|住房|房租|物业|水费|电费|燃气/.test(value)) return '居住'
  if (/娱乐|游戏|电影|视频|会员|旅游/.test(value)) return '娱乐'
  if (/医疗|医院|药|健康/.test(value)) return '医疗'
  if (/教育|培训|课程|书店|学费/.test(value)) return '教育'
  return '其他'
}

const findColumn = (headers: string[], candidates: string[]) =>
  headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)))

const valueAt = (row: string[], index: number) => index >= 0 ? (row[index] ?? '').trim() : ''

export const transactionFingerprint = (row: TransactionInput) =>
  [row.occurred_on, row.type, Number(row.amount).toFixed(2), row.account.trim(), row.note.trim()].join('|')

export const parsePaymentStatement = (text: string): PaymentImportResult => {
  const sample = text.split(/\r?\n/).slice(0, 30).join('\n')
  const delimiter = (sample.match(/\t/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0) ? '\t' : ','
  const table = parseDelimitedRows(text.replace(/^\uFEFF/, ''), delimiter)
  const headerIndex = table.findIndex((row) => {
    const line = row.map(normalizeHeader).join('|')
    return line.includes('金额') && (line.includes('收/支') || line.includes('收支')) && line.includes('时间')
  })
  if (headerIndex < 0) throw new Error('没有找到“交易时间、收/支、金额”等账单列。请使用支付宝或微信导出的 CSV 文件。')

  const headers = table[headerIndex].map(normalizeHeader)
  const dateIndex = findColumn(headers, ['交易时间', '时间'])
  const directionIndex = findColumn(headers, ['收/支', '收支'])
  const amountIndex = findColumn(headers, ['金额'])
  const categoryIndex = findColumn(headers, ['交易分类', '分类'])
  const accountIndex = findColumn(headers, ['收/付款方式', '支付方式', '付款方式', '资金渠道'])
  const counterpartIndex = findColumn(headers, ['交易对方', '商户名称', '对方'])
  const productIndex = findColumn(headers, ['商品说明', '商品', '交易说明'])
  const remarkIndex = findColumn(headers, ['备注'])
  const platform = text.includes('微信') ? '微信支付' : text.includes('支付宝') ? '支付宝' : '电子支付'
  const rows: ParsedPaymentRow[] = []
  let skipped = 0

  table.slice(headerIndex + 1).forEach((row, offset) => {
    const direction = valueAt(row, directionIndex)
    const type: TransactionType | null = /收入|^收$/.test(direction)
      ? 'income'
      : /支出|^支$/.test(direction)
        ? 'expense'
        : null
    const occurred_on = cleanDate(valueAt(row, dateIndex))
    const amount = cleanAmount(valueAt(row, amountIndex))
    if (!type || !occurred_on || !amount) {
      skipped += 1
      return
    }

    const parts = [
      valueAt(row, counterpartIndex),
      valueAt(row, productIndex),
      valueAt(row, remarkIndex),
    ].filter((value, index, values) => value && value !== '/' && value !== '--' && values.indexOf(value) === index)
    const note = parts.join(' · ').slice(0, 100)
    const originalCategory = valueAt(row, categoryIndex)
    const account = (valueAt(row, accountIndex) || platform).slice(0, 30)

    rows.push({
      sourceLine: headerIndex + offset + 2,
      type,
      amount,
      category: inferCategory(`${originalCategory} ${note}`, type),
      account,
      note,
      occurred_on,
    })
  })

  return { rows, skipped }
}

export const readPaymentStatement = async (file: File) => {
  const bytes = await file.arrayBuffer()
  let text = new TextDecoder('utf-8').decode(bytes)
  const replacementCount = (text.match(/�/g) ?? []).length
  if (replacementCount > Math.max(2, text.length * 0.001)) {
    text = new TextDecoder('gb18030').decode(bytes)
  }
  return parsePaymentStatement(text)
}
