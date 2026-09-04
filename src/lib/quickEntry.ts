import { toLocalDate } from './date'
import { inferTransactionCategory } from './paymentImport'
import type { TransactionInput, TransactionType } from '../types'

export interface QuickEntryResult {
  input: TransactionInput
  recognized: string[]
  warnings: string[]
}

const extractAmount = (text: string) => {
  const amountCharacters = '[0-9OoIl|SB,]+'
  const patterns = [
    new RegExp(`(?:付款金额|支付金额|实付金额|订单金额|交易金额|金额|消费|支出|收入|收款|到账)[：:\\s]*(?:-|−)?\\s*(?:¥|￥|关|羊|Y)?\\s*(${amountCharacters}(?:[.。]${amountCharacters})?)`, 'i'),
    new RegExp(`(?:-|−)?\\s*(?:¥|￥|关|羊|Y)\\s*(${amountCharacters}(?:[.。]${amountCharacters})?)`, 'i'),
    new RegExp(`(${amountCharacters}(?:[.。]${amountCharacters})?)\\s*元`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const normalized = match[1]
        .replace(/[Oo]/g, '0')
        .replace(/[Il|]/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/。/g, '.')
        .replace(/,/g, '')
      const amount = Number(normalized)
      if (Number.isFinite(amount)) return amount
    }
  }
  return 0
}

const normalizeDateNumber = (value: string) => Number(value
  .replace(/[Oo〇]/g, '0')
  .replace(/[Il|]/g, '1'))

const chineseDateDigits: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
  五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}

const parseDatePart = (value: string) => {
  if (!/[零〇一二两三四五六七八九十]/.test(value)) return normalizeDateNumber(value)
  if (value === '十') return 10
  const parts = value.split('十')
  if (parts.length === 2) {
    const tens = parts[0] ? chineseDateDigits[parts[0]] : 1
    const ones = parts[1] ? chineseDateDigits[parts[1]] : 0
    return tens * 10 + ones
  }
  return Number([...value].map((character) => chineseDateDigits[character]).join(''))
}

const validDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return toLocalDate(date)
}

const extractExplicitDate = (text: string, now: Date) => {
  const compactLines = text.split('\n').map((line) => line.replace(/\s+/g, ''))
  for (const line of compactLines) {
    const full = line.match(/([2Z][0Oo][0-9OoIl|]{2})[-/.年]([0-9OoIl|]{1,2})[-/.月]([0-9OoIl|]{1,2})日?/)
    if (full) {
      const parsed = validDate(
        normalizeDateNumber(full[1].replace(/^Z/, '2')),
        normalizeDateNumber(full[2]),
        normalizeDateNumber(full[3]),
      )
      if (parsed) return parsed
    }
  }

  for (const line of compactLines) {
    const monthDay = line.match(/([0-9OoIl|零〇一二两三四五六七八九十]{1,3})(?:月|H)([0-9OoIl|零〇一二两三四五六七八九十]{1,3})[日号H]?/)
      ?? line.match(/^(?:(?:日期|交易日期|交易时间|支付时间)[：:]?)?([0-9OoIl|]{1,2})[-/.]([0-9OoIl|]{1,2})(?:[日号])?(?:\d{1,2}:\d{2})?$/)
    if (!monthDay) continue
    const month = parseDatePart(monthDay[1])
    const day = parseDatePart(monthDay[2])
    const parsed = validDate(now.getFullYear(), month, day)
    if (!parsed) continue
    const candidate = new Date(now.getFullYear(), month - 1, day)
    const futureLimit = new Date(now)
    futureLimit.setDate(futureLimit.getDate() + 31)
    if (candidate > futureLimit) return validDate(now.getFullYear() - 1, month, day)
    return parsed
  }

  const relativeDate = new Date(now)
  if (text.includes('前天')) {
    relativeDate.setDate(relativeDate.getDate() - 2)
    return toLocalDate(relativeDate)
  }
  if (text.includes('昨天')) {
    relativeDate.setDate(relativeDate.getDate() - 1)
    return toLocalDate(relativeDate)
  }
  if (/(?:今天|今日|今晚|今早|今晨|今夜)/.test(text)) return toLocalDate(relativeDate)

  return null
}

