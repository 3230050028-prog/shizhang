import type { Transaction, TransactionInput } from '../types'

interface TemplateGroup {
  count: number
  latest: Transaction
  latestAt: string
}

export const buildQuickTemplates = (transactions: Transaction[], occurredOn: string, limit = 4): TransactionInput[] => {
  const groups = new Map<string, TemplateGroup>()
  transactions.forEach((transaction) => {
    const normalizedNote = transaction.note.trim().replace(/\s+/g, '').toLocaleLowerCase('zh-CN')
    if (!normalizedNote) return
    const key = `${transaction.type}|${normalizedNote}`
    const latestAt = transaction.created_at ?? `${transaction.occurred_on}T00:00:00`
    const current = groups.get(key)
    if (!current) {
      groups.set(key, { count: 1, latest: transaction, latestAt })
      return
    }
    current.count += 1
    if (latestAt > current.latestAt) {
      current.latest = transaction
      current.latestAt = latestAt
    }
  })

  return [...groups.values()]
    .sort((left, right) => right.count - left.count || right.latestAt.localeCompare(left.latestAt))
    .slice(0, limit)
    .map(({ latest }) => ({
      type: latest.type,
      amount: latest.amount,
      category: latest.category,
      account: latest.account,
      note: latest.note,
      occurred_on: occurredOn,
    }))
}
