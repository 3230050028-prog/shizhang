import { describe, expect, it } from 'vitest'
import {
  hasReconciliationMissingTransaction,
  reconciliationMissingTransaction,
} from '../src/lib/reconciliationMissing'
import type { Transaction } from '../src/types'

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'one',
  ...reconciliationMissingTransaction,
  ...overrides,
})

describe('核对漏账补记', () => {
  it('只有日期、金额、账户和备注全部一致才视为已经补记', () => {
    expect(hasReconciliationMissingTransaction([transaction()])).toBe(true)
    expect(hasReconciliationMissingTransaction([transaction({ account: '零钱通' })])).toBe(false)
    expect(hasReconciliationMissingTransaction([transaction({ occurred_on: '2026-09-06' })])).toBe(false)
  })

  it('兼容备注中的全角字符和多余空格', () => {
    expect(hasReconciliationMissingTransaction([
      transaction({ note: '华南师范大学　·  华南师范大学-消费' }),
    ])).toBe(true)
  })
})
