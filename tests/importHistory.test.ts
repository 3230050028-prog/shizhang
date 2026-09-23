import { describe, expect, it } from 'vitest'
import { parseLastImportBatch } from '../src/lib/importHistory'

describe('上次导入记录', () => {
  it('读取有效批次并去除重复编号', () => {
    const value = JSON.stringify({
      ids: ['one', 'two', 'one'],
      fileName: '微信账单.xlsx',
      importedAt: '2026-09-23T10:00:00.000Z',
    })

    expect(parseLastImportBatch(value)).toEqual({
      ids: ['one', 'two'],
      fileName: '微信账单.xlsx',
      importedAt: '2026-09-23T10:00:00.000Z',
    })
  })

  it('损坏或缺少记录编号时不提供撤销', () => {
    expect(parseLastImportBatch('not-json')).toBeNull()
    expect(parseLastImportBatch(JSON.stringify({ ids: [], fileName: '账单.xlsx', importedAt: 'now' }))).toBeNull()
  })
})
