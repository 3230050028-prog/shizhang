import { describe, expect, it, vi } from 'vitest'
import { withTimeout } from '../src/lib/timeout'

describe('网络请求超时保护', () => {
  it('正常请求直接返回结果', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100, '超时')).resolves.toBe('ok')
  })

  it('请求长时间无响应时给出明确错误', async () => {
    vi.useFakeTimers()
    const result = withTimeout(new Promise<string>(() => undefined), 12_000, '连接超时')
    const assertion = expect(result).rejects.toThrow('连接超时')

    await vi.advanceTimersByTimeAsync(12_000)
    await assertion
    vi.useRealTimers()
  })
})
