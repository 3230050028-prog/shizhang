import { describe, expect, it } from 'vitest'
import { findReconciliationCleanupMatches, reconciliationCleanupTargetCount } from '../src/lib/reconciliationCleanup'
import type { Transaction } from '../src/types'

const firstTarget: Transaction = {
  id: 'target-1',
  type: 'expense',
  amount: 74.9,
  category: '娱乐',
  account: '微信',
  note: '玩双人成行',
  occurred_on: '2026-09-01',
}

describe('reconciliation cleanup matching', () => {
  it('does not allow deletion when the complete 30-record list is unavailable', () => {
    const result = findReconciliationCleanupMatches([firstTarget])
    expect(result.ready).toBe(false)
    expect(result.ids).toEqual(['target-1'])
    expect(result.missing).toHaveLength(reconciliationCleanupTargetCount - 1)
  })

  it('marks a target ambiguous when more than one record matches it', () => {
    const result = findReconciliationCleanupMatches([
      firstTarget,
      { ...firstTarget, id: 'target-2' },
    ])
    expect(result.ready).toBe(false)
    expect(result.ids).not.toContain('target-1')
    expect(result.ambiguous).toHaveLength(1)
  })

  it('does not match a record with a conflicting note', () => {
    const result = findReconciliationCleanupMatches([
      { ...firstTarget, note: '小红书订单' },
    ])
    expect(result.ids).toHaveLength(0)
    expect(result.missing).toHaveLength(reconciliationCleanupTargetCount)
  })
})
