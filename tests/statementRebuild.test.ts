import { describe, expect, it } from 'vitest'
import { buildStatementRebuildPlan } from '../src/lib/statementRebuild'
import type { Transaction, TransactionInput } from '../src/types'

const input = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
  type: 'expense',
  amount: 10,
  category: '其他',
  account: '零钱通',
  note: '微信原账单',
  occurred_on: '2026-09-05',
  ...overrides,
})

const saved = (id: string, overrides: Partial<Transaction> = {}): Transaction => ({
  id,
  ...input(),
  ...overrides,
})

describe('按原账单安全重建', () => {
  it('只选择账单日期范围内的微信和来源账户记录', () => {
    const plan = buildStatementRebuildPlan(
      [input({ occurred_on: '2026-09-01', account: '零钱' }), input({ occurred_on: '2026-09-22' })],
      [
        saved('source-account', { account: '零钱', occurred_on: '2026-09-10' }),
        saved('manual-wechat', { account: '微信', occurred_on: '2026-09-10' }),
        saved('bank', { account: '交通银行', occurred_on: '2026-09-10' }),
        saved('outside', { account: '零钱通', occurred_on: '2026-09-23' }),
      ],
    )

    expect(plan?.startDate).toBe('2026-09-01')
    expect(plan?.endDate).toBe('2026-09-22')
    expect(plan?.targets.map((row) => row.id)).toEqual(['source-account', 'manual-wechat'])
  })

  it('拒绝空文件和超过单批上限的文件', () => {
    expect(buildStatementRebuildPlan([], [])).toBeNull()
    expect(buildStatementRebuildPlan(Array.from({ length: 501 }, () => input()), [])).toBeNull()
  })

  it('写入数据库前移除原文件行号等解析字段', () => {
    const plan = buildStatementRebuildPlan([
      { ...input(), sourceLine: 23 },
    ], [saved('old')])

    expect(plan?.replacements[0]).toEqual(input())
    expect(plan?.replacements[0]).not.toHaveProperty('sourceLine')
  })
})
