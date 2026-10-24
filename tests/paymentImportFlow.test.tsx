// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentImport } from '../src/components/PaymentImport'
import { readPaymentStatement, type ParsedPaymentRow } from '../src/lib/paymentImport'
import type { ActionResult, Transaction, TransactionInput } from '../src/types'

vi.mock('../src/lib/paymentImport', async (original) => ({
  ...await original<typeof import('../src/lib/paymentImport')>(),
  readPaymentStatement: vi.fn(),
}))

const corrected: ParsedPaymentRow = {
  sourceLine: 2, type: 'expense', amount: 18, category: '餐饮',
  account: '微信', note: '日期测试商户', occurred_on: '2026-10-22',
}
const duplicate: ParsedPaymentRow = { ...corrected, sourceLine: 3, amount: 7, note: '已有商户' }
const expense: ParsedPaymentRow = { ...corrected, sourceLine: 4, amount: 12.5, note: '新消费' }
const income: ParsedPaymentRow = { ...corrected, sourceLine: 5, type: 'income', category: '红包', amount: 3.5, note: '新收入' }
const oldTransactions: Transaction[] = [
  { ...corrected, id: 'old', occurred_on: '2026-10-20' },
  { ...duplicate, id: 'already-imported' },
]

let root: Root | undefined
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
})
afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  container.remove()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

async function openImport(source: ParsedPaymentRow[], correctionResult: ActionResult = { ok: true, saved: 1 }) {
  vi.mocked(readPaymentStatement).mockResolvedValue({ rows: source, skipped: 0 })
  const onClose = vi.fn()
  const onImport = vi.fn(async (inputs: TransactionInput[]): Promise<ActionResult> => ({ ok: true, saved: inputs.length, ids: inputs.map((_, i) => `new-${i}`) }))
  const onCorrectDates = vi.fn(async (_updates: Transaction[]): Promise<ActionResult> => correctionResult)

  function Fixture() {
    const [transactions, setTransactions] = useState(oldTransactions)
    return <PaymentImport
      transactions={transactions}
      onClose={onClose}
      onImport={onImport}
      onReplaceFromStatement={vi.fn()}
      onDeleteDuplicates={vi.fn()}
      onCorrectDates={async (updates) => {
        const result = await onCorrectDates(updates)
        if (result.ok) setTransactions((current) => current.map((item) => updates.find((update) => update.id === item.id) ?? item))
        return result
      }}
    />
  }

  root = createRoot(container)
  await act(async () => root!.render(<Fixture />))
  const input = container.querySelector('input[type=file]')!
  Object.defineProperty(input, 'files', { value: [new File(['test-only'], '测试账单.csv', { type: 'text/csv' })], configurable: true })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  return { onClose, onImport, onCorrectDates }
}

async function clickButton(name: RegExp) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find((item) => name.test(item.textContent ?? ''))
  expect(button, `没有找到按钮 ${name}`).toBeDefined()
  expect(button!.disabled).toBe(false)
  await act(async () => button!.click())
}

describe('修正日期后的账单导入流程', () => {
  it('修正旧账日期后保留新账单，同一窗口确认导入且不重导修正项和重复项', async () => {
    const calls = await openImport([corrected, duplicate, expense, income])
    await clickButton(/^确认修正 1 笔日期$/)
    expect(calls.onClose).not.toHaveBeenCalled()
    expect(calls.onImport).not.toHaveBeenCalled()
    expect(container.textContent).toContain('确认导入 2 笔')
    expect(container.textContent).toContain('金额核对一致')
    await clickButton(/^确认导入 2 笔$/)
    const { sourceLine: _expenseLine, ...expectedExpense } = expense
    const { sourceLine: _incomeLine, ...expectedIncome } = income
    expect(calls.onImport.mock.calls[0][0]).toEqual([expectedExpense, expectedIncome])
    expect(container.textContent).toContain('成功导入 2 笔')
  })

  it('文件只有日期修正时显示完成页，不出现确认导入零笔', async () => {
    const calls = await openImport([corrected])
    await clickButton(/^确认修正 1 笔日期$/)
    expect(container.textContent).toContain('已修正 1 笔日期')
    expect([...container.querySelectorAll('button')].some((button) => /确认导入/.test(button.textContent ?? ''))).toBe(false)
    expect(calls.onImport).not.toHaveBeenCalled()
    await clickButton(/^完成并返回账本$/)
    expect(calls.onClose).toHaveBeenCalledOnce()
  })

  it('修正失败时保留新账单和可重试的修正按钮', async () => {
    const calls = await openImport([corrected, expense], { ok: false, error: '测试网络失败' })
    await clickButton(/^确认修正 1 笔日期$/)
    expect(container.textContent).toContain('测试网络失败')
    expect(container.textContent).toContain('确认修正 1 笔日期')
    expect(container.textContent).toContain('确认导入 1 笔')
    expect(calls.onImport).not.toHaveBeenCalled()
    expect(calls.onClose).not.toHaveBeenCalled()
  })

  it('修正后更换了无法读取的文件时显示读取错误，不误入旧的完成页', async () => {
    await openImport([corrected, expense])
    await clickButton(/^确认修正 1 笔日期$/)
    vi.mocked(readPaymentStatement).mockRejectedValueOnce(new Error('测试文件格式错误'))
    const input = container.querySelector('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [new File(['invalid'], '无效账单.csv')], configurable: true })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(container.textContent).toContain('测试文件格式错误')
    expect(container.querySelector('input[type=file]')).not.toBeNull()
    expect(container.querySelector('.import-success')).toBeNull()
  })
})
