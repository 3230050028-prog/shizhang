import type { Transaction, TransactionInput, TransactionType } from '../types'

export type MerchantCategoryMemory = Map<string, string>

export const normalizeMerchantKey = (note: string) => {
  const merchant = note.split('·')[0]?.trim() ?? ''
  return merchant
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

const memoryKey = (type: TransactionType, note: string) => `${type}|${normalizeMerchantKey(note)}`

export const buildMerchantCategoryMemory = (transactions: Transaction[]): MerchantCategoryMemory => {
  const latest = new Map<string, { category: string; timestamp: number }>()

  transactions.forEach((transaction) => {
    const merchant = normalizeMerchantKey(transaction.note)
    if (!merchant || !transaction.category.trim()) return
    const key = memoryKey(transaction.type, transaction.note)
    const timestamp = Date.parse(transaction.updated_at ?? transaction.created_at ?? `${transaction.occurred_on}T00:00:00`)
    const existing = latest.get(key)
    if (!existing || timestamp > existing.timestamp) {
      latest.set(key, { category: transaction.category, timestamp })
    }
  })

  return new Map([...latest].map(([key, value]) => [key, value.category]))
}

export const applyRememberedCategory = <T extends TransactionInput>(input: T, memory: MerchantCategoryMemory): T => {
  const merchant = normalizeMerchantKey(input.note)
  if (!merchant) return input
  const category = memory.get(memoryKey(input.type, input.note))
  return category && category !== input.category ? { ...input, category } : input
}
