import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeQwen } from '../supabase/functions/ai-gateway/qwen'

afterEach(() => vi.unstubAllGlobals())

describe('Qwen accounting request', () => {
  it('uses direct answers, a bounded response, and an actual timeout signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '十月支出100元' } }], usage: { prompt_tokens: 60, completion_tokens: 10, total_tokens: 70 },
    })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(completeQwen('dummy-test-key', 'qwen3.8-flash', '账目', '助手')).resolves.toMatchObject({ text: '十月支出100元', usage: { total: 70 } })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(options.body)).toMatchObject({ model: 'qwen3.8-flash', enable_thinking: false, max_tokens: 2048 })
  })

  it('reports a provider wait timeout in Chinese', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')))
    await expect(completeQwen('dummy-test-key', 'qwen-plus', '账目', '助手')).rejects.toThrow('AI 响应超时')
  })

  it('keeps the provider error instead of returning an empty answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Insufficient balance' } }), { status: 402 })))
    await expect(completeQwen('dummy-test-key', 'qwen-plus', '账目', '助手')).rejects.toThrow('Insufficient balance')
  })
})
