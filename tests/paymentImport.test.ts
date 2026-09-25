import { describe, expect, it } from 'vitest'
import { findDuplicateTransactionCopies, findPaymentDateCorrections, inferTransactionCategory, parsePaymentStatement, spreadsheetCellToText, splitPaymentRows, transactionFingerprint } from '../src/lib/paymentImport'
import type { TransactionInput } from '../src/types'

const payment: TransactionInput = {
  type: 'expense',
  amount: 18,
  category: '餐饮',
  account: '微信',
  note: '早餐店',
  occurred_on: '2026-09-16',
}

describe('账单重复检测', () => {
  it('同一笔账即使商户名称含不同空格，也生成相同标识', () => {
    const imported = { ...payment, note: '早 餐店' }

    expect(transactionFingerprint(imported)).toBe(transactionFingerprint(payment))
  })

  it('日期不同的账目不会被当成重复项', () => {
    const nextDay = { ...payment, occurred_on: '2026-09-17' }

    expect(transactionFingerprint(nextDay)).not.toBe(transactionFingerprint(payment))
  })

  it('重复账目保留在单独的预览列表中', () => {
    const newPayment = { ...payment, occurred_on: '2026-09-17' }
    const result = splitPaymentRows([payment, newPayment], [transactionFingerprint(payment)])

    expect(result.uniqueRows).toEqual([newPayment])
    expect(result.duplicateRows).toEqual([payment])
  })

  it('金额和商户唯一对应时可核对并修正日期', () => {
    const existing = { ...payment, id: 'existing', occurred_on: '2026-09-20' }
    const incoming = { ...payment, occurred_on: '2026-09-22' }

    const corrections = findPaymentDateCorrections([incoming], [existing])

    expect(corrections).toEqual([{ incoming, existing }])
  })

  it('同金额同商户出现多次时不自动修正日期', () => {
    const existing = { ...payment, id: 'existing', occurred_on: '2026-09-20' }
    const incoming = [
      { ...payment, occurred_on: '2026-09-21' },
      { ...payment, occurred_on: '2026-09-22' },
    ]

    expect(findPaymentDateCorrections(incoming, [existing])).toEqual([])
  })

  it('清理完全重复账目时保留创建时间最早的一笔', () => {
    const original = { ...payment, id: 'original', created_at: '2026-09-22T10:00:00Z' }
    const laterCopy = { ...payment, id: 'copy', created_at: '2026-09-22T10:05:00Z' }

    expect(findDuplicateTransactionCopies([laterCopy, original])).toEqual([laterCopy])
  })

  it('同商户同金额但日期不同的账目不会作为重复副本删除', () => {
    const first = { ...payment, id: 'first', created_at: '2026-09-22T10:00:00Z' }
    const nextDay = { ...payment, id: 'next', occurred_on: '2026-09-17', created_at: '2026-09-23T10:00:00Z' }

    expect(findDuplicateTransactionCopies([first, nextDay])).toEqual([])
  })

  it('同日同商户同金额但付款账户不同的账目不会作为重复副本删除', () => {
    const balance = { ...payment, id: 'balance', account: '零钱', created_at: '2026-09-22T10:00:00Z' }
    const balancePlus = { ...payment, id: 'balance-plus', account: '零钱通', created_at: '2026-09-22T10:05:00Z' }

    expect(transactionFingerprint(balance)).not.toBe(transactionFingerprint(balancePlus))
    expect(findDuplicateTransactionCopies([balance, balancePlus])).toEqual([])
  })
})

describe('账单日期', () => {
  it('同时存在多个时间列时优先使用准确的交易时间', () => {
    const statement = [
      '创建时间,交易时间,收/支,金额,交易对方,商品说明,支付方式',
      '2026-09-20 12:13:00,2026-09-22 12:13:00,支出,3.50,华南师范大学,SIOS|45|41,零钱通',
    ].join('\n')

    const result = parsePaymentStatement(statement)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].occurred_on).toBe('2026-09-22')
  })

  it('Excel 日期使用表格原始时区，不把晚间交易推到第二天', () => {
    const excelDate = new Date(Date.UTC(2026, 8, 22, 21, 15, 0))

    expect(spreadsheetCellToText(excelDate)).toBe('2026-09-22 21:15:00')
  })
})

describe('常见平台分类', () => {
  it.each([
    ['美团平台商户', '餐饮'],
    ['淘宝闪购订单', '餐饮'],
    ['饿了么外卖', '餐饮'],
    ['淘宝订单', '购物'],
    ['拼多多平台商户', '购物'],
    ['京东订单', '购物'],
    ['美团打车', '交通'],
    ['美团药房买药', '医疗'],
    ['美团酒店住宿', '娱乐'],
    ['美团优选订单', '购物'],
  ])('%s 归类为%s', (description, category) => {
    expect(inferTransactionCategory(description, 'expense')).toBe(category)
  })
})
