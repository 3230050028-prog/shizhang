// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { AIWorkspace } from '../src/components/AIWorkspace'
import { askLedgerAI } from '../src/lib/ai'

vi.mock('../src/lib/ai', async (original) => ({
  ...await original<typeof import('../src/lib/ai')>(),
  listAIConfigs: vi.fn().mockResolvedValue([{ provider: 'qwen', model: 'qwen3.8-flash', isDefault: true }]),
  listAIModels: vi.fn().mockResolvedValue([{ provider: 'qwen', id: 'qwen3.8-flash', name: 'Flash' }]),
  askLedgerAI: vi.fn().mockResolvedValue({ answer: '九月支出18元' }),
}))

it('passes the selected dashboard month when clicking a starter question', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<AIWorkspace month="2026-09" onClose={() => {}} />))
    expect(host.textContent).toContain('2026-09')
    const question = [...host.querySelectorAll('button')].find((button) => button.textContent === '这个月我主要把钱花在哪里？')!
    await act(async () => question.click())
    expect(askLedgerAI).toHaveBeenCalledWith([{ role: 'user', content: '这个月我主要把钱花在哪里？' }], '2026-09')
    expect(host.textContent).toContain('九月支出18元')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    scroll.mockRestore()
    vi.unstubAllGlobals()
  }
})
