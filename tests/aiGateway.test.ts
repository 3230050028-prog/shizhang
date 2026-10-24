import { beforeEach, describe, expect, it, vi } from 'vitest'
import { askLedgerAI, testAIConfig } from '../src/lib/ai'
import { supabase } from '../src/lib/supabase'

vi.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }))

beforeEach(() => vi.resetAllMocks())

function fail(status: number, payload: unknown) {
  const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(JSON.stringify(payload), { status }),
  })
  vi.mocked(supabase!.functions.invoke).mockResolvedValue({ data: null, error } as never)
}

describe('AI gateway response errors', () => {
  it('explains an idle timeout returned by the platform gateway', async () => {
    fail(504, { code: 'GATEWAY_TIMEOUT', message: 'The request timed out' })
    await expect(testAIConfig('qwen')).rejects.toThrow('响应超时')
  })

  it('distinguishes a function resource limit from a bad model key', async () => {
    fail(546, { code: 'WORKER_LIMIT', message: 'Edge Function exceeded resource limits' })
    await expect(testAIConfig('qwen')).rejects.toThrow('资源限制')
  })

  it('retains the concrete provider error from the function', async () => {
    fail(500, { ok: false, error: 'API key is invalid' })
    await expect(testAIConfig('qwen')).rejects.toThrow('API Key 无效')
  })

  it('includes the HTTP status when no JSON error is available', async () => {
    const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: new Response('<html>Unavailable</html>', { status: 502 }),
    })
    vi.mocked(supabase!.functions.invoke).mockResolvedValue({ data: null, error } as never)
    await expect(testAIConfig('qwen')).rejects.toThrow('502')
  })

  it('sends the page month with the question', async () => {
    vi.mocked(supabase!.functions.invoke).mockResolvedValue({ data: { ok: true, data: { answer: '回答' } }, error: null } as never)
    await askLedgerAI([{ role: 'user', content: '这个月花在哪里？' }], '2026-10')
    expect(supabase!.functions.invoke).toHaveBeenCalledWith('ai-gateway', {
      body: { action: 'chat', selectedMonth: '2026-10', messages: [{ role: 'user', content: '这个月花在哪里？' }] },
    })
  })
})
