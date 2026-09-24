import { describe, expect, it } from 'vitest'
import { parseImportHistory, parseLegacyImportBatch } from '../src/lib/importHistory'

describe('导入历史', () => {
  it('读取多次导入并去除同一批次中的重复编号', () => {
    const value = JSON.stringify([{
      ids: ['one', 'two', 'one'],
      fileName: '微信账单.xlsx',
      importedAt: '2026-09-23T10:00:00.000Z',
      expenseAmount: 12.5,
      incomeAmount: 3,
    }])

    expect(parseImportHistory(value)).toEqual([{
      ids: ['one', 'two'],
      fileName: '微信账单.xlsx',
      importedAt: '2026-09-23T10:00:00.000Z',
      expenseAmount: 12.5,
      incomeAmount: 3,
    }])
  })

  it('兼容旧版本保存的上次导入', () => {
    expect(parseLegacyImportBatch(JSON.stringify({
      ids: ['legacy'],
      fileName: '支付宝账单.csv',
      importedAt: '2026-09-22T10:00:00.000Z',
    }))).toEqual({
      ids: ['legacy'],
      fileName: '支付宝账单.csv',
      importedAt: '2026-09-22T10:00:00.000Z',
    })
  })

  it('跳过损坏批次并限制最近10次', () => {
    const batches = Array.from({ length: 12 }, (_, index) => ({
      ids: index === 3 ? [] : [`id-${index}`],
      fileName: `账单-${index}.xlsx`,
      importedAt: `2026-09-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    }))
    expect(parseImportHistory(JSON.stringify(batches))).toHaveLength(10)
    expect(parseImportHistory('not-json')).toEqual([])
  })
})
