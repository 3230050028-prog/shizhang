import type { Transaction, TransactionInput } from '../types'

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN')

export interface StatementRebuildPlan {
  startDate: string
  endDate: string
  sourceAccounts: string[]
  targets: Transaction[]
  replacements: TransactionInput[]
}

export const buildStatementRebuildPlan = (
  sourceRows: Array<TransactionInput & { sourceLine?: number }>,
  transactions: Transaction[],
): StatementRebuildPlan | null => {
  if (!sourceRows.length || sourceRows.length > 500) return null
  const dates = sourceRows.map((row) => row.occurred_on).sort()
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]
  const sourceAccounts = [...new Set(sourceRows.map((row) => row.account.trim()).filter(Boolean))]
  const normalizedAccounts = new Set(sourceAccounts.map(normalize))
  const targets = transactions.filter((transaction) => {
    if (transaction.occurred_on < startDate || transaction.occurred_on > endDate) return false
    const account = normalize(transaction.account || '')
    return normalizedAccounts.has(account) || account.includes('微信')
  })

  return {
    startDate,
    endDate,
    sourceAccounts,
    targets,
    replacements: sourceRows.map(({ sourceLine: _sourceLine, ...row }) => row),
  }
}
