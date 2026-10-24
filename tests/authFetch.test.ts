import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthFetch } from '../src/lib/authFetch'

const base = 'https://example.supabase.co'
afterEach(() => vi.useRealTimers())

describe('账号请求超时与隔离', () => {
  it('卡住的账号请求会真正中止，便于下一次重试', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      signal = init?.signal ?? undefined
      signal?.addEventListener('abort', () => reject(signal?.reason), { once: true })
    }))
    const request = createAuthFetch(base, fetcher)(`${base}/auth/v1/token?grant_type=password`)
    const assertion = expect(request).rejects.toThrow('超时')
    await vi.advanceTimersByTimeAsync(12_000)
    await assertion
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('正常完成后释放计时器，保留请求数据和响应', async () => {
    vi.useFakeTimers()
    const response = new Response('{}', { status: 200 })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
    const init = { method: 'POST', body: '{"test":true}', headers: { 'Content-Type': 'application/json' } }
    await expect(createAuthFetch(base, fetcher)(`${base}/auth/v1/token`, init)).resolves.toBe(response)
    expect(fetcher).toHaveBeenCalledWith(`${base}/auth/v1/token`, expect.objectContaining(init))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('不缩短 AI 调用和账单数据库请求的时间限制', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    const request = createAuthFetch(base, fetcher)
    for (const path of ['/functions/v1/ai-gateway', '/rest/v1/transactions']) {
      const init = { method: 'GET' }
      await request(`${base}${path}`, init)
      expect(fetcher).toHaveBeenLastCalledWith(`${base}${path}`, init)
    }
  })

  it('保留调用者的取消信号', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller cancelled'))
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    await createAuthFetch(base, fetcher)(`${base}/auth/v1/user`, { signal: controller.signal })
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(fetcher.mock.calls[0][1]?.signal?.reason.message).toBe('caller cancelled')
  })
})
