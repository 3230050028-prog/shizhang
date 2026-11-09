import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseImportHistory, parseLegacyImportBatch, readImportHistory, removeImportBatch, saveImportBatch } from '../src/lib/importHistory'

afterEach(() => vi.unstubAllGlobals())

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

  it('导入历史损坏时拒绝覆盖原始内容', () => {
    const stored = new Map([['shizhang:import-history', '{broken']])
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    } })

    expect(() => saveImportBatch({ ids: ['new'], fileName: '账单.csv', importedAt: '2026-09-23T10:00:00.000Z' })).toThrow()
    expect(stored.get('shizhang:import-history')).toBe('{broken')
  })

  it('旧版历史迁移后可以撤销，清空后不会复活旧批次', () => {
    const legacy = { ids: ['old'], fileName: '旧账单.csv', importedAt: '2026-09-22T10:00:00.000Z' }
    const current = { ids: ['new'], fileName: '新账单.csv', importedAt: '2026-09-23T10:00:00.000Z' }
    const stored = new Map([['shizhang:last-import-batch', JSON.stringify(legacy)]])
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value) },
      removeItem: (key: string) => { stored.delete(key) },
    } })

    expect(saveImportBatch(current)).toEqual([current, legacy])
    expect(readImportHistory()).toEqual([current, legacy])
    expect(stored.has('shizhang:last-import-batch')).toBe(false)
    expect(removeImportBatch(current.importedAt)).toEqual([legacy])
    expect(removeImportBatch(legacy.importedAt)).toEqual([])
    expect(readImportHistory()).toEqual([])
  })

  it('历史含部分损坏记录时保留完整原文，不覆盖有效批次', () => {
    const original = JSON.stringify([
      { ids: ['old'], fileName: '旧账单.csv', importedAt: '2026-09-22T10:00:00.000Z' },
      { ids: [123], fileName: '损坏账单.csv', importedAt: '2026-09-21T10:00:00.000Z' },
    ])
    const stored = new Map([['shizhang:import-history', original]])
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value) },
    } })

    expect(() => saveImportBatch({ ids: ['new'], fileName: '新账单.csv', importedAt: '2026-09-23T10:00:00.000Z' })).toThrow()
    expect(stored.get('shizhang:import-history')).toBe(original)
  })
})