const extractDate = (text: string, now: Date) => {
  const explicit = extractExplicitDate(text, now)
  if (explicit) return explicit
  const relativeDate = new Date(now)
  return toLocalDate(relativeDate)
}

const extractType = (text: string): TransactionType => {
  if (text.startsWith('支出金额')) return 'expense'
  if (text.startsWith('收入金额')) return 'income'
  return /收入|收款|到账|工资|薪资|奖金|退款|返现|红包/.test(text) ? 'income' : 'expense'
}

const extractAccount = (text: string, fallback: string) => {
  if (/零钱通/.test(text)) return '微信'
  if (/微信|零钱/.test(text)) return '微信'
  if (/支付宝|花呗/.test(text)) return '支付宝'
  if (/现金/.test(text)) return '现金'
  const card = text.match(/([\u4e00-\u9fa5]{2,8}(?:银行)?(?:信用卡|储蓄卡|银行卡))/)
  if (card) return card[1].slice(0, 30)
  if (/银行卡|信用卡|储蓄卡/.test(text)) return '银行卡'
  return fallback
}

const cleanNote = (text: string) => {
  const labeled = text.match(/(?:商户名称|商户全称|交易对方|交易对象|收款方|商品说明|商品|付款给|转账给|向)[：:\s]*([^\n，,。]+)/)
  const lineCandidates = text.split('\n')
    .map((line) => line
      .replace(/(?:付款金额|支付金额|实付金额|订单金额|交易金额|收入金额|支出金额|金额|支付时间|交易时间|创建时间|支付方式|付款方式|商户名称|商户全称|交易对方|交易对象|收款方|商品说明)[：:]?/g, ' ')
      .replace(/(?:¥|￥|关|羊|Y)\s*[0-9OoIl|SB,]+(?:[.。][0-9OoIl|SB]{1,2})?\s*元?/gi, ' ')
      .replace(/(?:^|\s)[-−]?\s*\d[\d,]*(?:[.。]\d{1,2})?\s*元?(?=\s|$)/g, ' ')
      .replace(/(?:[2Z][0-9OoIl|]{3})[-/.年][0-9OoIl|]{1,2}[-/.月][0-9OoIl|]{1,2}(?:日)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/g, ' ')
      .replace(/[0-9OoIl|零〇一二两三四五六七八九十]{1,3}\s*(?:[-/.]|月|H)\s*[0-9OoIl|零〇一二两三四五六七八九十]{1,3}\s*[日号H]?\s*\d{1,2}:\d{2}(?::\d{2})?/g, ' ')
      .replace(/[零〇一二两三四五六七八九十]{1,3}月[零〇一二两三四五六七八九十]{1,3}[日号]/g, ' ')
      .replace(/^\s*(?:(?:日期|交易日期|交易时间|支付时间)[：:]?\s*)?[0-9OoIl|]{1,2}\s*(?:[-/.]|月|H)\s*[0-9OoIl|]{1,2}\s*[日号H]?(?:\s*(?:星期|周)[一二三四五六日天])?(?:\s*\d{1,2}:\d{2})?\s*$/g, ' ')
      .replace(/(?:今天|今日|今晚|今早|今晨|今夜|昨天|前天|上午|中午|下午|晚上|凌晨)|\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
      .replace(/支付成功|交易成功|付款成功|订单详情|账单详情|微信支付|支付宝|全部账单|查找交易|收支统计|已全额退款/g, ' ')
      .replace(/[+＋：:，,。；;—|{}-]+/g, ' ')
      .replace(/\[|\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim())
    .filter((line) => /[\p{L}\u3400-\u9fff]/u.test(line) && !/^(?:微信|支付宝|零钱|花呗|银行卡|信用卡|储蓄卡)$/.test(line))
    .sort((left, right) => {
      const leftUseful = (/\p{Script=Han}/u.test(left) ? 4 : 0) + Math.min(left.length, 30) / 30
      const rightUseful = (/\p{Script=Han}/u.test(right) ? 4 : 0) + Math.min(right.length, 30) / 30
      return rightUseful - leftUseful
    })
  let note = labeled?.[1] ?? lineCandidates[0] ?? text
  note = note
    .replace(/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/g, ' ')
    .replace(/[0-9OoIl|零〇一二两三四五六七八九十]{1,3}\s*(?:[-/.]|月|H)\s*[0-9OoIl|零〇一二两三四五六七八九十]{1,3}\s*[日号H]?\s*\d{1,2}:\d{2}(?::\d{2})?/g, ' ')
    .replace(/[零〇一二两三四五六七八九十]{1,3}月[零〇一二两三四五六七八九十]{1,3}[日号]/g, ' ')
    .replace(/^\s*(?:(?:日期|交易日期|交易时间|支付时间)[：:]?\s*)?[0-9OoIl|]{1,2}\s*(?:[-/.]|月|H)\s*[0-9OoIl|]{1,2}\s*[日号H]?(?:\s*(?:星期|周)[一二三四五六日天])?(?:\s*\d{1,2}:\d{2})?\s*$/g, ' ')
    .replace(/(?:今天|今日|今晚|今早|今晨|今夜|昨天|前天|刚刚|上午|中午|下午|晚上|凌晨)/g, ' ')
    .replace(/(?:付款金额|支付金额|实付金额|订单金额|交易金额|金额)[：:\s]*(?:¥|￥)?\s*\d+(?:\.\d{1,2})?/gi, ' ')
    .replace(/(?:¥|￥)?\s*\d+(?:\.\d{1,2})?\s*元?/g, ' ')
    .replace(/微信支付|微信|支付宝|花呗|零钱通|零钱|现金|银行卡|信用卡|储蓄卡/g, ' ')
    .replace(/支付成功|交易成功|付款成功|已收钱|收款成功|已全额退款|全部账单|查找交易|收支统计|付款|支付|消费|支出|收入|收款|到账|转账|给|用|通过/g, ' ')
    .replace(/[+＋：:，,。；;\-—|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return note.slice(0, 100)
}

export const parseQuickEntry = (raw: string, fallbackAccount = '微信', now = new Date()): QuickEntryResult => {
  const text = raw.trim().replace(/(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, '')
  if (!text) throw new Error('请粘贴支付通知，或输入一句记账内容。')
  const amount = extractAmount(text)
  if (!amount || !Number.isFinite(amount)) throw new Error('没有识别到金额，请尝试写成“午饭35元，微信支付”。')

  const type = extractType(text)
  const account = extractAccount(text, fallbackAccount)
  const occurred_on = extractDate(text, now)
  const note = cleanNote(text)
  const category = inferTransactionCategory(`${text} ${note}`, type)
  const recognized = [
    `${type === 'income' ? '收入' : '支出'} ¥${amount.toFixed(2)}`,
    category,
    account,
    occurred_on,
  ]

  return {
    input: { type, amount, category, account, note, occurred_on },
    recognized,
    warnings: [],
  }
}

const looseLineAmount = (line: string) => {
  const regular = extractAmount(line)
  if (regular) return regular
  const match = line.match(/(?:^|\s)[+＋−—-]\s*([\d,]+\.\d{2})(?:\s|$)/)
  return match ? Number(match[1].replace(/,/g, '')) : 0
}

const summaryTextPattern = /(?:当日|本日|今日|每日|本月|当月|每月|月度)\s*(?:总)?\s*(?:收入|支出)|总收入|总支出|收入合计|支出合计|收支合计|收入总计|支出总计|合计收入|合计支出|(?:收入|支出)\s*\d+\s*笔/
const monthHeaderPattern = /(?:[2Z][0-9OoIl|]{3}\s*年\s*[0-9OoIl|]{1,2}\s*月|[2Z][0-9OoIl|]{3}\s*[-/.]\s*[0-9OoIl|]{1,2})(?=\s|[~～vV]|收入|支出|$)/

const isSummaryAmount = (lines: string[], index: number) => {
  const adjacent = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2))
  if (monthHeaderPattern.test(lines[index])) return true
  if (summaryTextPattern.test(adjacent.join(' '))) return true
  const immediateType = [lines[index - 1], lines[index + 1]].find((line) => /^(?:收入|支出)$/.test(line ?? ''))
  if (!immediateType) return false
  const nearby = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 4))
  return nearby.some((line) => /^(?:收入|支出)$/.test(line) && line !== immediateType)
}

export const parseQuickEntries = (raw: string, fallbackAccount = '微信', now = new Date()): QuickEntryResult[] => {
  const text = raw.trim().replace(/(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, '')
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const detectedAmountLines = lines
    .map((line, index) => ({ amount: looseLineAmount(line), index, line }))
    .filter((item) => item.amount > 0 && Number.isFinite(item.amount))
  const summaryAmountIndexes = new Set(detectedAmountLines
    .filter((item) => isSummaryAmount(lines, item.index))
    .map((item) => item.index))
  const amountLines = detectedAmountLines.filter((item) => !summaryAmountIndexes.has(item.index))

  if (detectedAmountLines.length === 0) return [parseQuickEntry(text, fallbackAccount, now)]

  const results: Array<QuickEntryResult & { sourceIndex: number }> = []
  const recentAmounts = new Map<number, number>()
  amountLines.forEach((item, position) => {
    const previousSame = recentAmounts.get(item.amount)
    recentAmounts.set(item.amount, item.index)
    const nearbyLabel = `${lines[item.index - 1] ?? ''} ${item.line} ${lines[item.index + 1] ?? ''}`
    if (previousSame !== undefined
      && item.index - previousSame <= 12
      && /订单金额|实付金额|交易金额/.test(nearbyLabel)) return

    const previousIndex = amountLines[position - 1]?.index
    const nextIndex = amountLines[position + 1]?.index
    let sectionStart = 0
    for (let index = 0; index <= item.index; index += 1) {
      if (monthHeaderPattern.test(lines[index])) sectionStart = index
    }
    const rawStart = previousIndex === undefined ? Math.max(0, item.index - 4) : Math.floor((previousIndex + item.index) / 2) + 1
    const start = Math.max(rawStart, sectionStart + 1)
    const end = nextIndex === undefined ? Math.min(lines.length, item.index + 5) : Math.floor((item.index + nextIndex) / 2) + 1
    const nextHeaderOffset = lines.slice(item.index + 1).findIndex((line) => monthHeaderPattern.test(line))
    const sectionEnd = nextHeaderOffset === -1 ? lines.length : item.index + 1 + nextHeaderOffset
    const nearestDate = lines
      .map((line, index) => ({ line, index, date: extractExplicitDate(line, now) }))
      .filter((candidate) => candidate.date
        && candidate.index > sectionStart
        && candidate.index < sectionEnd
        && Math.abs(candidate.index - item.index) <= 4)
      .sort((left, right) => {
        const distance = Math.abs(left.index - item.index) - Math.abs(right.index - item.index)
        if (distance !== 0) return distance
        return right.index - left.index
      })[0]
    let context = lines.slice(start, end).filter((line, offset) => {
      const absoluteIndex = start + offset
      if (summaryAmountIndexes.has(absoluteIndex) || summaryTextPattern.test(line)) return false
      if (nearestDate && absoluteIndex !== nearestDate.index && extractExplicitDate(line, now)) return false
      return absoluteIndex === item.index || !amountLines.some((amountLine) => amountLine.index === absoluteIndex)
    }).join('\n')
    let dateWasInferred = false
    if (nearestDate) context = `${nearestDate.line}\n${context}`
    else if (!extractExplicitDate(context, now)) dateWasInferred = true

    try {
      const signedType = /(?:^|\s)[+＋]\s*(?:¥|￥|关|羊|Y)?\s*\d/.test(item.line) ? '收入'
        : /(?:^|\s)[-−—]\s*(?:¥|￥|关|羊|Y)?\s*\d/.test(item.line) ? '支出' : ''
      const amountLabel = signedType ? `${signedType}金额` : '金额'
      const result = parseQuickEntry(`${amountLabel} ¥${item.amount.toFixed(2)}\n${context}`, fallbackAccount, now)
      if (dateWasInferred) result.warnings.push('未识别到账单日期，暂时使用今天')
      const hanCharacters = result.input.note.match(/\p{Script=Han}/gu)?.length ?? 0
      const latinCharacters = result.input.note.match(/[a-z]/gi)?.length ?? 0
      if (!result.input.note || (hanCharacters === 0 && latinCharacters >= 2)) {
        result.warnings.push('商户名称可能没有识别清楚')
      }
      if (result.input.amount >= 5000) result.warnings.push('金额较大，请确认不是合计金额')
      results.push({ ...result, sourceIndex: item.index })
    } catch {
      // A single unreadable row should not prevent other rows from being offered.
    }
  })

  return results.slice(0, 30).map(({ sourceIndex: _sourceIndex, ...result }) => result)
}
