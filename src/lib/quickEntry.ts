import { toLocalDate } from './date'
import { inferTransactionCategory } from './paymentImport'
import type { TransactionInput, TransactionType } from '../types'

export interface QuickEntryResult {
  input: TransactionInput
  recognized: string[]
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

const validDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return toLocalDate(date)
}

const extractDate = (text: string, now: Date) => {
  const relativeDate = new Date(now)
  if (/(?:今天|今日|今晚|今早|今晨|今夜)/.test(text)) return toLocalDate(relativeDate)
  if (text.includes('前天')) {
    relativeDate.setDate(relativeDate.getDate() - 2)
    return toLocalDate(relativeDate)
  }
  if (text.includes('昨天')) {
    relativeDate.setDate(relativeDate.getDate() - 1)
    return toLocalDate(relativeDate)
  }

  const full = text.match(/([2Z][0-9OoIl|]{3})[-/.年]([0-9OoIl|]{1,2})[-/.月]([0-9OoIl|]{1,2})日?/)
  if (full) {
    const parsed = validDate(
      normalizeDateNumber(full[1].replace(/^Z/, '2')),
      normalizeDateNumber(full[2]),
      normalizeDateNumber(full[3]),
    )
    if (parsed) return parsed
  }

  const monthDays = text.matchAll(/(?:^|[^0-9OoIl|])([0-9OoIl|]{1,2})[-/.月]([0-9OoIl|]{1,2})日?/g)
  for (const monthDay of monthDays) {
    const parsed = validDate(now.getFullYear(), normalizeDateNumber(monthDay[1]), normalizeDateNumber(monthDay[2]))
    if (parsed) return parsed
  }

  return toLocalDate(relativeDate)
}

const extractType = (text: string): TransactionType =>
  /收入|收款|到账|工资|薪资|奖金|退款|返现|红包/.test(text) ? 'income' : 'expense'

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
      .replace(/(?:付款金额|支付金额|实付金额|订单金额|交易金额|金额|支付时间|交易时间|创建时间|支付方式|付款方式|商户名称|商户全称|交易对方|交易对象|收款方|商品说明)[：:]?/g, ' ')
      .replace(/(?:¥|￥|关|羊|Y)\s*[0-9OoIl|SB,]+(?:[.。][0-9OoIl|SB]{1,2})?\s*元?/gi, ' ')
      .replace(/(?:^|\s)[-−]?\s*\d[\d,]*(?:[.。]\d{1,2})?\s*元?(?=\s|$)/g, ' ')
      .replace(/(?:[2Z][0-9OoIl|]{3})[-/.年][0-9OoIl|]{1,2}[-/.月][0-9OoIl|]{1,2}(?:日)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/g, ' ')
      .replace(/(?:今天|今日|今晚|今早|今晨|今夜|昨天|前天|上午|中午|下午|晚上|凌晨)|\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
      .replace(/支付成功|交易成功|付款成功|订单详情|账单详情|微信支付|支付宝/g, ' ')
      .replace(/[：:，,。；;—|{}-]+/g, ' ')
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
    .replace(/(?:今天|今日|今晚|今早|今晨|今夜|昨天|前天|刚刚|上午|中午|下午|晚上|凌晨)/g, ' ')
    .replace(/(?:付款金额|支付金额|实付金额|订单金额|交易金额|金额)[：:\s]*(?:¥|￥)?\s*\d+(?:\.\d{1,2})?/gi, ' ')
    .replace(/(?:¥|￥)?\s*\d+(?:\.\d{1,2})?\s*元?/g, ' ')
    .replace(/微信支付|微信|支付宝|花呗|零钱通|零钱|现金|银行卡|信用卡|储蓄卡/g, ' ')
    .replace(/支付成功|交易成功|付款成功|已收钱|收款成功|付款|支付|消费|支出|收入|收款|到账|转账|给|用|通过/g, ' ')
    .replace(/[：:，,。；;\-—|]+/g, ' ')
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
  }
}

const looseLineAmount = (line: string) => {
  const regular = extractAmount(line)
  if (regular) return regular
  const match = line.match(/(?:^|\s)[-−]\s*([\d,]+\.\d{2})(?:\s|$)/)
  return match ? Number(match[1].replace(/,/g, '')) : 0
}

export const parseQuickEntries = (raw: string, fallbackAccount = '微信', now = new Date()): QuickEntryResult[] => {
  const text = raw.trim().replace(/(?<=[\u3400-\u9fff])[ \t]+(?=[\u3400-\u9fff])/g, '')
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const amountLines = lines
    .map((line, index) => ({ amount: looseLineAmount(line), index, line }))
    .filter((item) => item.amount > 0 && Number.isFinite(item.amount))

  if (amountLines.length < 2) return [parseQuickEntry(text, fallbackAccount, now)]

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
    const start = previousIndex === undefined ? Math.max(0, item.index - 4) : Math.floor((previousIndex + item.index) / 2) + 1
    const end = nextIndex === undefined ? Math.min(lines.length, item.index + 5) : Math.floor((item.index + nextIndex) / 2) + 1
    const context = lines.slice(start, end).filter((_, offset) => {
      const absoluteIndex = start + offset
      return absoluteIndex === item.index || !amountLines.some((amountLine) => amountLine.index === absoluteIndex)
    }).join('\n')

    try {
      const result = parseQuickEntry(`金额 ¥${item.amount.toFixed(2)}\n${context}`, fallbackAccount, now)
      results.push({ ...result, sourceIndex: item.index })
    } catch {
      // A single unreadable row should not prevent other rows from being offered.
    }
  })

  return results.slice(0, 30).map(({ sourceIndex: _sourceIndex, ...result }) => result)
}
