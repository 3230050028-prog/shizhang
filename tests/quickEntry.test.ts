import { describe, expect, it } from 'vitest'
import { parseQuickEntries, parseQuickEntry } from '../src/lib/quickEntry'

const referenceDate = new Date(2026, 8, 16, 12)

describe('自然语言记账', () => {
  it('识别“午饭35”为35元支出', () => {
    const result = parseQuickEntry('午饭35', '微信', referenceDate)

    expect(result.input).toMatchObject({
      type: 'expense',
      amount: 35,
      category: '餐饮',
      note: '午饭',
      occurred_on: '2026-09-16',
    })
  })

  it('识别“昨天买奶茶12.5元”的日期和金额', () => {
    const result = parseQuickEntry('昨天买奶茶12.5元', '微信', referenceDate)

    expect(result.input).toMatchObject({
      type: 'expense',
      amount: 12.5,
      category: '餐饮',
      occurred_on: '2026-09-15',
    })
  })
})

describe('OCR 文字转账目', () => {
  it('忽略月度收入和支出汇总金额，只保留真实明细', () => {
    const text = [
      '2026年9月 支出¥406.70 收入¥74.90',
      '小红书',
      '9月1日 23:09',
      '-9.90',
      '米为先',
      '9月1日 18:54',
      '-80.00',
    ].join('\n')

    const results = parseQuickEntries(text, '微信', referenceDate)

    expect(results.map((result) => result.input.amount)).toEqual([9.9, 80])
    expect(results.every((result) => result.input.occurred_on === '2026-09-01')).toBe(true)
  })
})
