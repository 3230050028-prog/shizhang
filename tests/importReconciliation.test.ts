import { describe, expect, it } from 'vitest'
import { buildImportReconciliation } from '../src/lib/importReconciliation'
import type { TransactionInput } from '../src/types'

const row = (amount: number, type: TransactionInput['type'] = 'expense'): TransactionInput => ({
  type,
  amount,
  category: '其他',
  account: '零钱',
  note: '测试',
  occurred_on: '2026-09-01',
})

describe('导入金额核对', () => {
  it('收入和支出分别核对且避免小数误差', () => {
    const result = buildImportReconciliation(
      [row(0.1), row(0.2), row(10, 'income')],
      [row(0.1), row(10, 'income')],
      [row(0.2)],
      [],
    )
    expect(result.source).toEqual({ expense: 0.3, income: 10 })
    expect(result.difference).toEqual({ expense: 0, income: 0 })
    expect(result.balanced).toBe(true)
  })

  it('发现超过本批上限而尚未覆盖的金额', () => {
    const result = buildImportReconciliation([row(20), row(5)], [row(20)], [], [])
    expect(result.difference).toEqual({ expense: 5, income: 0 })
    expect(result.balanced).toBe(false)
  })
})
