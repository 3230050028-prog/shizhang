import { describe, expect, it } from 'vitest'
import { applyRememberedCategory, buildMerchantCategoryMemory } from '../src/lib/merchantCategory'
import type { Transaction, TransactionInput } from '../src/types'

const input: TransactionInput = {
  type: 'expense',
  amount: 28,
  category: '其他',
  account: '微信',
  note: '美团平台商户',
  occurred_on: '2026-09-25',
}

describe('平台规则与历史分类', () => {
  it('已知平台规则不会被旧的“其他”分类覆盖', () => {
    const history: Transaction[] = [{ ...input, id: 'old', category: '其他' }]

    expect(applyRememberedCategory(input, buildMerchantCategoryMemory(history)).category).toBe('餐饮')
  })

  it('没有平台规则的商户继续使用用户历史分类', () => {
    const unknown = { ...input, note: '巷口小店' }
    const history: Transaction[] = [{ ...unknown, id: 'old', category: '日用品' }]

    expect(applyRememberedCategory(unknown, buildMerchantCategoryMemory(history)).category).toBe('日用品')
  })
})
