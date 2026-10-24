// Limit only Auth requests; long-running AI calls and statement imports keep
// their existing time limits. Abort the real request so a retry does not pile up.
export function createAuthFetch(supabaseUrl: string, fetcher: typeof fetch = globalThis.fetch): typeof fetch {
  const authPrefix = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/`
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(authPrefix)) return fetcher(input, init)

    const controller = new AbortController()
    const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    const abort = () => controller.abort(originalSignal?.reason)
    if (originalSignal?.aborted) abort()
    else originalSignal?.addEventListener('abort', abort, { once: true })

    const timer = setTimeout(() => controller.abort(new Error('连接账号服务超时，请检查网络后重试。')), 12_000)
    try {
      return await fetcher(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      originalSignal?.removeEventListener('abort', abort)
    }
  }
}
