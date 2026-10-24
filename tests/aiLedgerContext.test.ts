import { describe, expect, it } from 'vitest'
import { ledgerPeriod, ledgerSummary } from '../supabase/functions/ai-gateway/ledgerContext'

const now = new Date('2026-10-24T12:00:00Z')
const user = (content: string) => ({ role: 'user' as const, content })

describe('AI analysis period', () => {
  it('uses the page month instead of the latest transaction date', () => {
    expect(ledgerPeriod([user('这个月花在哪里？')], '2026-09', now)).toMatchObject({
      today: '2026-10-24', month: '2026-09', from: '2026-09-01', to: '2026-09-30',
    })
  })
  it('recognizes the screenshot follow-up and ignores the assistant mistaken future month', () => {
    expect(ledgerPeriod([user('这个月花在哪里？'), { role: 'assistant', content: '2027年3月支出13.87元' }, user('26年10月')], '2026-09', now))
      .toMatchObject({ month: '2026-10', from: '2026-10-01', to: '2026-10-24' })
  })
  it('preserves an explicit month through follow-up questions', () => {
    expect(ledgerPeriod([user('2026-09月'), user('餐饮呢？')], '2026-10', now).month).toBe('2026-09')
    expect(ledgerPeriod([user('2026年9月'), user('这个月呢？')], '2026-10', now).month).toBe('2026-10')
  })
  it('uses the Shanghai calendar date and handles year boundaries', () => {
    const january = new Date('2025-12-31T16:01:00Z')
    expect(ledgerPeriod([user('这个月')], null, january)).toMatchObject({ today: '2026-01-01', month: '2026-01' })
    expect(ledgerPeriod([user('上个月')], '2026-01', january)).toMatchObject({ from: '2025-12-01', to: '2025-12-31' })
  })
  it('keeps broader questions bounded to the recent year and excludes future rows', () => {
    expect(ledgerPeriod([user('最近有哪些高额消费？')], '2026-10', now))
      .toMatchObject({ from: '2025-11-01', to: '2026-10-24' })
  })
})

it('computes exact category and income totals in cents', () => {
  const row = { category: '餐饮', account: '微信', note: '', occurred_on: '2026-10-01' }
  expect(ledgerSummary([
    { ...row, type: 'expense', amount: '0.10' }, { ...row, type: 'expense', amount: 0.2 },
    { ...row, type: 'income', amount: 20 }, { ...row, type: 'expense', category: '购物', amount: 4.5 },
  ])).toEqual({ 笔数: 4, 收入: 20, 支出: 4.8, 支出分类: [{ 分类: '购物', 金额: 4.5 }, { 分类: '餐饮', 金额: 0.3 }] })
})
