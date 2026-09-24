import type { Transaction, TransactionInput } from '../types'

export const reconciliationMissingTransaction: TransactionInput = {
  occurred_on: '2026-09-05',
  type: 'expense',
  amount: 5,
  category: '其他',
  account: '零钱',
  note: '华南师范大学 · 华南师范大学-消费',
}

const normalizeText = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ')
const cents = (value: number) => Math.round(Number(value) * 100)

export const hasReconciliationMissingTransaction = (transactions: Transaction[]) =>
  transactions.some((transaction) =>
    transaction.occurred_on === reconciliationMissingTransaction.occurred_on
    && transaction.type === reconciliationMissingTransaction.type
    && cents(transaction.amount) === cents(reconciliationMissingTransaction.amount)
    && normalizeText(transaction.account) === normalizeText(reconciliationMissingTransaction.account)
    && normalizeText(transaction.note ?? '') === normalizeText(reconciliationMissingTransaction.note),
  )
