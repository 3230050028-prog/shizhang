import type { TransactionInput } from '../types'

export interface AmountTotals {
  expense: number
  income: number
}

const cents = (value: number) => Math.round(Number(value) * 100)

export const totalAmounts = (rows: TransactionInput[]): AmountTotals => {
  const totals = rows.reduce((sum, row) => {
    sum[row.type] += cents(row.amount)
    return sum
  }, { expense: 0, income: 0 })
  return { expense: totals.expense / 100, income: totals.income / 100 }
}

export const buildImportReconciliation = (
  sourceRows: TransactionInput[],
  pendingRows: TransactionInput[],
  duplicateRows: TransactionInput[],
  correctedRows: TransactionInput[],
) => {
  const source = totalAmounts(sourceRows)
  const pending = totalAmounts(pendingRows)
  const duplicate = totalAmounts(duplicateRows)
  const corrected = totalAmounts(correctedRows)
  const coveredExpense = cents(pending.expense) + cents(duplicate.expense) + cents(corrected.expense)
  const coveredIncome = cents(pending.income) + cents(duplicate.income) + cents(corrected.income)
  const difference = {
    expense: (cents(source.expense) - coveredExpense) / 100,
    income: (cents(source.income) - coveredIncome) / 100,
  }

  return {
    source,
    pending,
    duplicate,
    corrected,
    difference,
    balanced: cents(difference.expense) === 0 && cents(difference.income) === 0,
  }
}
