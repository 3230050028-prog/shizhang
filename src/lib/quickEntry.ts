import { toLocalDate } from './date'
import { inferTransactionCategory } from './paymentImport'
import type { TransactionInput, TransactionType } from '../types'

export interface QuickEntryResult {
  input: TransactionInput
  recognized: string[]
}

const extractAmount = (text: string) => {
  const patterns = [
    /(?:付款金额|支付金额|实付金额|订单金额|交易金额|金额|消费|支出|收入|收款|到账)[：:\s]*(?:¥|￥)?\s*(\d+(?:\.\d{1,2})?)/i,
    /(?:¥|￥)\s*(\d+(?:\.\d{1,2})?)/,
    /(\d+(?:\.\d{1,2})?)\s*元/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return Number(match[1])
  }
  return 0
}

const extractDate = (text: string, now: Date) => {
  const full = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
  if (full) return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`

  const monthDay = text.match(/(?:^|\D)(\d{1,2})[月/.](\d{1,2})日?/)
  if (monthDay) {
    return toLocalDate(new Date(now.getFullYear(), Number(monthDay[1]) - 1, Number(monthDay[2])))
  }

  const date = new Date(now)
  if (text.includes('前天')) date.setDate(date.getDate() - 2)
  else if (text.includes('昨天')) date.setDate(date.getDate() - 1)
  return toLocalDate(date)
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
  const labeled = text.match(/(?:商户名称|交易对方|收款方|付款给|转账给|向)[：:\s]*([^\n，,。]+)/)
  let note = labeled?.[1] ?? text
  note = note
    .replace(/20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/g, ' ')
    .replace(/(?:今天|昨天|前天|刚刚|上午|中午|下午|晚上|凌晨)/g, ' ')
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
  const text = raw.trim()
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
