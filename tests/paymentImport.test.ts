import { describe, expect, it } from 'vitest'
import { transactionFingerprint } from '../src/lib/paymentImport'
import type { TransactionInput } from '../src/types'

const payment: TransactionInput = {
  type: 'expense',
  amount: 18,
  category: '餐饮',
  account: '微信',
  note: '早餐店',
  occurred_on: '2026-09-16',
}

describe('账单重复检测', () => {
  it('同一笔账即使商户名称含不同空格，也生成相同标识', () => {
    const imported = { ...payment, note: '早 餐店' }

    expect(transactionFingerprint(imported)).toBe(transactionFingerprint(payment))
  })

  it('日期不同的账目不会被当成重复项', () => {
    const nextDay = { ...payment, occurred_on: '2026-09-17' }

    expect(transactionFingerprint(nextDay)).not.toBe(transactionFingerprint(payment))
  })
})
