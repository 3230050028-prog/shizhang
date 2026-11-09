import { afterEach, describe, expect, it, vi } from 'vitest'
import { demoKeys, isDemoAccount, isDemoBudget, isDemoTransaction, readDemoList, writeDemoList } from '../src/lib/demoStore'

const isItem = (value: unknown): value is { id: string } =>
  typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'

afterEach(() => vi.unstubAllGlobals())

describe('演示账本本地存储', () => {
  it('保留旧键名并读取已保存的列表', () => {
    const saved = [{ id: 'one' }]
    const getItem = vi.fn(() => JSON.stringify(saved))
    vi.stubGlobal('window', { localStorage: { getItem } })

    expect(demoKeys.transactions).toBe('shizhang-demo-transactions')
    expect(readDemoList(demoKeys.transactions, [], isItem)).toEqual({
      data: saved, corrupted: false, unavailable: false,
    })
  })

  it('缺少数据时使用初始列表，损坏数据不当作有效列表', () => {
    const fallback = [{ id: 'sample' }]
    const getItem = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce('')
      .mockReturnValueOnce('{bad json').mockReturnValueOnce('{"id":"one"}')
    vi.stubGlobal('window', { localStorage: { getItem } })

    expect(readDemoList('key', fallback, isItem)).toEqual({ data: fallback, corrupted: false, unavailable: false })
    for (let index = 0; index < 3; index += 1) {
      expect(readDemoList('key', fallback, isItem)).toEqual({ data: fallback, corrupted: true, unavailable: false })
    }
  })

  it('数组中有不符合账目格式的元素时保留原始数据', () => {
    const fallback = [{ id: 'sample' }]
    vi.stubGlobal('window', { localStorage: { getItem: () => '[null,{"id":2}]' } })

    expect(readDemoList('key', fallback, isItem)).toEqual({ data: fallback, corrupted: true, unavailable: false })
  })

  it('演示账目金额或日期字段错误时拒绝读取', () => {
    const valid = { id: 'one', type: 'expense', amount: 10, category: '餐饮', account: '微信', note: '午饭', occurred_on: '2026-10-01' }
    const getItem = vi.fn().mockReturnValueOnce(JSON.stringify([{ ...valid, amount: '10' }]))
      .mockReturnValueOnce(JSON.stringify([{ ...valid, amount: 0 }]))
      .mockReturnValueOnce(JSON.stringify([{ ...valid, occurred_on: '2026-02-30' }]))
    vi.stubGlobal('window', { localStorage: { getItem } })

    expect(readDemoList('key', [valid], isDemoTransaction).corrupted).toBe(true)
    expect(readDemoList('key', [valid], isDemoTransaction).corrupted).toBe(true)
    expect(readDemoList('key', [valid], isDemoTransaction).corrupted).toBe(true)
  })

  it('预算和账户也校验必需字段', () => {
    expect(isDemoBudget({ id: 'b', month: '2026-10-01', category: '全部', amount: 2000 })).toBe(true)
    expect(isDemoBudget({ id: 'b', month: '2026-10-01', category: '全部', amount: '2000' })).toBe(false)
    expect(isDemoAccount({ id: 'a', name: '微信' })).toBe(true)
    expect(isDemoAccount({ id: 'a', name: 123 })).toBe(false)
  })

  it('浏览器拒绝读取或写入时返回失败状态', () => {
    vi.stubGlobal('window', { localStorage: {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('quota exceeded') },
    } })

    expect(readDemoList('key', [], isItem)).toEqual({ data: [], corrupted: false, unavailable: true })
    expect(writeDemoList('key', [])).toBe(false)
  })

  it('写入成功时保存 JSON', () => {
    const setItem = vi.fn()
    vi.stubGlobal('window', { localStorage: { setItem } })

    expect(writeDemoList('key', [{ id: 'one' }])).toBe(true)
    expect(setItem).toHaveBeenCalledWith('key', '[{"id":"one"}]')
  })
})
