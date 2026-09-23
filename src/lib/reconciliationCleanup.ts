import type { Transaction, TransactionType } from '../types'

interface CleanupTarget {
  occurred_on: string
  type: TransactionType
  amount: number
  account: string
  note: string
}

const cleanupTargets: CleanupTarget[] = [
  { occurred_on: '2026-09-01', type: 'expense', amount: 74.9, account: '微信', note: '玩双人成行' },
  { occurred_on: '2026-09-01', type: 'expense', amount: 75.9, account: '微信', note: 'em) 美团' },
  { occurred_on: '2026-09-01', type: 'expense', amount: 80, account: '微信', note: '吃饭' },
  { occurred_on: '2026-09-01', type: 'expense', amount: 166, account: '微信', note: '买兰州特产' },
  { occurred_on: '2026-09-02', type: 'income', amount: 39.9, account: '微信', note: '' },
  { occurred_on: '2026-09-02', type: 'income', amount: 74.9, account: '微信', note: '已全额退款' },
  { occurred_on: '2026-09-02', type: 'expense', amount: 100, account: '微信', note: '充话费' },
  { occurred_on: '2026-09-03', type: 'expense', amount: 0.99, account: '微信', note: '美团骑车' },
  { occurred_on: '2026-09-03', type: 'expense', amount: 0.99, account: '微信', note: '骑车' },
  { occurred_on: '2026-09-03', type: 'expense', amount: 2, account: '微信', note: '扫二维码 广一文具配' },
  { occurred_on: '2026-09-03', type: 'expense', amount: 19.9, account: '微信', note: '🎱' },
  { occurred_on: '2026-09-03', type: 'expense', amount: 62, account: '微信', note: '六人棒吃饭' },
  { occurred_on: '2026-09-04', type: 'expense', amount: 0.01, account: '微信', note: '小台灯到时候会退' },
  { occurred_on: '2026-09-04', type: 'expense', amount: 150, account: '微信', note: '¥ 转 舍友吴腾岳' },
  { occurred_on: '2026-09-05', type: 'expense', amount: 15.9, account: '微信', note: '买袜子收集器' },
  { occurred_on: '2026-09-05', type: 'expense', amount: 16.25, account: '微信', note: '晚饭' },
  { occurred_on: '2026-09-05', type: 'expense', amount: 20, account: '微信', note: '月 午饭' },
  { occurred_on: '2026-09-05', type: 'expense', amount: 100, account: '微信', note: '冲饭卡' },
  { occurred_on: '2026-09-05', type: 'expense', amount: 138, account: '微信', note: '华南师泥大学杂物' },
  { occurred_on: '2026-09-06', type: 'expense', amount: 5, account: '微信', note: '话费' },
  { occurred_on: '2026-09-06', type: 'expense', amount: 5.6, account: '微信', note: '买水泵' },
  { occurred_on: '2026-09-06', type: 'expense', amount: 14, account: '微信', note: '驱蚊水' },
  { occurred_on: '2026-09-06', type: 'expense', amount: 28.41, account: '微信', note: '排插' },
  { occurred_on: '2026-09-06', type: 'expense', amount: 30.35, account: '微信', note: '团建游戏' },
  { occurred_on: '2026-09-06', type: 'expense', amount: 39.9, account: '微信', note: 'gei宝买的腰靠' },
  { occurred_on: '2026-09-07', type: 'expense', amount: 16.25, account: '微信', note: '华南师学大学' },
  { occurred_on: '2026-09-07', type: 'expense', amount: 20.66, account: '微信', note: '大学校园超市' },
  { occurred_on: '2026-09-16', type: 'expense', amount: 50, account: '零钱通', note: '华南师范大学 · 华南师范大学-消费' },
  { occurred_on: '2026-09-18', type: 'expense', amount: 50, account: '零钱通', note: '华南师范大学 · 华南师范大学-消费' },
  { occurred_on: '2026-09-20', type: 'expense', amount: 200, account: '零钱通', note: '徐成橙 (Niveous.) · 转账备注:微信转账' },
]

const normalizeText = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ')
const cents = (value: number) => Math.round(Number(value) * 100)

const matchesTarget = (transaction: Transaction, target: CleanupTarget) =>
  transaction.occurred_on === target.occurred_on
  && transaction.type === target.type
  && cents(transaction.amount) === cents(target.amount)
  && normalizeText(transaction.account) === normalizeText(target.account)
  && normalizeText(transaction.note ?? '') === normalizeText(target.note)

export interface ReconciliationCleanupMatch {
  ids: string[]
  missing: CleanupTarget[]
  ambiguous: CleanupTarget[]
  ready: boolean
}

export const findReconciliationCleanupMatches = (transactions: Transaction[]): ReconciliationCleanupMatch => {
  const ids: string[] = []
  const missing: CleanupTarget[] = []
  const ambiguous: CleanupTarget[] = []

  cleanupTargets.forEach((target) => {
    const matches = transactions.filter((transaction) => matchesTarget(transaction, target))
    if (matches.length === 1) ids.push(matches[0].id)
    else if (matches.length === 0) missing.push(target)
    else ambiguous.push(target)
  })

  return {
    ids,
    missing,
    ambiguous,
    ready: ids.length === cleanupTargets.length && missing.length === 0 && ambiguous.length === 0,
  }
}

export const reconciliationCleanupTargetCount = cleanupTargets.length
