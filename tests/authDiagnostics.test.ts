import { afterEach, describe, expect, it, vi } from 'vitest'
import { inspectAuthConnection, probeConnection } from '../src/lib/authDiagnostics'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('手机账号连接检测', () => {
  it('绕过预缓存检测真实网络，结果不包含密钥或会话数据', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.invalid')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-public-key')
    vi.stubEnv('VITE_APP_VERSION', 'abcdef1234567')
    vi.stubEnv('BASE_URL', '/shizhang/')
    vi.stubGlobal('window', { location: { origin: 'https://site.invalid' }, matchMedia: () => ({ matches: true }) })
    vi.stubGlobal('navigator', { onLine: true })
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    const report = await inspectAuthConnection()
    const siteProbe = fetcher.mock.calls.find(([url]) => String(url).startsWith('https://site.invalid'))
    expect(new URL(String(siteProbe?.[0])).searchParams.has('connection-check')).toBe(true)
    expect(report).toContain('版本：abcdef1')
    expect(report).toContain('桌面安装版')
    expect(report).toContain('账号服务：正常')
    expect(report).not.toContain('test-public-key')
    for (const [, options] of fetcher.mock.calls) {
      expect(options?.body).toBeUndefined()
      expect(options?.credentials).toBe('omit')
      expect(new Headers(options?.headers).has('Authorization')).toBe(false)
    }
  })

  it('区分可达和服务器报错，不把 HTTP 失败显示为成功', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    await expect(probeConnection('账号服务', 'https://test.invalid/health', {}, fetcher)).resolves.toEqual({ label: '账号服务', result: '正常' })
    await expect(probeConnection('账号服务', 'https://test.invalid/health', {}, fetcher)).resolves.toEqual({ label: '账号服务', result: 'HTTP 503' })
  })

  it('对无法区分的浏览器网络错误保留不确定性，且不回显原始敏感错误', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('test-private-token'))
    const result = await probeConnection('账号服务', 'https://test.invalid/health', {}, fetcher)
    expect(result.result).toContain('尚不能区分')
    expect(result.result).not.toContain('test-private-token')
  })

  it('卡住的检测在八秒结束，并真正中止请求，不留下无限等待', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      signal = init?.signal ?? undefined
      return new Promise(() => undefined)
    })
    const request = probeConnection('账号服务', 'https://test.invalid/health', {}, fetcher)
    await vi.advanceTimersByTimeAsync(8_000)
    await expect(request).resolves.toEqual({ label: '账号服务', result: '8 秒内未响应' })
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('检测不发送浏览器 cookie，也不使用缓存结果', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    await probeConnection('账号服务', 'https://test.invalid/health', {}, fetcher)
    expect(fetcher).toHaveBeenCalledWith('https://test.invalid/health', expect.objectContaining({ credentials: 'omit', cache: 'no-store' }))
  })
})
