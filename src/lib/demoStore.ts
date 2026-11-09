import type { Budget, SavedAccount, Transaction } from '../types'

/** 本地演示账本的存储入口。 */
export const demoKeys = {
  transactions: 'shizhang-demo-transactions',
  budgets: 'shizhang-demo-budgets',
  accounts: 'shizhang-demo-accounts',
} as const

export type DemoListRead<T> = {
  data: T[]
  corrupted: boolean
  unavailable: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isDate = (value: unknown): value is string =>
  typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const isDemoTransaction = (value: unknown): value is Transaction =>
  isRecord(value)
  && typeof value.id === 'string'
  && (value.type === 'income' || value.type === 'expense')
  && isAmount(value.amount)
  && value.amount > 0
  && typeof value.category === 'string'
  && typeof value.note === 'string'
  && isDate(value.occurred_on)
  && (value.account === undefined || typeof value.account === 'string')

export const isDemoBudget = (value: unknown): value is Budget =>
  isRecord(value)
  && typeof value.id === 'string'
  && isDate(value.month)
  && typeof value.category === 'string'
  && isAmount(value.amount)

export const isDemoAccount = (value: unknown): value is SavedAccount =>
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'

export function readDemoList<T>(
  key: string,
  fallback: T[],
  isValid: (value: unknown) => value is T,
): DemoListRead<T> {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return { data: fallback, corrupted: false, unavailable: true }
  }

  if (raw === null) return { data: fallback, corrupted: false, unavailable: false }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isValid)) {
      return { data: fallback, corrupted: true, unavailable: false }
    }
    return { data: parsed, corrupted: false, unavailable: false }
  } catch {
    return { data: fallback, corrupted: true, unavailable: false }
  }
}

export function writeDemoList(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
