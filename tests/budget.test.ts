import { describe, expect, it } from 'vitest'
import { calculateBudgetBalance } from '../src/lib/budget'

describe('月度预算结余', () => {
  it('按预算减支出再加收入计算', () => {
    expect(calculateBudgetBalance(2000, 1200, 500)).toBe(1300)
  })
})
